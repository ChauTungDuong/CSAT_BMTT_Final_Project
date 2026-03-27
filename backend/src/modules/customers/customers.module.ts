import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { User } from '../auth/entities/user.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { MailService } from './mail.service';
import { CryptoModule } from '../../crypto/crypto.module';
import { MaskingModule } from '../../masking/masking.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, User]),
    CryptoModule,
    MaskingModule,
    AuditModule,
  ],
  providers: [CustomersService, MailService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
