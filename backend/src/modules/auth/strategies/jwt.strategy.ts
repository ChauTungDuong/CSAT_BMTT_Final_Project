import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SessionRegistryService } from '../services/session-registry.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly sessionRegistry: SessionRegistryService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
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
