import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Card } from '../accounts/entities/card.entity';
import { Account } from '../accounts/entities/account.entity';
import { Customer } from '../customers/entities/customer.entity';
import { User } from '../auth/entities/user.entity';
import { AesService } from '../../crypto/services/aes.service';
import { AuditService } from '../../audit/audit.service';
import { MaskingEngine } from '../../masking/masking.engine';
import { Role } from '../../common/types/role.enum';
import { CreateCardDto } from './dto/card.dto';
import { Pbkdf2Service } from '../../crypto/services/pbkdf2.service';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card) private cardRepo: Repository<Card>,
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private aes: AesService,
    private audit: AuditService,
    private masking: MaskingEngine,
    private pbkdf2: Pbkdf2Service,
  ) {}

  // ── MỞ THẺ ẢO MỚI ──────────────────────────────────────────────
  async createCard(userId: string, dto: CreateCardDto, ip: string) {
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer)
      throw new NotFoundException('Hồ sơ khách hàng không tồn tại');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive || customer.pinLocked) {
      await this.audit.log(
        'CARD_CREATE_FAIL',
        userId,
        null,
        ip,
        'Tài khoản đang bị khóa',
      );
      throw new ForbiddenException('Tài khoản đang bị khóa');
    }

    // Xác thực PIN
    if (
      !customer.pinHash ||
      !this.pbkdf2.verifySecret(dto.pin, customer.pinHash)
    ) {
      customer.pinFailedAttempts = (customer.pinFailedAttempts || 0) + 1;
      if (customer.pinFailedAttempts >= 5) {
        customer.pinLocked = 1;
        customer.pinLockedAt = new Date();
        user.isActive = 0;
        await this.userRepo.save(user);
        await this.audit.log(
          'PIN_LOCKED',
          userId,
          customer.id,
          ip,
          'Account locked after 5 wrong PIN attempts',
        );
      }
      await this.customerRepo.save(customer);
      await this.audit.log('CARD_CREATE_FAIL', userId, null, ip, 'Sai mã PIN');
      throw new ForbiddenException('Mã PIN không hợp lệ');
    }

    if (customer.pinFailedAttempts > 0 || customer.pinLocked) {
      customer.pinFailedAttempts = 0;
      customer.pinLocked = 0;
      customer.pinLockedAt = null;
      await this.customerRepo.save(customer);
    }

    const account = await this.accountRepo.findOne({
      where: { id: dto.accountId, customerId: customer.id, isActive: 1 },
    });
    if (!account) {
      throw new BadRequestException(
        'Tài khoản không hợp lệ hoặc không thuộc về bạn',
      );
    }

    const activeCard = await this.cardRepo.findOne({
      where: { customerId: customer.id, isActive: 1 },
    });
    if (activeCard) {
      throw new BadRequestException(
        'Mỗi người dùng chỉ được phép có 1 thẻ đang hoạt động',
      );
    }

    // Tạo thông tin thẻ ngẫu nhiên
    const cardNumber = this.generateRandomNumber(16);
    const cvv = this.generateRandomNumber(3);
    const expiry = this.generateExpiryDate(5); // 5 năm sau

    const card = this.cardRepo.create({
      id: crypto.randomUUID(),
      customerId: customer.id,
      accountId: dto.accountId,
      cardNumber: this.aes.serialize(await this.aes.encrypt(cardNumber)),
      cvv: this.aes.serialize(await this.aes.encrypt(cvv)),
      cardExpiry: this.aes.serialize(await this.aes.encrypt(expiry)),
      isActive: 1,
    });

    await this.cardRepo.save(card);
    await this.audit.log(
      'CARD_CREATED',
      userId,
      card.id,
      ip,
      `Thẻ ${this.masking.mask(cardNumber, 'card_number', Role.CUSTOMER)} đã được tạo`,
    );

    return {
      message: 'Mở thẻ ảo thành công',
      cardId: card.id,
    };
  }

  // ── LẤY DANH SÁCH THẺ (MASKED) ───────────────────────────────
  async getMyCards(userId: string, ip: string) {
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer)
      throw new NotFoundException('Hồ sơ khách hàng không tồn tại');

    const cards = await this.cardRepo.find({
      where: { customerId: customer.id, isActive: 1 },
    });

    return Promise.all(
      cards.map(async (c) => {
        const cardNumberPlain = await this.aes.decrypt(
          this.aes.deserialize(c.cardNumber as Buffer),
        );
        const expiryPlain = await this.aes.decrypt(
          this.aes.deserialize(c.cardExpiry as Buffer),
        );

        return {
          id: c.id,
          cardNumber: this.masking.mask(
            cardNumberPlain || '',
            'card_number',
            Role.CUSTOMER,
            false,
          ),
          expiry: expiryPlain,
          createdAt: c.createdAt,
        };
      }),
    );
  }

  // ── XEM CHI TIẾT THẺ (UNMASKED - YÊU CẦU PIN) ────────────────
  async revealCard(userId: string, cardId: string, pin: string, ip: string) {
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer)
      throw new NotFoundException('Hồ sơ khách hàng không tồn tại');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive || customer.pinLocked) {
      await this.audit.log(
        'CARD_REVEAL_FAIL',
        userId,
        cardId,
        ip,
        'Tài khoản đang bị khóa',
      );
      throw new ForbiddenException('Tài khoản đang bị khóa');
    }

    // Xác thực PIN
    if (!customer.pinHash || !this.pbkdf2.verifySecret(pin, customer.pinHash)) {
      customer.pinFailedAttempts = (customer.pinFailedAttempts || 0) + 1;
      if (customer.pinFailedAttempts >= 5) {
        customer.pinLocked = 1;
        customer.pinLockedAt = new Date();
        user.isActive = 0;
        await this.userRepo.save(user);
        await this.audit.log(
          'PIN_LOCKED',
          userId,
          customer.id,
          ip,
          'Account locked after 5 wrong PIN attempts',
        );
      }
      await this.customerRepo.save(customer);
      await this.audit.log(
        'CARD_REVEAL_FAIL',
        userId,
        cardId,
        ip,
        'Sai mã PIN',
      );
      throw new ForbiddenException('Mã PIN không hợp lệ');
    }

    if (customer.pinFailedAttempts > 0 || customer.pinLocked) {
      customer.pinFailedAttempts = 0;
      customer.pinLocked = 0;
      customer.pinLockedAt = null;
      await this.customerRepo.save(customer);
    }

    const card = await this.cardRepo.findOne({
      where: { id: cardId, customerId: customer.id, isActive: 1 },
    });
    if (!card) throw new NotFoundException('Không tìm thấy thẻ của bạn');

    const [cardNumber, cvv, expiry] = await Promise.all([
      this.aes.decrypt(this.aes.deserialize(card.cardNumber as Buffer)),
      this.aes.decrypt(this.aes.deserialize(card.cvv as Buffer)),
      this.aes.decrypt(this.aes.deserialize(card.cardExpiry as Buffer)),
    ]);

    await this.audit.log('CARD_REVEAL_SUCCESS', userId, cardId, ip, '');

    return {
      cardNumber,
      cvv,
      expiry,
    };
  }

  private generateRandomNumber(length: number): string {
    let res = '';
    for (let i = 0; i < length; i++) {
      res += Math.floor(Math.random() * 10).toString();
    }
    return res;
  }

  private generateExpiryDate(yearsToAdd: number): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear() + yearsToAdd).slice(-2);
    return `${month}/${year}`;
  }
}
