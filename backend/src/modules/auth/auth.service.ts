import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { decryptGCM, encryptGCM } from '../../crypto/aes-gcm';
import { UserDekRuntimeService } from '../../crypto/services/user-dek-runtime.service';
import { UserKeyDerivationService } from '../../crypto/services/user-key-derivation.service';
import { UserKeyMetadataService } from '../../crypto/services/user-key-metadata.service';
import { EmailCryptoService } from '../../crypto/services/email-crypto.service';
import { MailService } from '../customers/mail.service';
import { SessionRegistryService } from './services/session-registry.service';

@Injectable()
export class AuthService {
  private readonly recoveryWrapKey: Buffer | null;

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
    private config: ConfigService,
    private jwtService: JwtService,
    private auditService: AuditService,
    private aesService: AesService,
    private accountCrypto: AccountCryptoService,
    private pbkdf2: Pbkdf2Service,
    private userDekRuntime: UserDekRuntimeService,
    private userKeyDerivation: UserKeyDerivationService,
    private userKeyMetadata: UserKeyMetadataService,
    private emailCrypto: EmailCryptoService,
    private sessionRegistry: SessionRegistryService,
    private mailService: MailService,
  ) {
    const recoveryKeyHex = (this.config.get<string>('DEK_RECOVERY_KEY') || '')
      .trim()
      .toLowerCase();
    this.recoveryWrapKey =
      recoveryKeyHex.length === 64 ? Buffer.from(recoveryKeyHex, 'hex') : null;
  }

  async register(dto: RegisterDto, ip: string) {
    const normalizedEmail = this.emailCrypto.normalizeEmail(dto.email);
    const emailHash = this.emailCrypto.hashEmail(normalizedEmail);

    const existsByUsername = await this.userRepo.findOne({
      where: { username: dto.username },
    });
    const existsByEmail = await this.userRepo.findOne({
      where: { emailHash },
    });

    const exists = existsByUsername || existsByEmail;
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
      email: this.emailCrypto.encryptEmail(normalizedEmail),
      emailHash,
      fullName: dto.fullName,
      passwordFailedAttempts: 0,
      forgotOtpFailedAttempts: 0,
      passwordLocked: 0,
      passwordLockedAt: null,
      lockReason: 'NONE',
    });
    await this.userRepo.save(user);

    await this.initializeFreshUserDek(userId, dto.password, 'active');

    const encPhone = await this.aesService.encryptForUser(userId, dto.phone);
    const encCccd = await this.aesService.encryptForUser(userId, dto.cccd);
    const normalizedDob = this.normalizeDateOfBirth(dto.dateOfBirth);
    const encDob = await this.aesService.encryptForUser(userId, normalizedDob);
    const encAddr = await this.aesService.encryptForUser(userId, dto.address);

    const customer = this.customerRepo.create({
      id: customerId,
      userId: userId,
      fullName: dto.fullName,
      email: this.emailCrypto.encryptEmail(normalizedEmail),
      emailHash,
      phone: this.aesService.serialize(encPhone),
      cccd: this.aesService.serialize(encCccd),
      dateOfBirth: this.aesService.serialize(encDob),
      address: this.aesService.serialize(encAddr),
    });
    await this.customerRepo.save(customer);

    // Encrypt account number and store with hash
    const encAccountNumber =
      await this.accountCrypto.encryptAccountNumberForUser(
        userId,
        dto.accountNumber,
      );
    const encBalance = await this.aesService.encryptForUser(userId, '0');
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
        } else if (user.passwordLocked) {
          lockMessage =
            'Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Vui lòng liên hệ quản trị viên để mở khóa';
        } else if (user.lockReason === 'FORGOT_OTP_ATTEMPT') {
          lockMessage =
            'Tài khoản đã bị khóa do xác thực OTP đặt lại mật khẩu thất bại quá nhiều lần. Vui lòng liên hệ quản trị viên để mở khóa';
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
      if (user) {
        user.passwordFailedAttempts = (user.passwordFailedAttempts || 0) + 1;
        if (user.passwordFailedAttempts >= 5) {
          user.passwordLocked = 1;
          user.passwordLockedAt = new Date();
          user.isActive = 0;
          user.lockReason = 'WRONG_PASSWORD';
          await this.auditService.log(
            'PASSWORD_LOCKED',
            user.id,
            user.id,
            ip,
            'Account locked after 5 wrong password attempts',
          );
        }
        await this.userRepo.save(user);
      }

      await this.auditService.log(
        'LOGIN_FAIL',
        user?.id || null,
        null,
        ip,
        `Username: ${dto.username}`,
      );
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    if (user.passwordFailedAttempts > 0) {
      user.passwordFailedAttempts = 0;
      await this.userRepo.save(user);
    }

    if (user.role === 'customer') {
      await this.ensureUserDekRuntime(user.id, dto.password);
    }

    const sid = this.sessionRegistry.issueSession(user.id);

    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      sid,
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
    const resolvedEmail = this.resolveUserEmail(user);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: resolvedEmail,
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
      const normalizedEmail = this.emailCrypto.normalizeEmail(data.email);
      if (!normalizedEmail) {
        throw new BadRequestException('Email không được để trống');
      }

      const emailHash = this.emailCrypto.hashEmail(normalizedEmail);
      const existingEmail = await this.userRepo.findOne({
        where: { emailHash },
      });

      if (existingEmail && existingEmail.id !== userId) {
        throw new ConflictException('Email đã tồn tại');
      }

      user.email = this.emailCrypto.encryptEmail(normalizedEmail);
      user.emailHash = emailHash;
      if (customer) customer.email = this.emailCrypto.encryptEmail(normalizedEmail);
      if (customer) {
        customer.emailHash = emailHash;
      }
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
    const normalizedEmail = this.emailCrypto.normalizeEmail(email || '');

    if (!normalizedUsername || !normalizedEmail) {
      throw new BadRequestException('Vui lòng nhập tên đăng nhập và email');
    }

    const user = await this.userRepo.findOne({
      where: { username: normalizedUsername },
    });

    if (!user || this.resolveUserEmail(user) !== normalizedEmail) {
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
    const normalizedEmail = this.emailCrypto.normalizeEmail(email || '');

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
    if (!user || this.resolveUserEmail(user) !== normalizedEmail) {
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
      user.forgotOtpFailedAttempts = (user.forgotOtpFailedAttempts || 0) + 1;
      if (user.forgotOtpFailedAttempts >= 5) {
        user.isActive = 0;
        user.lockReason = 'FORGOT_OTP_ATTEMPT';
        user.passwordLocked = 1;
        user.passwordLockedAt = new Date();
      }
      await this.userRepo.save(user);

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

    if (user.forgotOtpFailedAttempts > 0) {
      user.forgotOtpFailedAttempts = 0;
      await this.userRepo.save(user);
    }

    if (this.pbkdf2.verifySecret(newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    await this.recoverAndRewrapUserDek(user.id, newPassword);

    user.passwordHash = this.pbkdf2.hashSecret(newPassword, 'password');
    user.forcePasswordChange = 0;
    await this.userRepo.save(user);

    this.sessionRegistry.invalidateSession(user.id);
    this.userDekRuntime.clearUserDek(user.id);
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

    if (this.pbkdf2.verifySecret(newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    await this.rewrapUserDek(userId, currentPassword, newPassword);

    user.passwordHash = this.pbkdf2.hashSecret(newPassword, 'password');
    user.forcePasswordChange = 0;
    await this.userRepo.save(user);

    this.sessionRegistry.invalidateSession(userId);
    this.userDekRuntime.clearUserDek(userId);

    await this.auditService.log(
      'CHANGE_PASSWORD',
      userId,
      userId,
      ip,
      'Password changed by user',
    );

    return { message: 'Đổi mật khẩu thành công' };
  }

  async logout(userId: string, ip: string) {
    this.sessionRegistry.invalidateSession(userId);
    await this.auditService.log('LOGOUT', userId, userId, ip, 'User logout');
    return { message: 'Đăng xuất thành công' };
  }

  private resolveUserEmail(user: User): string {
    return this.emailCrypto.readEmail(user.email);
  }

  private async ensureUserDekRuntime(
    userId: string,
    password: string,
  ): Promise<void> {
    let metadata = await this.userKeyMetadata.findByUserId(userId);

    if (!metadata) {
      await this.initializeFreshUserDek(userId, password, 'legacy');
      return;
    }

    const dek = this.unwrapDekWithPassword(
      metadata.wrappedDekB64,
      password,
      metadata.kdfSaltHex,
      metadata.kdfIterations,
    );

    if (!dek) {
      // Password reset flow may make old wrapped DEK unusable.
      await this.initializeFreshUserDek(userId, password, 'legacy');
      metadata = await this.userKeyMetadata.findByUserId(userId);
      if (!metadata) return;
      const refreshedDek = this.unwrapDekWithPassword(
        metadata.wrappedDekB64,
        password,
        metadata.kdfSaltHex,
        metadata.kdfIterations,
      );
      if (!refreshedDek) return;
      this.userDekRuntime.setUserDek(userId, refreshedDek);
      return;
    }

    this.userDekRuntime.setUserDek(userId, dek);
  }

  private async initializeFreshUserDek(
    userId: string,
    password: string,
    migrationState: string,
  ): Promise<void> {
    const kdfIterations = 310000;
    const kdfSaltHex = this.userKeyDerivation.generateSaltHex(16);
    const dek = crypto.randomBytes(32);
    const wrappedDekB64 = this.wrapDekWithPassword(
      dek,
      password,
      kdfSaltHex,
      kdfIterations,
    );

    await this.userKeyMetadata.upsertMetadata({
      userId,
      kdfAlgo: 'pbkdf2-sha256',
      kdfIterations,
      kdfSaltHex,
      wrappedDekB64,
      recoveryWrappedDekB64: this.wrapDekWithRecoveryKey(dek),
      keyVersion: 1,
      passwordEpoch: 1,
      migrationState,
    });

    this.userDekRuntime.setUserDek(userId, dek);
  }

  private async rewrapUserDek(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const metadata = await this.userKeyMetadata.findByUserId(userId);
    if (!metadata) {
      await this.initializeFreshUserDek(userId, newPassword, 'legacy');
      return;
    }

    const currentDek =
      this.userDekRuntime.getUserDek(userId) ||
      this.unwrapDekWithPassword(
        metadata.wrappedDekB64,
        currentPassword,
        metadata.kdfSaltHex,
        metadata.kdfIterations,
      );

    if (!currentDek) {
      await this.initializeFreshUserDek(userId, newPassword, 'legacy');
      return;
    }

    const newSaltHex = this.userKeyDerivation.generateSaltHex(16);
    const wrappedDekB64 = this.wrapDekWithPassword(
      currentDek,
      newPassword,
      newSaltHex,
      metadata.kdfIterations,
    );

    await this.userKeyMetadata.upsertMetadata({
      userId,
      kdfAlgo: metadata.kdfAlgo,
      kdfIterations: metadata.kdfIterations,
      kdfSaltHex: newSaltHex,
      wrappedDekB64,
      recoveryWrappedDekB64:
        this.wrapDekWithRecoveryKey(currentDek) ??
        metadata.recoveryWrappedDekB64,
      keyVersion: metadata.keyVersion,
      passwordEpoch: (metadata.passwordEpoch || 1) + 1,
      migrationState: metadata.migrationState,
    });

    this.userDekRuntime.setUserDek(userId, currentDek);
  }

  private async recoverAndRewrapUserDek(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const metadata = await this.userKeyMetadata.findByUserId(userId);
    if (!metadata) {
      await this.initializeFreshUserDek(userId, newPassword, 'legacy');
      return;
    }

    const recoveredDek = this.unwrapDekWithRecoveryKey(
      metadata.recoveryWrappedDekB64,
    );
    if (!recoveredDek) {
      await this.auditService.log(
        'FORGOT_PASSWORD_RECOVERY_FALLBACK',
        userId,
        userId,
        'SYSTEM',
        'Recovery key unavailable or wrapped DEK missing. Generated fresh DEK.',
      );
      await this.initializeFreshUserDek(userId, newPassword, 'legacy');
      return;
    }

    const newSaltHex = this.userKeyDerivation.generateSaltHex(16);
    const wrappedDekB64 = this.wrapDekWithPassword(
      recoveredDek,
      newPassword,
      newSaltHex,
      metadata.kdfIterations,
    );

    await this.userKeyMetadata.upsertMetadata({
      userId,
      kdfAlgo: metadata.kdfAlgo,
      kdfIterations: metadata.kdfIterations,
      kdfSaltHex: newSaltHex,
      wrappedDekB64,
      recoveryWrappedDekB64:
        this.wrapDekWithRecoveryKey(recoveredDek) ??
        metadata.recoveryWrappedDekB64,
      keyVersion: metadata.keyVersion,
      passwordEpoch: (metadata.passwordEpoch || 1) + 1,
      migrationState: metadata.migrationState,
    });

    this.userDekRuntime.setUserDek(userId, recoveredDek);
  }

  private wrapDekWithPassword(
    dek: Buffer,
    password: string,
    saltHex: string,
    iterations: number,
  ): Buffer {
    const kek = this.userKeyDerivation.deriveKek(
      password,
      saltHex,
      iterations,
      32,
    );
    const iv = crypto.randomBytes(12);
    const { ciphertext, authTag } = encryptGCM(kek, iv, dek);
    return Buffer.from(
      JSON.stringify({
        iv: Buffer.from(iv).toString('base64'),
        tag: Buffer.from(authTag).toString('base64'),
        payload: Buffer.from(ciphertext).toString('base64'),
      }),
      'utf8',
    );
  }

  private unwrapDekWithPassword(
    wrappedDekB64: Buffer,
    password: string,
    saltHex: string,
    iterations: number,
  ): Buffer | null {
    try {
      const wrapped = JSON.parse(wrappedDekB64.toString('utf8')) as {
        iv: string;
        tag: string;
        payload: string;
      };

      const kek = this.userKeyDerivation.deriveKek(
        password,
        saltHex,
        iterations,
        32,
      );

      const plain = decryptGCM(
        kek,
        Buffer.from(wrapped.iv, 'base64'),
        Buffer.from(wrapped.payload, 'base64'),
        Buffer.from(wrapped.tag, 'base64'),
      );
      return Buffer.from(plain);
    } catch {
      return null;
    }
  }

  private wrapDekWithRecoveryKey(dek: Buffer): Buffer | null {
    if (!this.recoveryWrapKey) return null;
    const iv = crypto.randomBytes(12);
    const { ciphertext, authTag } = encryptGCM(this.recoveryWrapKey, iv, dek);
    return Buffer.from(
      JSON.stringify({
        iv: Buffer.from(iv).toString('base64'),
        tag: Buffer.from(authTag).toString('base64'),
        payload: Buffer.from(ciphertext).toString('base64'),
      }),
      'utf8',
    );
  }

  private unwrapDekWithRecoveryKey(
    wrappedDekB64?: Buffer | null,
  ): Buffer | null {
    if (!this.recoveryWrapKey || !wrappedDekB64) return null;
    try {
      const wrapped = JSON.parse(wrappedDekB64.toString('utf8')) as {
        iv: string;
        tag: string;
        payload: string;
      };
      const plain = decryptGCM(
        this.recoveryWrapKey,
        Buffer.from(wrapped.iv, 'base64'),
        Buffer.from(wrapped.payload, 'base64'),
        Buffer.from(wrapped.tag, 'base64'),
      );
      return Buffer.from(plain);
    } catch {
      return null;
    }
  }

  private generateOtpCode() {
    return `${crypto.randomInt(0, 1_000_000)}`.padStart(6, '0');
  }
}
