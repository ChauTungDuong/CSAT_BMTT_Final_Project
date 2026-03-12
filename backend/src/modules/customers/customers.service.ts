import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Customer } from './entities/customer.entity';
import { AesService } from '../../crypto/services/aes.service';
import { MaskingEngine, FieldType } from '../../masking/masking.engine';
import { AuditService } from '../../audit/audit.service';
import { Role } from '../../common/types/role.enum';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    private aes: AesService,
    private masking: MaskingEngine,
    private audit: AuditService,
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

    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 12) : null;
    const id = `CUST-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;

    const customer = this.customerRepo.create({
      id,
      userId,
      fullName: dto.fullName,
      email: dto.email,
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
    isPinVerified: boolean,
    ip: string,
  ) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const isOwner = customer.userId === viewerId;
    const canDecrypt =
      isOwner || viewerRole === Role.TELLER || viewerRole === Role.ADMIN;

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
    const pinMode = isOwner && isPinVerified;

    await this.audit.log(
      'VIEW_PROFILE',
      viewerId,
      customerId,
      ip,
      `Role: ${viewerRole}, PinVerified: ${isPinVerified}`,
    );

    return {
      id: customer.id,
      fullName: customer.fullName,
      email: this.masking.mask(customer.email, 'email', roleToUse, pinMode),
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
  ) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    if (dto.fullName) customer.fullName = dto.fullName;
    if (dto.email) customer.email = dto.email;
    if (dto.phone)
      customer.phone = this.aes.serialize(await this.aes.encrypt(dto.phone));
    if (dto.cccd)
      customer.cccd = this.aes.serialize(await this.aes.encrypt(dto.cccd));
    if (dto.dateOfBirth)
      customer.dateOfBirth = this.aes.serialize(
        await this.aes.encrypt(dto.dateOfBirth),
      );
    if (dto.address)
      customer.address = this.aes.serialize(
        await this.aes.encrypt(dto.address),
      );

    await this.customerRepo.save(customer);
    await this.audit.log(
      'UPDATE_PROFILE',
      userId,
      customerId,
      ip,
      'Profile updated',
    );
    return { message: 'Cập nhật hồ sơ thành công' };
  }

  // ── XÁC THỰC PIN 6 SỐ ────────────────────────────────────────
  async verifyPin(
    customerId: string,
    userId: string,
    pin: string,
    ip: string,
  ): Promise<boolean> {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer || !customer.pinHash) return false;

    const valid = await bcrypt.compare(pin, customer.pinHash);
    await this.audit.log(
      valid ? 'PIN_VERIFY_SUCCESS' : 'PIN_VERIFY_FAIL',
      userId,
      customerId,
      ip,
      valid ? 'PIN verified' : 'Wrong PIN',
    );
    return valid;
  }

  // ── ĐẶT/ĐỔI PIN ──────────────────────────────────────────────
  async setPin(
    customerId: string,
    userId: string,
    newPin: string,
    ip: string,
    oldPin?: string,
  ) {
    if (!/^\d{6}$/.test(newPin)) {
      throw new BadRequestException('PIN phải là 6 chữ số');
    }
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, userId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    // Nếu đã có PIN thì phải xác thực PIN cũ
    if (customer.pinHash) {
      if (!oldPin) {
        throw new BadRequestException('Vui lòng nhập PIN cũ để đổi PIN mới');
      }
      const valid = await bcrypt.compare(oldPin, customer.pinHash);
      if (!valid) {
        await this.audit.log(
          'PIN_CHANGE_FAIL',
          userId,
          customerId,
          ip,
          'Wrong old PIN',
        );
        throw new BadRequestException('PIN cũ không đúng');
      }
    }

    customer.pinHash = await bcrypt.hash(newPin, 12);
    await this.customerRepo.save(customer);
    await this.audit.log('PIN_CHANGED', userId, customerId, ip, 'PIN updated');
    return { message: 'Đổi PIN thành công' };
  }

  // ── TÌM KIẾM (cho Teller) ─────────────────────────────────────
  async search(query: string) {
    const results = await this.customerRepo
      .createQueryBuilder('c')
      .where('UPPER(c.fullName) LIKE UPPER(:q)', { q: `%${query}%` })
      .orWhere('c.email LIKE :q', { q: `%${query}%` })
      .select(['c.id', 'c.fullName', 'c.email'])
      .limit(20)
      .getMany();
    return results.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: this.masking.mask(c.email || '', 'email', Role.TELLER),
    }));
  }

  // ── DANH SÁCH KHÁCH HÀNG CHO TELLER (có mask) ───────────────
  async listForTeller() {
    const all = await this.customerRepo.find({
      select: ['id', 'fullName', 'email'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return all.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: this.masking.mask(c.email || '', 'email', Role.TELLER),
    }));
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
}
