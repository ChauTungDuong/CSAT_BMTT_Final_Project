import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AuditService } from '../../audit/audit.service';
import { MaskingEngine } from '../../masking/masking.engine';
import { Role } from '../../common/types/role.enum';
import { Pbkdf2Service } from '../../crypto/services/pbkdf2.service';
import { EmailCryptoService } from '../../crypto/services/email-crypto.service';
import { MailService } from '../customers/mail.service';
import { SessionRegistryService } from '../auth/services/session-registry.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    private audit: AuditService,
    private masking: MaskingEngine,
    private pbkdf2: Pbkdf2Service,
    private emailCrypto: EmailCryptoService,
    private mailService: MailService,
    private sessionRegistry: SessionRegistryService,
  ) {}

  async getUsers(page: number, limit: number, q?: string) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const keyword = (q || '').trim().toLowerCase();
    const fullyMasked = {
      email: this.masking.mask('', 'email', Role.ADMIN),
      phone: this.masking.mask('', 'phone', Role.ADMIN),
      cccd: this.masking.mask('', 'cccd', Role.ADMIN),
      accountNumber: this.masking.mask('', 'account_number', Role.ADMIN),
      dateOfBirth: this.masking.mask('', 'date_of_birth', Role.ADMIN),
      address: this.masking.mask('', 'address', Role.ADMIN),
    };

    const users = await this.userRepo.find({
      order: { createdAt: 'DESC' },
    });

    // Join với customers để lấy thêm thông tin
    const items = await Promise.all(
      users.map(async (u) => {
        return {
          id: u.id,
          username: u.username,
          role: u.role,
          isActive: !!u.isActive,
          fullName: '***',
          email: fullyMasked.email,
          phone: fullyMasked.phone,
          cccd: fullyMasked.cccd,
          dateOfBirth: fullyMasked.dateOfBirth,
          address: fullyMasked.address,
          accountNumber: fullyMasked.accountNumber,
          createdAt: u.createdAt,
        };
      }),
    );

    const filteredItems = keyword
      ? items.filter((item) => {
          const usernameMatch = item.username?.toLowerCase().includes(keyword);
          return !!usernameMatch;
        })
      : items;

    const total = filteredItems.length;
    const start = (safePage - 1) * safeLimit;
    const pagedItems = filteredItems.slice(start, start + safeLimit);

    return {
      items: pagedItems,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async setUserStatus(
    userId: string,
    isActive: boolean,
    adminId: string,
    ip: string,
    adminPin: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Phải nhập lý do khóa/mở khóa');
    }

    await this.verifyAdminPin(adminId, adminPin);

    const target = await this.userRepo.findOne({ where: { id: userId } });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');

    if (target.id === adminId) {
      throw new ForbiddenException(
        'Không thể khóa/mở khóa chính tài khoản admin hiện tại',
      );
    }

    if (target.role === 'admin') {
      throw new ForbiddenException(
        'Không thể khóa/mở khóa tài khoản quản trị viên',
      );
    }

    if (isActive) {
      // Mở khóa phải reset đồng bộ cả cờ khóa và bộ đếm để không bị tái khóa giả.
      await this.userRepo.update(userId, {
        isActive: 1,
        passwordFailedAttempts: 0,
        forgotOtpFailedAttempts: 0,
        passwordLocked: 0,
        passwordLockedAt: null,
        lockReason: 'NONE',
      });

      const customer = await this.customerRepo.findOne({ where: { userId } });
      if (customer) {
        customer.pinFailedAttempts = 0;
        customer.pinLocked = 0;
        customer.pinLockedAt = null;
        await this.customerRepo.save(customer);
      }
    } else {
      await this.userRepo.update(userId, {
        isActive: 0,
        lockReason: 'ADMIN',
      });

      // Revoke session ngay để user bị đăng xuất ở request kế tiếp.
      this.sessionRegistry.invalidateSession(userId);
    }

    await this.audit.log(
      isActive ? 'ADMIN_ACTIVATE_USER' : 'ADMIN_DEACTIVATE_USER',
      adminId,
      userId,
      ip,
      `isActive: ${isActive}, reason: ${reason}`,
    );

    let warning: string | null = null;
    if (!isActive) {
      const customer = await this.customerRepo.findOne({ where: { userId } });
      const recipient =
        this.emailCrypto.readEmail(target.email) ||
        this.emailCrypto.readEmail(customer?.email || null);

      if (!recipient) {
        warning = 'Không có email hợp lệ để gửi thông báo khóa tài khoản';
      } else {
        try {
          await this.mailService.sendAccountLockStatusEmail(
            recipient,
            target.username,
            reason,
          );
        } catch {
          warning = 'Đã khóa tài khoản nhưng không gửi được email thông báo';
          await this.audit.log(
            'ADMIN_DEACTIVATE_NOTIFY_FAIL',
            adminId,
            userId,
            ip,
            `reason: ${reason}`,
          );
        }
      }
    }

    return {
      message: `Tài khoản đã được ${isActive ? 'mở khoá' : 'khoá'}`,
      ...(warning ? { warning } : {}),
    };
  }

  async setAdminSecurityPin(adminId: string, pin: string, ip: string) {
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN admin phải là 6 chữ số');
    }

    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Không có quyền thực hiện thao tác này');
    }

    admin.adminPinHash = this.pbkdf2.hashSecret(pin, 'pin');
    await this.userRepo.save(admin);

    await this.audit.log(
      'ADMIN_SET_SECURITY_PIN',
      adminId,
      adminId,
      ip,
      'Admin security PIN updated',
    );
    return { message: 'Đã cập nhật PIN admin' };
  }

  async changeAdminSecurityPin(
    adminId: string,
    currentPassword: string,
    currentPin: string,
    newPin: string,
    confirmPin: string,
    ip: string,
  ) {
    if (!/^[\d]{6}$/.test(currentPin) || !/^[\d]{6}$/.test(newPin)) {
      throw new BadRequestException('PIN phải gồm đúng 6 chữ số');
    }

    if (newPin !== confirmPin) {
      throw new BadRequestException('PIN xác nhận không khớp');
    }

    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Không có quyền thực hiện thao tác này');
    }

    if (!admin.adminPinHash) {
      throw new BadRequestException('Admin chưa thiết lập PIN bảo mật');
    }

    if (!this.pbkdf2.verifySecret(currentPassword, admin.passwordHash)) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    if (!this.pbkdf2.verifySecret(currentPin, admin.adminPinHash)) {
      throw new ForbiddenException('PIN hiện tại không đúng');
    }

    if (this.pbkdf2.verifySecret(newPin, admin.adminPinHash)) {
      throw new BadRequestException('PIN mới phải khác PIN hiện tại');
    }

    admin.adminPinHash = this.pbkdf2.hashSecret(newPin, 'pin');
    await this.userRepo.save(admin);

    await this.audit.log(
      'ADMIN_CHANGE_SECURITY_PIN',
      adminId,
      adminId,
      ip,
      'Admin changed security PIN',
    );

    return { message: 'Đổi PIN admin thành công' };
  }

  async getAuditLogs(
    page: number,
    limit: number,
    eventType?: string,
    userId?: string,
  ) {
    return this.audit.findAll(page, limit, eventType, userId);
  }

  async getSystemStats() {
    const [totalUsers, customers, admins] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { role: 'customer' } }),
      this.userRepo.count({ where: { role: 'admin' } }),
    ]);

    const inactive = await this.userRepo
      .createQueryBuilder('u')
      .where('u.isActive = 0')
      .getCount();

    return { totalUsers, customers, admins, inactive };
  }

  private async verifyAdminPin(adminId: string, adminPin: string) {
    if (!adminPin || !/^\d{6}$/.test(adminPin)) {
      throw new BadRequestException('PIN admin không hợp lệ');
    }

    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Không có quyền thực hiện thao tác này');
    }

    if (!admin.adminPinHash) {
      throw new BadRequestException('Admin chưa thiết lập PIN bảo mật');
    }

    if (!this.pbkdf2.verifySecret(adminPin, admin.adminPinHash)) {
      throw new ForbiddenException('PIN admin không đúng');
    }
  }
}
