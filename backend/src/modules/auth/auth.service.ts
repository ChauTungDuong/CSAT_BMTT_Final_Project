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
import { AccountCryptoService } from '../../crypto/services/account-crypto.service';
import { Pbkdf2Service } from '../../crypto/services/pbkdf2.service';
import { MailService } from '../customers/mail.service';

@Injectable()
export class AuthService {
  private readonly forgotPasswordOtps = new Map<
    string,
    {
      otpHash: string;
      email: string;
      expiresAt: number;
      failedAttempts: number;
    }
  >();

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    private jwtService: JwtService,
    private auditService: AuditService,
    private aesService: AesService,
    private accountCrypto: AccountCryptoService,
    private pbkdf2: Pbkdf2Service,
    private mailService: MailService,
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

    // Uniqueness check for accountNumber (using hash)
    const accHash = this.accountCrypto.hashAccountNumber(dto.accountNumber);
    const accExists = await this.accountRepo.findOne({
      where: { accountNumberHash: accHash },
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

    // Encrypt account number and store with hash
    const encAccountNumber = await this.accountCrypto.encryptAccountNumber(
      dto.accountNumber,
    );
    const encBalance = await this.aesService.encrypt('0');
    const account = this.accountRepo.create({
      id: accountId,
      customerId: customerId,
      accountNumber: this.aesService.serialize(encAccountNumber),
      accountNumberHash: accHash,
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

    // Chỉ trả trạng thái khóa khi password đúng để giảm khả năng dò thông tin tài khoản
    if (user && isValid && !user.isActive) {
      let lockMessage = 'Tài khoản đã bị khóa bởi quản trị viên';

      if (user.role === 'customer') {
        const customer = await this.customerRepo.findOne({
          where: { userId: user.id },
        });
        if (customer?.pinLocked) {
          lockMessage =
            'Tài khoản đã bị khóa do nhập sai mã PIN quá 5 lần. Vui lòng liên hệ quản trị viên để mở khóa';
        }
      }

      await this.auditService.log(
        'LOGIN_FAIL_LOCKED',
        user.id,
        null,
        ip,
        `Locked account login: ${dto.username}`,
      );
      throw new UnauthorizedException(lockMessage);
    }

    if (!user || !isValid) {
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
      hasAdminPin: user.role === 'admin' ? !!user.adminPinHash : undefined,
    };
  }

  async updateProfile(
    userId: string,
    data: { fullName?: string; email?: string },
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const customer = await this.customerRepo.findOne({ where: { userId } });

    if (data.fullName !== undefined) {
      const normalizedName = data.fullName.trim();
      if (!normalizedName) {
        throw new BadRequestException('Họ và tên không được để trống');
      }
      user.fullName = normalizedName;
      if (customer) customer.fullName = normalizedName;
    }

    if (data.email !== undefined) {
      const normalizedEmail = data.email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new BadRequestException('Email không được để trống');
      }

      const existingEmail = await this.userRepo
        .createQueryBuilder('u')
        .where('LOWER(u.email) = :email', { email: normalizedEmail })
        .andWhere('u.id != :id', { id: userId })
        .getOne();

      if (existingEmail) {
        throw new ConflictException('Email đã tồn tại');
      }

      user.email = normalizedEmail;
      if (customer) customer.email = normalizedEmail;
    }

    await this.userRepo.save(user);
    if (customer) {
      await this.customerRepo.save(customer);
    }

    return { message: 'Cập nhật hồ sơ thành công' };
  }

  async requestForgotPasswordOtp(username: string, email: string, ip: string) {
    const safeMessage =
      'Nếu thông tin hợp lệ, OTP đặt lại mật khẩu đã được gửi tới email đã đăng ký.';

    const normalizedUsername = (username || '').trim();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail) {
      throw new BadRequestException('Vui lòng nhập tên đăng nhập và email');
    }

    const user = await this.userRepo.findOne({
      where: { username: normalizedUsername },
    });

    if (!user || (user.email || '').trim().toLowerCase() !== normalizedEmail) {
      await this.auditService.log(
        'FORGOT_PASSWORD_REQUEST',
        user?.id || null,
        null,
        ip,
        `Invalid identity proof for username: ${normalizedUsername}`,
      );
      return { message: safeMessage };
    }

    const otp = this.generateOtpCode();
    this.forgotPasswordOtps.set(user.id, {
      otpHash: this.pbkdf2.hashSecret(otp, 'pin'),
      email: normalizedEmail,
      expiresAt: Date.now() + 5 * 60 * 1000,
      failedAttempts: 0,
    });

    try {
      await this.mailService.sendPasswordResetOtpEmail(normalizedEmail, otp);
    } catch {
      this.forgotPasswordOtps.delete(user.id);
      throw new BadRequestException(
        'Không thể gửi OTP lúc này. Vui lòng thử lại sau.',
      );
    }

    await this.auditService.log(
      'FORGOT_PASSWORD_OTP_SENT',
      user.id,
      user.id,
      ip,
      'Password reset OTP sent',
    );

    return {
      message: safeMessage,
      otpExpiresInSeconds: 300,
    };
  }

  async confirmForgotPassword(
    username: string,
    email: string,
    otp: string,
    newPassword: string,
    confirmPassword: string,
    ip: string,
  ) {
    const normalizedUsername = (username || '').trim();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail) {
      throw new BadRequestException('Thông tin xác thực không hợp lệ');
    }

    if (!/^[0-9]{6}$/.test(otp || '')) {
      throw new BadRequestException('OTP không hợp lệ');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu mới phải từ 8 ký tự');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const user = await this.userRepo.findOne({
      where: { username: normalizedUsername },
    });
    if (!user || (user.email || '').trim().toLowerCase() !== normalizedEmail) {
      throw new BadRequestException('Thông tin xác thực không hợp lệ');
    }

    const session = this.forgotPasswordOtps.get(user.id);
    if (!session || session.email !== normalizedEmail) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (Date.now() > session.expiresAt) {
      this.forgotPasswordOtps.delete(user.id);
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (!this.pbkdf2.verifySecret(otp, session.otpHash)) {
      session.failedAttempts += 1;
      if (session.failedAttempts >= 5) {
        this.forgotPasswordOtps.delete(user.id);
      } else {
        this.forgotPasswordOtps.set(user.id, session);
      }

      await this.auditService.log(
        'FORGOT_PASSWORD_CONFIRM_FAIL',
        user.id,
        user.id,
        ip,
        'Wrong OTP',
      );

      throw new BadRequestException('OTP không đúng');
    }

    if (this.pbkdf2.verifySecret(newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    user.passwordHash = this.pbkdf2.hashSecret(newPassword, 'password');
    user.forcePasswordChange = 0;
    await this.userRepo.save(user);
    this.forgotPasswordOtps.delete(user.id);

    await this.auditService.log(
      'FORGOT_PASSWORD_SUCCESS',
      user.id,
      user.id,
      ip,
      'Password reset via OTP',
    );

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
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

  private generateOtpCode() {
    return `${crypto.randomInt(0, 1_000_000)}`.padStart(6, '0');
  }
}
