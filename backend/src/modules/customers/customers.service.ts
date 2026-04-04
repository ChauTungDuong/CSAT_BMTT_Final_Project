import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Customer } from './entities/customer.entity';
import { User } from '../auth/entities/user.entity';
import { AesService } from '../../crypto/services/aes.service';
import { MaskingEngine, FieldType } from '../../masking/masking.engine';
import { AuditService } from '../../audit/audit.service';
import { MailService } from './mail.service';
import { Role } from '../../common/types/role.enum';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Pbkdf2Service } from '../../crypto/services/pbkdf2.service';
import { EmailCryptoService } from '../../crypto/services/email-crypto.service';

@Injectable()
export class CustomersService {
  private readonly pinViewSessions = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  private readonly pinChangeOtpSessions = new Map<
    string,
    {
      otpHash: string;
      expiresAt: number;
      failedAttempts: number;
    }
  >();

  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private aes: AesService,
    private masking: MaskingEngine,
    private audit: AuditService,
    private mailService: MailService,
    private pbkdf2: Pbkdf2Service,
    private emailCrypto: EmailCryptoService,
  ) {}

  // ── TẠO PROFILE KHÁCH HÀNG ───────────────────────────────────
  async createProfile(userId: string, dto: CreateCustomerDto, ip: string) {
    const existing = await this.customerRepo.findOne({ where: { userId } });
    if (existing) throw new BadRequestException('Hồ sơ khách hàng đã tồn tại');

    const [phone, cccd, dob, address] = await Promise.all([
      this.aes.encrypt(dto.phone),
      this.aes.encrypt(dto.cccd),
      this.aes.encrypt(dto.dateOfBirth),
      this.aes.encrypt(dto.address),
    ]);

    const pinHash = dto.pin ? this.pbkdf2.hashSecret(dto.pin, 'pin') : null;
    const id = `CUST-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;

    const customer = this.customerRepo.create({
      id,
      userId,
      fullName: dto.fullName,
      email: this.emailCrypto.encryptEmail(dto.email),
      emailHash: this.emailCrypto.hashEmail(dto.email),
      phone: this.aes.serialize(phone),
      cccd: this.aes.serialize(cccd),
      dateOfBirth: this.aes.serialize(dob),
      address: this.aes.serialize(address),
      pinHash,
    });

    await this.customerRepo.save(customer);
    await this.audit.log(
      'CREATE_PROFILE',
      userId,
      customer.id,
      ip,
      'Profile created',
    );
    return { message: 'Tạo hồ sơ thành công', customerId: customer.id };
  }

  // ── LẤY CUSTOMER ID TỪ USER ID ───────────────────────────────
  async getCustomerIdByUserId(userId: string): Promise<string | null> {
    const c = await this.customerRepo.findOne({ where: { userId } });
    return c?.id || null;
  }

  // ── XEM PROFILE (có masking) ──────────────────────────────────
  async getProfile(
    customerId: string,
    viewerId: string,
    viewerRole: Role,
    ip: string,
    viewToken?: string,
  ) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const isOwner = customer.userId === viewerId;
    if (!isOwner && viewerRole === Role.ADMIN) {
      throw new ForbiddenException(
        'Tạm thời ẩn chức năng admin xem chi tiết người dùng theo chính sách bảo mật',
      );
    }

    const canDecrypt = isOwner;

    const [phone, cccd, dob, address] = canDecrypt
      ? await Promise.all([
          this.aes.decrypt(this.aes.deserialize(customer.phone as Buffer)),
          this.aes.decrypt(this.aes.deserialize(customer.cccd as Buffer)),
          this.aes.decrypt(
            this.aes.deserialize(customer.dateOfBirth as Buffer),
          ),
          this.aes.decrypt(this.aes.deserialize(customer.address as Buffer)),
        ])
      : [null, null, null, null];

    const roleToUse = isOwner ? Role.CUSTOMER : viewerRole;
    const pinMode = isOwner && this.isPinViewSessionValid(viewerId, viewToken);

    return {
      id: customer.id,
      fullName: customer.fullName,
      email: this.masking.mask(
        this.emailCrypto.readEmail(customer.email),
        'email',
        roleToUse,
        pinMode,
      ),
      phone: phone
        ? this.masking.mask(phone, 'phone', roleToUse, pinMode)
        : this.masking.mask('', 'phone', roleToUse),
      cccd: cccd
        ? this.masking.mask(cccd, 'cccd', roleToUse, pinMode)
        : this.masking.mask('', 'cccd', roleToUse),
      dateOfBirth: dob
        ? this.masking.mask(dob, 'date_of_birth', roleToUse, pinMode)
        : '**/**/****',
      address: address
        ? this.masking.mask(address, 'address', roleToUse, pinMode)
        : '***',
      isPinVerified: pinMode,
      hasPin: !!customer.pinHash,
    };
  }

  // ── CẬP NHẬT PROFILE ─────────────────────────────────────────
  async updateProfile(
    customerId: string,
    userId: string,
    dto: UpdateCustomerDto,
    ip: string,
    viewToken?: string,
  ) {
    if (!this.isPinViewSessionValid(userId, viewToken)) {
      throw new ForbiddenException(
        'Vui lòng xác thực PIN trước khi cập nhật hồ sơ',
      );
    }

    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    if (dto.fullName !== undefined) {
      const normalizedName = dto.fullName.trim();
      if (!normalizedName) {
        throw new BadRequestException('Họ và tên không được để trống');
      }
      customer.fullName = normalizedName;
      user.fullName = normalizedName;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = this.emailCrypto.normalizeEmail(dto.email);
      if (!normalizedEmail) {
        throw new BadRequestException('Email không được để trống');
      }

      const emailHash = this.emailCrypto.hashEmail(normalizedEmail);

      const existingEmail = await this.userRepo.findOne({
        where: { emailHash },
      });
      if (existingEmail) {
        if (existingEmail.id !== userId) {
          throw new BadRequestException('Email đã tồn tại');
        }
      }

      customer.email = this.emailCrypto.encryptEmail(normalizedEmail);
      customer.emailHash = emailHash;
      user.email = this.emailCrypto.encryptEmail(normalizedEmail);
      user.emailHash = emailHash;
    }

    if (dto.dateOfBirth !== undefined)
      customer.dateOfBirth = this.aes.serialize(
        await this.aes.encrypt(this.normalizeDateOfBirth(dto.dateOfBirth)),
      );

    if (dto.address !== undefined)
      customer.address = this.aes.serialize(
        await this.aes.encrypt(dto.address.trim()),
      );

    await this.userRepo.save(user);
    await this.customerRepo.save(customer);
    await this.audit.log(
      'UPDATE_PROFILE',
      userId,
      customerId,
      ip,
      'Profile updated (PIN-verified session)',
    );
    return { message: 'Cập nhật hồ sơ thành công' };
  }

  // ── XÁC THỰC PIN 6 SỐ ────────────────────────────────────────
  async verifyPin(
    customerId: string,
    userId: string,
    pin: string,
    ip: string,
  ): Promise<{
    verified: boolean;
    locked: boolean;
    remainingAttempts: number;
    message: string;
  }> {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer || !customer.pinHash) {
      return {
        verified: false,
        locked: false,
        remainingAttempts: 0,
        message: 'PIN chưa được thiết lập',
      };
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive || customer.pinLocked) {
      await this.audit.log(
        'PIN_VERIFY_LOCKED',
        userId,
        customerId,
        ip,
        'PIN verify blocked because account is locked',
      );
      throw new ForbiddenException({
        message: 'Tài khoản đã bị khóa vì nhập sai PIN quá 5 lần',
        locked: true,
        remainingAttempts: 0,
      });
    }

    const valid = this.pbkdf2.verifySecret(pin, customer.pinHash);
    if (!valid) {
      customer.pinFailedAttempts = (customer.pinFailedAttempts || 0) + 1;
      const remainingAttempts = Math.max(0, 5 - customer.pinFailedAttempts);

      if (customer.pinFailedAttempts >= 5) {
        customer.pinLocked = 1;
        customer.pinLockedAt = new Date();
        user.isActive = 0;
        user.lockReason = 'PIN_ATTEMPT';
        await this.userRepo.save(user);

        await this.audit.log(
          'PIN_LOCKED',
          userId,
          customerId,
          ip,
          'Account locked after 5 wrong PIN attempts',
        );
      }

      await this.customerRepo.save(customer);

      await this.audit.log(
        'PIN_VERIFY_FAIL',
        userId,
        customerId,
        ip,
        `Wrong PIN attempt ${customer.pinFailedAttempts}/5`,
      );

      return {
        verified: false,
        locked: customer.pinFailedAttempts >= 5,
        remainingAttempts,
        message:
          customer.pinFailedAttempts >= 5
            ? 'Tài khoản đã bị khóa vì nhập sai PIN quá 5 lần'
            : `PIN không đúng. Bạn còn ${remainingAttempts} lần thử.`,
      };
    } else if (customer.pinFailedAttempts > 0 || customer.pinLocked) {
      customer.pinFailedAttempts = 0;
      customer.pinLocked = 0;
      customer.pinLockedAt = null;
      await this.customerRepo.save(customer);
    }

    await this.audit.log(
      'PIN_VERIFY_SUCCESS',
      userId,
      customerId,
      ip,
      'PIN verified',
    );
    return {
      verified: true,
      locked: false,
      remainingAttempts: 5,
      message: 'PIN verified',
    };
  }

  createPinViewSession(userId: string) {
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 2 * 60 * 1000;
    this.pinViewSessions.set(userId, { token, expiresAt });

    return {
      viewToken: token,
      expiresAt: new Date(expiresAt).toISOString(),
      ttlSeconds: 120,
    };
  }

  private isPinViewSessionValid(userId: string, token?: string) {
    if (!token) return false;
    const session = this.pinViewSessions.get(userId);
    if (!session) return false;
    if (session.token !== token) return false;
    if (Date.now() > session.expiresAt) {
      this.pinViewSessions.delete(userId);
      return false;
    }
    return true;
  }

  isPinViewTokenValid(userId: string, token?: string) {
    return this.isPinViewSessionValid(userId, token);
  }

  // ── CÀI ĐẶT PIN (Lần Đầu) ──────────────────────────────────────
  async setupPin(
    customerId: string,
    userId: string,
    passwordStr: string,
    newPin: string,
    ip: string,
  ) {
    if (!/^\d{6}$/.test(newPin)) {
      throw new BadRequestException('PIN phải là 6 chữ số');
    }
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    if (customer.pinHash) {
      throw new BadRequestException(
        'Mã PIN đã được cài đặt. Không thể tạo lại.',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    const validPwd = this.pbkdf2.verifySecret(passwordStr, user.passwordHash);
    if (!validPwd) {
      await this.audit.log(
        'PIN_SETUP_FAIL',
        userId,
        customerId,
        ip,
        'Wrong password during PIN setup',
      );
      throw new BadRequestException('Mật khẩu không đúng');
    }

    customer.pinHash = this.pbkdf2.hashSecret(newPin, 'pin');
    customer.pinFailedAttempts = 0;
    customer.pinLocked = 0;
    customer.pinLockedAt = null;
    await this.customerRepo.save(customer);

    // Gửi email
    const setupRecipient = this.emailCrypto.readEmail(customer.email);
    if (setupRecipient) {
      await this.mailService.sendPinSetupEmail(setupRecipient);
    }

    await this.audit.log(
      'PIN_SETUP_SUCCESS',
      userId,
      customerId,
      ip,
      'PIN setup initially',
    );
    return { message: 'Cài đặt PIN thành công' };
  }

  // ── ĐẶT/ĐỔI PIN ──────────────────────────────────────────────
  async setPin(customerId: string, userId: string, newPin: string, ip: string) {
    if (!/^\d{6}$/.test(newPin)) {
      throw new BadRequestException('PIN phải là 6 chữ số');
    }
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    // Đổi PIN đã có phải đi qua quy trình OTP 2 bước.
    if (customer.pinHash) {
      throw new BadRequestException(
        'Vui lòng dùng quy trình đổi PIN mới (xác thực mật khẩu + OTP)',
      );
    }

    customer.pinHash = this.pbkdf2.hashSecret(newPin, 'pin');
    customer.pinFailedAttempts = 0;
    customer.pinLocked = 0;
    customer.pinLockedAt = null;
    await this.customerRepo.save(customer);
    await this.audit.log('PIN_CHANGED', userId, customerId, ip, 'PIN updated');
    return { message: 'Đổi PIN thành công' };
  }

  async requestPinChangeOtp(
    customerId: string,
    userId: string,
    currentPassword: string,
    currentPin: string,
    ip: string,
  ) {
    if (!currentPassword?.trim()) {
      throw new BadRequestException('Vui lòng nhập mật khẩu hiện tại');
    }

    if (!/^[\d]{6}$/.test(currentPin || '')) {
      throw new BadRequestException('PIN hiện tại không hợp lệ');
    }

    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    if (!customer.pinHash) {
      throw new BadRequestException('Bạn chưa thiết lập PIN');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    if (!this.pbkdf2.verifySecret(currentPassword, user.passwordHash)) {
      await this.audit.log(
        'PIN_CHANGE_OTP_REQUEST_FAIL',
        userId,
        customerId,
        ip,
        'Current password mismatch',
      );
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    if (!this.pbkdf2.verifySecret(currentPin, customer.pinHash)) {
      await this.audit.log(
        'PIN_CHANGE_OTP_REQUEST_FAIL',
        userId,
        customerId,
        ip,
        'Current PIN mismatch',
      );
      throw new BadRequestException('PIN hiện tại không đúng');
    }

    const recipient =
      this.emailCrypto.readEmail(customer.email) ||
      this.emailCrypto.readEmail(user.email);
    if (!recipient) {
      throw new BadRequestException('Không tìm thấy email để gửi OTP');
    }

    const otp = this.generateOtpCode();
    this.pinChangeOtpSessions.set(userId, {
      otpHash: this.pbkdf2.hashSecret(otp, 'pin'),
      expiresAt: Date.now() + 5 * 60 * 1000,
      failedAttempts: 0,
    });

    try {
      await this.mailService.sendPinChangeOtpEmail(recipient, otp);
    } catch {
      this.pinChangeOtpSessions.delete(userId);
      throw new BadRequestException(
        'Không thể gửi OTP lúc này. Vui lòng thử lại sau.',
      );
    }

    await this.audit.log(
      'PIN_CHANGE_OTP_SENT',
      userId,
      customerId,
      ip,
      'PIN change OTP sent',
    );

    return {
      message: 'Đã gửi OTP xác thực đổi PIN tới email đăng ký.',
      otpRequired: true,
      otpExpiresInSeconds: 300,
    };
  }

  async confirmPinChangeOtp(
    customerId: string,
    userId: string,
    otp: string,
    newPin: string,
    confirmPin: string,
    ip: string,
  ) {
    if (!/^[\d]{6}$/.test(otp || '')) {
      throw new BadRequestException('OTP không hợp lệ');
    }

    if (!/^[\d]{6}$/.test(newPin || '')) {
      throw new BadRequestException('PIN mới phải gồm đúng 6 chữ số');
    }

    if (newPin !== confirmPin) {
      throw new BadRequestException('PIN xác nhận không khớp');
    }

    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer || !customer.pinHash) {
      throw new NotFoundException('Không tìm thấy PIN hiện tại');
    }

    const session = this.pinChangeOtpSessions.get(userId);
    if (!session) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (Date.now() > session.expiresAt) {
      this.pinChangeOtpSessions.delete(userId);
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (!this.pbkdf2.verifySecret(otp, session.otpHash)) {
      session.failedAttempts += 1;
      if (session.failedAttempts >= 5) {
        this.pinChangeOtpSessions.delete(userId);
      } else {
        this.pinChangeOtpSessions.set(userId, session);
      }

      await this.audit.log(
        'PIN_CHANGE_FAIL',
        userId,
        customerId,
        ip,
        'Wrong OTP',
      );

      throw new BadRequestException('OTP không đúng');
    }

    if (this.pbkdf2.verifySecret(newPin, customer.pinHash)) {
      throw new BadRequestException('PIN mới phải khác PIN hiện tại');
    }

    customer.pinHash = this.pbkdf2.hashSecret(newPin, 'pin');
    customer.pinFailedAttempts = 0;
    customer.pinLocked = 0;
    customer.pinLockedAt = null;
    await this.customerRepo.save(customer);
    this.pinChangeOtpSessions.delete(userId);

    await this.audit.log(
      'PIN_CHANGED',
      userId,
      customerId,
      ip,
      'PIN updated via OTP confirmation',
    );

    return { message: 'Đổi PIN thành công' };
  }

  // ── LẤY TẤT CẢ CUSTOMERS (cho Admin) ────────────────────────
  async findAll(page: number, limit: number) {
    const [items, total] = await this.customerRepo.findAndCount({
      select: ['id', 'userId', 'fullName', 'email', 'createdAt'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, limit };
  }

  private generateOtpCode() {
    return `${crypto.randomInt(0, 1_000_000)}`.padStart(6, '0');
  }

  private normalizeDateOfBirth(input: string): string {
    const value = (input || '').trim();
    const isoLike = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLike) {
      const [, year, month, day] = isoLike;
      return `${day}/${month}/${year}`;
    }

    const slash = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
      return value;
    }

    return value;
  }
}
