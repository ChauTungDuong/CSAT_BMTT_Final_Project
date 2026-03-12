import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuditModule } from '../../audit/audit.module';
import { MaskingModule } from '../../masking/masking.module';
import { CryptoModule } from '../../crypto/crypto.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Customer]),
    AuditModule,
    MaskingModule,
    CryptoModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
