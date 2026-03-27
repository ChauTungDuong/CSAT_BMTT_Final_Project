import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Card } from '../accounts/entities/card.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AesService } from '../../crypto/services/aes.service';
import { AuditService } from '../../audit/audit.service';
import { MaskingEngine } from '../../masking/masking.engine';
import { Role } from '../../common/types/role.enum';
import { CreateCardDto } from './dto/card.dto';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card) private cardRepo: Repository<Card>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    private aes: AesService,
    private audit: AuditService,
    private masking: MaskingEngine,
  ) {}

  // ── MỞ THẺ ẢO MỚI ──────────────────────────────────────────────
  async createCard(userId: string, dto: CreateCardDto, ip: string) {
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer) throw new NotFoundException('Hồ sơ khách hàng không tồn tại');

    // Xác thực PIN
    if (!customer.pinHash || !(await bcrypt.compare(dto.pin, customer.pinHash))) {
      await this.audit.log('CARD_CREATE_FAIL', userId, null, ip, 'Sai mã PIN');
      throw new ForbiddenException('Mã PIN không hợp lệ');
    }

    // Kiểm tra giới hạn 3 thẻ
    const cardCount = await this.cardRepo.count({
      where: { customerId: customer.id, isActive: 1 },
    });
    if (cardCount >= 3) {
      throw new BadRequestException('Bạn chỉ được phép mở tối đa 3 thẻ ảo');
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
    if (!customer) throw new NotFoundException('Hồ sơ khách hàng không tồn tại');

    const cards = await this.cardRepo.find({
      where: { customerId: customer.id, isActive: 1 },
    });

    await this.audit.log('VIEW_CARDS', userId, customer.id, ip, '');

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
    if (!customer) throw new NotFoundException('Hồ sơ khách hàng không tồn tại');

    // Xác thực PIN
    if (!customer.pinHash || !(await bcrypt.compare(pin, customer.pinHash))) {
      await this.audit.log('CARD_REVEAL_FAIL', userId, cardId, ip, 'Sai mã PIN');
      throw new ForbiddenException('Mã PIN không hợp lệ');
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
