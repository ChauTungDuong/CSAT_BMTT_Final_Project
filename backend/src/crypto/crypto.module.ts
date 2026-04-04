import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AesService } from './services/aes.service';
import { AccountCryptoService } from './services/account-crypto.service';
import { CryptoTraceContextService } from './services/crypto-trace-context.service';
import { Pbkdf2Service } from './services/pbkdf2.service';
import { RsaTransportService } from './services/rsa-transport.service';
import { UserKeyDerivationService } from './services/user-key-derivation.service';
import { UserDekRuntimeService } from './services/user-dek-runtime.service';
import { UserKeyMetadataService } from './services/user-key-metadata.service';
import { EmailCryptoService } from './services/email-crypto.service';
import { UserKeyMetadata } from '../modules/auth/entities/user-key-metadata.entity';
import { TransportController } from './transport.controller';
import { TransportEnvelopeInterceptor } from './interceptors/transport-envelope.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([UserKeyMetadata])],
  providers: [
    AesService,
    AccountCryptoService,
    CryptoTraceContextService,
    Pbkdf2Service,
    RsaTransportService,
    UserKeyDerivationService,
    UserDekRuntimeService,
    UserKeyMetadataService,
    EmailCryptoService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransportEnvelopeInterceptor,
    },
  ],
  controllers: [TransportController],
  exports: [
    AesService,
    AccountCryptoService,
    CryptoTraceContextService,
    Pbkdf2Service,
    RsaTransportService,
    UserKeyDerivationService,
    UserDekRuntimeService,
    UserKeyMetadataService,
    EmailCryptoService,
  ],
})
export class CryptoModule {}
