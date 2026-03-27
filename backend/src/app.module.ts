import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import * as nodeCrypto from 'crypto';
import { CryptoModule } from './crypto/crypto.module';
import { MaskingModule } from './masking/masking.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AdminModule } from './modules/admin/admin.module';
import { CardsModule } from './modules/cards/cards.module';

const globalAny = globalThis as any;
if (!globalAny.crypto || typeof globalAny.crypto.randomUUID !== 'function') {
  globalAny.crypto = {
    ...(globalAny.crypto || {}),
    randomUUID: nodeCrypto.randomUUID,
  };
}

@Module({
  imports: [
    // Biến môi trường
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting — chống brute force
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 30,
      },
      {
        name: 'auth',
        ttl: 900000,
        limit: 5,
      },
    ]),

    // Oracle connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'oracle',
        host: config.getOrThrow('DB_HOST'),
        port: +config.getOrThrow('DB_PORT'),
        username: config.getOrThrow('DB_USER'),
        password: config.getOrThrow('DB_PASSWORD'),
        serviceName: config.getOrThrow('DB_SERVICE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
        extra: {
          poolMin: 2,
          poolMax: 10,
        },
      }),
    }),

    // Business modules
    CryptoModule,
    MaskingModule,
    AuditModule,
    AuthModule,
    CustomersModule,
    AccountsModule,
    TransactionsModule,
    AdminModule,
    CardsModule,
  ],
})
export class AppModule {}
