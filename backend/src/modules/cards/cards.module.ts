import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from '../accounts/entities/card.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { CryptoModule } from '../../crypto/crypto.module';
import { AuditModule } from '../../audit/audit.module';
import { MaskingModule } from '../../masking/masking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Card, Customer]),
    CryptoModule,
    AuditModule,
    MaskingModule,
  ],
  providers: [CardsService],
  controllers: [CardsController],
  exports: [CardsService],
})
export class CardsModule {}
