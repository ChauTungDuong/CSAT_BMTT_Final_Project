import { Module } from '@nestjs/common';
import { AesService } from './services/aes.service';
import { HmacService } from './services/hmac.service';
import { CryptoLogService } from './services/crypto-log.service';
import { CryptoGateway } from './crypto.gateway';
import { CryptoTraceContextService } from './services/crypto-trace-context.service';
import { CryptoController } from './crypto.controller';
import { Pbkdf2Service } from './services/pbkdf2.service';

@Module({
  providers: [
    AesService,
    HmacService,
    CryptoLogService,
    CryptoGateway,
    CryptoTraceContextService,
    Pbkdf2Service,
  ],
  controllers: [CryptoController],
  exports: [
    AesService,
    HmacService,
    CryptoLogService,
    CryptoTraceContextService,
    Pbkdf2Service,
  ],
})
export class CryptoModule {}
