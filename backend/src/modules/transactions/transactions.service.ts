import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Account } from '../accounts/entities/account.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Transaction } from './entities/transaction.entity';
import { AesService } from '../../crypto/services/aes.service';
import { AuditService } from '../../audit/audit.service';
import { TransferDto } from './dto/transfer.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private aes: AesService,
    private audit: AuditService,
    private dataSource: DataSource,
  ) {}

  async transfer(dto: TransferDto, userId: string, ip: string) {
    const toAccountNumber = dto.toAccountNumber.trim();

    if (dto.amount <= 0)
      throw new BadRequestException('Số tiền phải lớn hơn 0');

    // Kiểm tra fromAccount thuộc về user này và check PIN
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer)
      throw new NotFoundException('Hồ sơ khách hàng không tồn tại');

    if (
      !customer.pinHash ||
      !(await bcrypt.compare(dto.pin, customer.pinHash))
    ) {
      await this.audit.log('TRANSFER_FAIL', userId, null, ip, 'Sai mã PIN');
      throw new ForbiddenException('Mã PIN không hợp lệ');
    }

    const ownerCheck = await this.accountRepo.findOne({
      where: { id: dto.fromAccountId, customerId: customer.id },
    });
    if (!ownerCheck)
      throw new ForbiddenException('Tài khoản không thuộc về bạn');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Oracle không hỗ trợ mẫu SQL FOR UPDATE mà TypeORM sinh ra cho findOne+lock
      // (dính ORA-02014). Dùng raw FOR UPDATE để lock row an toàn.
      await queryRunner.query(
        'SELECT ID FROM ACCOUNTS WHERE ID = :1 FOR UPDATE',
        [dto.fromAccountId],
      );

      const fromAccount = await queryRunner.manager.findOne(Account, {
        where: { id: dto.fromAccountId },
      });
      if (!fromAccount)
        throw new NotFoundException('Tài khoản nguồn không tồn tại');

      await queryRunner.query(
        'SELECT ID FROM ACCOUNTS WHERE ACCOUNT_NUMBER = :1 FOR UPDATE',
        [toAccountNumber],
      );

      const toAccount = await queryRunner.manager.findOne(Account, {
        where: { accountNumber: toAccountNumber },
      });
      if (!toAccount)
        throw new NotFoundException('Tài khoản đích không tồn tại');

      // Decrypt số dư
      const fromBalance = parseFloat(
        (await this.aes.decrypt(
          this.aes.deserialize(fromAccount.balance as Buffer),
        )) || '0',
      );
      if (fromBalance < dto.amount)
        throw new BadRequestException('Số dư không đủ');

      const toBalance = parseFloat(
        (await this.aes.decrypt(
          this.aes.deserialize(toAccount.balance as Buffer),
        )) || '0',
      );

      // Cập nhật số dư với IV mới
      fromAccount.balance = this.aes.serialize(
        await this.aes.encrypt(String(fromBalance - dto.amount)),
      );
      toAccount.balance = this.aes.serialize(
        await this.aes.encrypt(String(toBalance + dto.amount)),
      );

      await queryRunner.manager.save(fromAccount);
      await queryRunner.manager.save(toAccount);

      const txId = `TXN-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;
      const refCode = `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const tx = queryRunner.manager.create(Transaction, {
        id: txId,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: this.aes.serialize(await this.aes.encrypt(String(dto.amount))),
        transactionType: 'transfer',
        status: 'completed',
        description: dto.description || null,
        referenceCode: refCode,
      });
      await queryRunner.manager.save(tx);

      await queryRunner.commitTransaction();

      await this.audit.log(
        'TRANSFER',
        userId,
        tx.id,
        ip,
        `From: ${dto.fromAccountId}, To: ${toAccountNumber}, Ref: ${refCode}`,
      );

      return {
        message: 'Chuyển khoản thành công',
        referenceCode: refCode,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getHistory(
    accountId: string,
    userId: string,
    ip: string,
    page = 1,
    limit = 10,
  ) {
    // Kiểm tra ownership
    const customer = await this.customerRepo.findOne({ where: { userId } });
    if (!customer) throw new NotFoundException('Hồ sơ không tồn tại');
    const account = await this.accountRepo.findOne({
      where: { id: accountId, customerId: customer.id },
    });
    if (!account)
      throw new ForbiddenException('Không có quyền xem tài khoản này');

    const [txs, total] = await this.txRepo.findAndCount({
      where: [{ fromAccountId: accountId }, { toAccountId: accountId }],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items = await Promise.all(
      txs.map(async (tx) => {
        const amountStr = await this.aes.decrypt(
          this.aes.deserialize(tx.amount as Buffer),
        );
        return {
          id: tx.id,
          type: tx.transactionType,
          amount: amountStr
            ? `${parseFloat(amountStr).toLocaleString('vi-VN')} đ`
            : '*** đ',
          direction: tx.fromAccountId === accountId ? 'debit' : 'credit',
          status: tx.status,
          description: tx.description,
          referenceCode: tx.referenceCode,
          createdAt: tx.createdAt,
        };
      }),
    );

    await this.audit.log(
      'VIEW_TRANSACTIONS',
      userId,
      accountId,
      ip,
      `Page: ${page}`,
    );
    return { items, total, page, limit };
  }
}
