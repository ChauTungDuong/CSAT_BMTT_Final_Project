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
import { AccountCryptoService } from '../../crypto/services/account-crypto.service';
import { MaskingEngine } from '../../masking/masking.engine';
import { AuditService } from '../../audit/audit.service';
import { Role } from '../../common/types/role.enum';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    private aes: AesService,
    private accountCrypto: AccountCryptoService,
    private masking: MaskingEngine,
    private audit: AuditService,
  ) {}

  // Lấy danh sách tài khoản của customer đang đăng nhập
  async getMyAccounts(userId: string, ip: string) {
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
        const accountNumberPlain =
          await this.accountCrypto.decryptAccountNumberForUser(
            userId,
            this.aes.deserialize(acc.accountNumber as Buffer),
          );

        const ownerBalancePlain = await this.aes.decryptForUser(
          userId,
          this.aes.deserialize(acc.balance as Buffer),
        );

        const balanceMasked = ownerBalancePlain
          ? this.masking.mask(
              ownerBalancePlain,
              'balance',
              Role.CUSTOMER,
              false,
            )
          : '••••••';

        const formattedBalance = `${parseFloat(ownerBalancePlain || '0').toLocaleString('vi-VN')} đ`;

        return {
          id: acc.id,
          // Số tài khoản là field độc lập, luôn hiển thị cho owner
          accountNumber: accountNumberPlain ?? 'N/A',
          accountType: acc.accountType,
          balance: formattedBalance,
          balanceMasked,
          isPinVerified: false,
          createdAt: acc.createdAt,
        };
      }),
    );
  }

  async findAccountById(accountId: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { id: accountId } });
  }

  async findAccountByNumber(accountNumber: string): Promise<Account | null> {
    const accountNumberHash =
      this.accountCrypto.hashAccountNumber(accountNumber);
    return this.accountRepo.findOne({ where: { accountNumberHash } });
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
