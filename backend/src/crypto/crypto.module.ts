import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AesService } from './services/aes.service';
import { CryptoLogService } from './services/crypto-log.service';
import { CryptoGateway } from './crypto.gateway';
import { CryptoTraceContextService } from './services/crypto-trace-context.service';
import { CryptoController } from './crypto.controller';
import { Pbkdf2Service } from './services/pbkdf2.service';
import { RsaTransportService } from './services/rsa-transport.service';
import { TransportController } from './transport.controller';
import { TransportEnvelopeInterceptor } from './interceptors/transport-envelope.interceptor';

@Module({
  providers: [
    AesService,
    CryptoLogService,
    CryptoGateway,
    CryptoTraceContextService,
    Pbkdf2Service,
    RsaTransportService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransportEnvelopeInterceptor,
    },
  ],
  controllers: [CryptoController, TransportController],
  exports: [
    AesService,
    CryptoLogService,
    CryptoTraceContextService,
    Pbkdf2Service,
    RsaTransportService,
  ],
})
export class CryptoModule {}
