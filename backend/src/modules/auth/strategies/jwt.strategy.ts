import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SessionRegistryService } from '../services/session-registry.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly sessionRegistry: SessionRegistryService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('USER_NOT_FOUND');
    }

    if (!user.isActive) {
      if (user.lockReason === 'ADMIN') {
        throw new UnauthorizedException('ADMIN_LOCKED');
      }
      throw new UnauthorizedException('ACCOUNT_LOCKED');
    }

    const singleSessionEnabled =
      this.config.get<string>('SINGLE_SESSION_ENABLED') !== 'false';

    if (singleSessionEnabled) {
      const active = this.sessionRegistry.isSessionActive(
        payload.sub,
        payload.sid,
      );
      if (!active) {
        throw new UnauthorizedException('SESSION_REVOKED');
      }
    }

    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      customerId: payload.customerId,
      sid: payload.sid,
    };
  }
}
