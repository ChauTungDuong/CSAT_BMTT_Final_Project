import { Module } from '@nestjs/common';
import { TellerService } from './teller.service';
import { TellerController } from './teller.controller';
import { CustomersModule } from '../customers/customers.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [CustomersModule, AccountsModule, AuditModule],
  providers: [TellerService],
  controllers: [TellerController],
})
export class TellerModule {}
