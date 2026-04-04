import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Customer } from '../customers/entities/customer.entity';
import { Account } from '../accounts/entities/account.entity';
import { CryptoModule } from '../../crypto/crypto.module';
import { AuditModule } from '../../audit/audit.module';
import { MailService } from '../customers/mail.service';
import { SessionRegistryService } from './services/session-registry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Customer, Account]),
    CryptoModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            config.get<StringValue>('JWT_EXPIRES_IN') ?? ('8h' as StringValue),
        },
      }),
    }),
    AuditModule,
  ],
  providers: [AuthService, JwtStrategy, MailService, SessionRegistryService],
  controllers: [AuthController],
  exports: [AuthService, SessionRegistryService],
})
export class AuthModule {}
