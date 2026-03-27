import { Module } from '@nestjs/common';
import { AesService } from './services/aes.service';
import { HmacService } from './services/hmac.service';
import { CryptoLogService } from './services/crypto-log.service';
import { CryptoGateway } from './crypto.gateway';
import { CryptoTraceContextService } from './services/crypto-trace-context.service';
import { CryptoController } from './crypto.controller';

@Module({
  providers: [
    AesService,
    HmacService,
    CryptoLogService,
    CryptoGateway,
    CryptoTraceContextService,
  ],
  controllers: [CryptoController],
  exports: [
    AesService,
    HmacService,
    CryptoLogService,
    CryptoTraceContextService,
  ],
})
export class CryptoModule {}
