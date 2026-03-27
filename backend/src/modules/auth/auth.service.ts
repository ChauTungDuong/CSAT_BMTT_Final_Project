import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Account } from '../accounts/entities/account.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../../audit/audit.service';
import { AesService } from '../../crypto/services/aes.service';
import { Pbkdf2Service } from '../../crypto/services/pbkdf2.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    private jwtService: JwtService,
    private auditService: AuditService,
    private aesService: AesService,
    private pbkdf2: Pbkdf2Service,
  ) {}

  async register(dto: RegisterDto, ip: string) {
    const exists = await this.userRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (exists)
      throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại');

    // Uniqueness check for phone and cccd (decryption needed)
    const allCustomers = await this.customerRepo.find();
    for (const c of allCustomers) {
      const decPhone = await this.aesService.decrypt(
        this.aesService.deserialize(c.phone),
      );
      const decCccd = await this.aesService.decrypt(
        this.aesService.deserialize(c.cccd),
      );
      if (decPhone === dto.phone) {
        throw new ConflictException('Số điện thoại đã tồn tại');
      }
      if (decCccd === dto.cccd) {
        throw new ConflictException('Căn cước công dân đã tồn tại');
      }
    }

    // Uniqueness check for accountNumber
    const accExists = await this.accountRepo.findOne({
      where: { accountNumber: dto.accountNumber },
    });
    if (accExists) throw new ConflictException('Số tài khoản đã tồn tại');

    const passwordHash = this.pbkdf2.hashSecret(dto.password, 'password');
    const userId = `USR-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;
    const customerId = `CUS-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;
    const accountId = `ACC-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;

    const user = this.userRepo.create({
      id: userId,
      username: dto.username,
      passwordHash,
      role: 'customer',
      email: dto.email,
      fullName: dto.fullName,
    });
    await this.userRepo.save(user);

    const encPhone = await this.aesService.encrypt(dto.phone);
    const encCccd = await this.aesService.encrypt(dto.cccd);
    const normalizedDob = this.normalizeDateOfBirth(dto.dateOfBirth);
    const encDob = await this.aesService.encrypt(normalizedDob);
    const encAddr = await this.aesService.encrypt(dto.address);

    const customer = this.customerRepo.create({
      id: customerId,
      userId: userId,
      fullName: dto.fullName,
      email: dto.email,
      phone: this.aesService.serialize(encPhone),
      cccd: this.aesService.serialize(encCccd),
      dateOfBirth: this.aesService.serialize(encDob),
      address: this.aesService.serialize(encAddr),
    });
    await this.customerRepo.save(customer);

    const encBalance = await this.aesService.encrypt('0');
    const account = this.accountRepo.create({
      id: accountId,
      customerId: customerId,
      accountNumber: dto.accountNumber,
      accountType: 'saving',
      balance: this.aesService.serialize(encBalance),
    });
    await this.accountRepo.save(account);

    await this.auditService.log(
      'REGISTER',
      user.id,
      null,
      ip,
      `Role: ${user.role}`,
    );
    return { message: 'Đăng ký thành công' };
  }

  private normalizeDateOfBirth(input: string): string {
    const value = input.trim();

    // HTML date input typically sends yyyy-MM-dd
    const isoLike = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLike) {
      const [, year, month, day] = isoLike;
      return `${day}/${month}/${year}`;
    }

    // Keep dd/MM/yyyy as-is if client already sends normalized value
    const slash = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
      return value;
    }

    // Fallback: preserve original text, masking engine will still protect by year.
    return value;
  }

  async login(dto: LoginDto, ip: string) {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    // KHÔNG phân biệt "user không tồn tại" và "sai mật khẩu" (chống user enumeration)
    const isValid = user
      ? this.pbkdf2.verifySecret(dto.password, user.passwordHash)
      : false;

    if (!user || !isValid || !user.isActive) {
      await this.auditService.log(
        'LOGIN_FAIL',
        user?.id || null,
        null,
        ip,
        `Username: ${dto.username}`,
      );
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    await this.auditService.log(
      'LOGIN_SUCCESS',
      user.id,
      null,
      ip,
      `Role: ${user.role}`,
    );
    return {
      accessToken: token,
      role: user.role,
      forcePasswordChange: !!user.forcePasswordChange,
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      forcePasswordChange: !!user.forcePasswordChange,
    };
  }

  async updateProfile(
    userId: string,
    data: { fullName?: string; email?: string },
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.email !== undefined) user.email = data.email;
    await this.userRepo.save(user);
    return { message: 'Cập nhật hồ sơ thành công' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ip: string,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu mới phải từ 8 ký tự');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const validCurrent = this.pbkdf2.verifySecret(
      currentPassword,
      user.passwordHash,
    );
    if (!validCurrent) {
      await this.auditService.log(
        'CHANGE_PASSWORD_FAIL',
        userId,
        userId,
        ip,
        'Current password mismatch',
      );
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    user.passwordHash = this.pbkdf2.hashSecret(newPassword, 'password');
    user.forcePasswordChange = 0;
    await this.userRepo.save(user);

    await this.auditService.log(
      'CHANGE_PASSWORD',
      userId,
      userId,
      ip,
      'Password changed by user',
    );

    return { message: 'Đổi mật khẩu thành công' };
  }
}
