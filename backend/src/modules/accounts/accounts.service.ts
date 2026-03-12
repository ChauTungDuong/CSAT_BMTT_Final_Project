import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AesService } from '../../crypto/services/aes.service';
import { MaskingEngine } from '../../masking/masking.engine';
import { AuditService } from '../../audit/audit.service';
import { Role } from '../../common/types/role.enum';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    private aes: AesService,
    private masking: MaskingEngine,
    private audit: AuditService,
  ) {}

  // Lấy danh sách tài khoản của customer đang đăng nhập
  async getMyAccounts(userId: string, isPinVerified: boolean, ip: string) {
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer) throw new NotFoundException('Hồ sơ chưa được tạo');

    const accounts = await this.accountRepo.find({
      where: { customerId: customer.id, isActive: 1 },
    });

    await this.audit.log(
      'VIEW_ACCOUNTS',
      userId,
      customer.id,
      ip,
      'List accounts',
    );

    return Promise.all(
      accounts.map(async (acc) => {
        const balancePlain = await this.aes.decrypt(
          this.aes.deserialize(acc.balance as Buffer),
        );
        const cardNumberPlain = acc.cardNumber
          ? await this.aes.decrypt(
              this.aes.deserialize(acc.cardNumber as Buffer),
            )
          : null;

        const balanceMasked = balancePlain
          ? this.masking.mask(
              balancePlain,
              'balance',
              Role.CUSTOMER,
              isPinVerified,
            )
          : '••••••';
        const cardNumberMasked = cardNumberPlain
          ? this.masking.mask(
              cardNumberPlain,
              'card_number',
              Role.CUSTOMER,
              isPinVerified,
            )
          : null;

        return {
          id: acc.id,
          accountNumber: this.masking.mask(
            acc.accountNumber,
            'account_number',
            Role.CUSTOMER,
            isPinVerified,
          ),
          accountType: acc.accountType,
          balance: isPinVerified
            ? `${parseFloat(balancePlain || '0').toLocaleString('vi-VN')} đ`
            : balanceMasked,
          balanceMasked,
          cardNumber: cardNumberMasked,
          createdAt: acc.createdAt,
        };
      }),
    );
  }

  // Teller: xem tài khoản của một customer (balance ẩn)
  async getAccountsForTeller(customerId: string, tellerId: string, ip: string) {
    const accounts = await this.accountRepo.find({
      where: { customerId, isActive: 1 },
    });

    await this.audit.log('TELLER_VIEW_ACCOUNTS', tellerId, customerId, ip, '');

    return Promise.all(
      accounts.map(async (acc) => {
        const balancePlain = await this.aes.decrypt(
          this.aes.deserialize(acc.balance as Buffer),
        );
        return {
          id: acc.id,
          accountNumber: this.masking.mask(
            acc.accountNumber,
            'account_number',
            Role.TELLER,
          ),
          accountType: acc.accountType,
          balance: balancePlain
            ? this.masking.mask(balancePlain, 'balance', Role.TELLER)
            : '*** đ',
        };
      }),
    );
  }

  async findAccountById(accountId: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { id: accountId } });
  }

  async findAccountByNumber(accountNumber: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { accountNumber } });
  }

  // Kiểm tra account thuộc về customer
  async validateOwnership(accountId: string, userId: string): Promise<boolean> {
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer) return false;
    const account = await this.accountRepo.findOne({
      where: { id: accountId, customerId: customer.id },
    });
    return !!account;
  }
}
