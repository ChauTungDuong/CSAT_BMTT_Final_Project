import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { CryptoModule } from '../../crypto/crypto.module';
import { MaskingModule } from '../../masking/masking.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, Customer]),
    CryptoModule,
    MaskingModule,
    AuditModule,
  ],
  providers: [AccountsService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
