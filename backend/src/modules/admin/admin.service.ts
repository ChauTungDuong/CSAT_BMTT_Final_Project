import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AuditService } from '../../audit/audit.service';
import { MaskingEngine } from '../../masking/masking.engine';
import { AesService } from '../../crypto/services/aes.service';
import { Role } from '../../common/types/role.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    private audit: AuditService,
    private masking: MaskingEngine,
    private aes: AesService,
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

        let phone: string | null = null;
        if (customer?.phone) {
          try {
            const decrypted = await this.aes.decrypt(
              this.aes.deserialize(customer.phone as Buffer),
            );
            phone = this.masking.mask(decrypted, 'phone', Role.ADMIN);
          } catch {
            phone = null;
          }
        }

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
  ) {
    await this.userRepo.update(userId, { isActive: isActive ? 1 : 0 });
    await this.audit.log(
      isActive ? 'ADMIN_ACTIVATE_USER' : 'ADMIN_DEACTIVATE_USER',
      adminId,
      userId,
      ip,
      `isActive: ${isActive}`,
    );
    return { message: `Tài khoản đã được ${isActive ? 'mở khoá' : 'khoá'}` };
  }

  async changeUserRole(
    userId: string,
    newRole: string,
    adminId: string,
    ip: string,
  ) {
    if (!['customer', 'teller', 'admin'].includes(newRole)) {
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
    if (userId === adminId) {
      throw new BadRequestException('Không thể xoá tài khoản của chính mình');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (customer) {
      throw new BadRequestException(
        'Không thể xoá người dùng có hồ sơ khách hàng. Hãy khoá tài khoản thay thế.',
      );
    }

    await this.userRepo.delete(userId);
    await this.audit.log(
      'ADMIN_DELETE_USER',
      adminId,
      userId,
      ip,
      `Deleted: ${user.username}`,
    );
    return { message: 'Đã xoá người dùng' };
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
    const [totalUsers, customers, tellers, admins] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { role: 'customer' } }),
      this.userRepo.count({ where: { role: 'teller' } }),
      this.userRepo.count({ where: { role: 'admin' } }),
    ]);

    const inactive = await this.userRepo
      .createQueryBuilder('u')
      .where('u.isActive = 0')
      .getCount();

    return { totalUsers, customers, tellers, admins, inactive };
  }
}
