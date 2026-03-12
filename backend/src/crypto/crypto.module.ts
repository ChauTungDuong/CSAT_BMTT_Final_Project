import { Module } from '@nestjs/common';
import { AesService } from './services/aes.service';
import { HmacService } from './services/hmac.service';

@Module({
  providers: [AesService, HmacService],
  exports: [AesService, HmacService],
})
export class CryptoModule {}
