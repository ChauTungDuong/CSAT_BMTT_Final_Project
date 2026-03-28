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
import { Account } from '../accounts/entities/account.entity';
import { AuditService } from '../../audit/audit.service';
import { MaskingEngine } from '../../masking/masking.engine';
import { AesService } from '../../crypto/services/aes.service';
import { Role } from '../../common/types/role.enum';
import { Pbkdf2Service } from '../../crypto/services/pbkdf2.service';
import { MailService } from '../customers/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  private readonly adminViewSessions = new Map<
    string,
    {
      adminId: string;
      targetUserId: string;
      reason: string;
      expiresAt: number;
    }
  >();

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    private audit: AuditService,
    private masking: MaskingEngine,
    private aes: AesService,
    private pbkdf2: Pbkdf2Service,
    private mailService: MailService,
  ) {}

  async getUsers(page: number, limit: number) {
    const [users, total] = await this.userRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Join với customers để lấy thêm thông tin
    const items = await Promise.all(
      users.map(async (u) => {
        const customer = await this.customerRepo.findOne({
          where: { userId: u.id },
        });

        const account = customer
          ? await this.accountRepo.findOne({
              where: { customerId: customer.id, isActive: 1 },
              order: { createdAt: 'DESC' },
            })
          : null;

        const decryptAndMask = async (
          value: Buffer | null | undefined,
          field: 'phone' | 'cccd' | 'date_of_birth' | 'address',
        ): Promise<string | null> => {
          if (!value) return null;
          try {
            const decrypted = await this.aes.decrypt(
              this.aes.deserialize(value),
            );
            return this.masking.mask(decrypted, field, Role.ADMIN);
          } catch {
            return null;
          }
        };

        const [phone, cccd, dateOfBirth, address] = await Promise.all([
          decryptAndMask(customer?.phone, 'phone'),
          decryptAndMask(customer?.cccd, 'cccd'),
          decryptAndMask(customer?.dateOfBirth, 'date_of_birth'),
          decryptAndMask(customer?.address, 'address'),
        ]);

        return {
          id: u.id,
          username: u.username,
          role: u.role,
          isActive: !!u.isActive,
          fullName: customer?.fullName || u.fullName || null,
          email: customer?.email
            ? this.masking.mask(customer.email, 'email', Role.ADMIN)
            : u.email
              ? this.masking.mask(u.email, 'email', Role.ADMIN)
              : null,
          phone,
          cccd,
          dateOfBirth,
          address,
          accountNumber: account?.accountNumber
            ? this.masking.mask(
                account.accountNumber,
                'account_number',
                Role.ADMIN,
              )
            : null,
          createdAt: u.createdAt,
        };
      }),
    );

    return { items, total, page, limit };
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

    await this.userRepo.update(userId, { isActive: isActive ? 1 : 0 });

    // Nếu mở khóa thì reset bộ đếm PIN sai
    if (isActive) {
      const customer = await this.customerRepo.findOne({ where: { userId } });
      if (customer) {
        customer.pinFailedAttempts = 0;
        customer.pinLocked = 0;
        customer.pinLockedAt = null;
        await this.customerRepo.save(customer);
      }
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
      const recipient = (target.email || customer?.email || '').trim();

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

  async changeUserRole(
    userId: string,
    newRole: string,
    adminId: string,
    ip: string,
  ) {
    if (!['customer', 'admin'].includes(newRole)) {
      throw new BadRequestException('Role không hợp lệ');
    }
    if (userId === adminId) {
      throw new BadRequestException('Không thể đổi role của chính mình');
    }
    await this.userRepo.update(userId, { role: newRole as any });
    await this.audit.log(
      'ADMIN_CHANGE_ROLE',
      adminId,
      userId,
      ip,
      `New role: ${newRole}`,
    );
    return { message: 'Đã đổi vai trò thành công' };
  }

  async deleteUser(userId: string, adminId: string, ip: string) {
    await this.audit.log(
      'ADMIN_DELETE_USER_BLOCKED',
      adminId,
      userId,
      ip,
      'Delete user action is disabled by security policy',
    );
    throw new ForbiddenException(
      'Chính sách hiện tại không cho phép xóa tài khoản người dùng',
    );
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

  async resetUserPassword(
    userId: string,
    adminId: string,
    ip: string,
    adminPin: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Phải nhập lý do reset mật khẩu');
    }

    await this.verifyAdminPin(adminId, adminPin);

    const target = await this.userRepo.findOne({ where: { id: userId } });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');

    if (target.id === adminId) {
      throw new ForbiddenException(
        'Không thể reset mật khẩu chính tài khoản admin hiện tại',
      );
    }

    if (target.role === 'admin') {
      throw new ForbiddenException(
        'Không thể reset mật khẩu tài khoản quản trị viên',
      );
    }

    const customer = await this.customerRepo.findOne({ where: { userId } });
    const recipient = (target.email || customer?.email || '').trim();
    if (!recipient) {
      throw new BadRequestException(
        'Người dùng chưa có email hợp lệ để nhận mật khẩu tạm thời',
      );
    }

    const oldPasswordHash = target.passwordHash;
    const oldForcePasswordChange = target.forcePasswordChange;

    const tempPassword = this.generateTemporaryPassword();
    target.passwordHash = this.pbkdf2.hashSecret(tempPassword, 'password');
    target.forcePasswordChange = 1;
    await this.userRepo.save(target);

    try {
      await this.mailService.sendTemporaryPasswordEmail(
        recipient,
        tempPassword,
        reason,
      );
    } catch {
      target.passwordHash = oldPasswordHash;
      target.forcePasswordChange = oldForcePasswordChange;
      await this.userRepo.save(target);

      await this.audit.log(
        'ADMIN_RESET_PASSWORD_FAIL',
        adminId,
        userId,
        ip,
        `reason: ${reason}, mail delivery failed`,
      );

      throw new BadRequestException(
        'Không thể gửi email mật khẩu tạm thời. Vui lòng kiểm tra email hoặc cấu hình SMTP.',
      );
    }

    await this.audit.log(
      'ADMIN_RESET_PASSWORD',
      adminId,
      userId,
      ip,
      `reason: ${reason}`,
    );

    return { message: 'Đã reset mật khẩu và gửi email cho người dùng' };
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

  async openSensitiveUserView(
    targetUserId: string,
    adminId: string,
    ip: string,
    adminPin: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Phải nhập lý do xem thông tin chi tiết');
    }
    await this.verifyAdminPin(adminId, adminPin);

    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const customer = await this.customerRepo.findOne({
      where: { userId: targetUserId },
    });
    if (!customer)
      throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');

    const [phone, cccd, dateOfBirth, address] = await Promise.all([
      this.aes.decrypt(this.aes.deserialize(customer.phone)),
      this.aes.decrypt(this.aes.deserialize(customer.cccd)),
      this.aes.decrypt(this.aes.deserialize(customer.dateOfBirth)),
      this.aes.decrypt(this.aes.deserialize(customer.address)),
    ]);

    const viewToken = crypto.randomUUID();
    const expiresAt = Date.now() + 2 * 60 * 1000;
    this.adminViewSessions.set(viewToken, {
      adminId,
      targetUserId,
      reason,
      expiresAt,
    });

    await this.audit.log(
      'ADMIN_VIEW_SENSITIVE_OPEN',
      adminId,
      targetUserId,
      ip,
      `reason: ${reason}`,
    );

    return {
      viewToken,
      expiresAt: new Date(expiresAt).toISOString(),
      details: {
        email: user.email,
        phone: phone ?? '',
        cccd: cccd ?? '',
        dateOfBirth: dateOfBirth ?? '',
        address: address ?? '',
      },
    };
  }

  async closeSensitiveUserView(viewToken: string, adminId: string, ip: string) {
    const session = this.adminViewSessions.get(viewToken);
    if (!session) return { message: 'Phiên xem đã hết hạn hoặc đã đóng' };

    if (session.adminId !== adminId) {
      throw new ForbiddenException('Không có quyền đóng phiên xem này');
    }

    this.adminViewSessions.delete(viewToken);
    await this.audit.log(
      'ADMIN_VIEW_SENSITIVE_CLOSE',
      adminId,
      session.targetUserId,
      ip,
      `reason: ${session.reason}`,
    );
    return { message: 'Đã đóng phiên xem chi tiết' };
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

  private generateTemporaryPassword() {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = crypto.randomBytes(12);
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }
}
