import {
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoLogService } from './services/crypto-log.service';

@Controller('crypto')
export class CryptoController {
  constructor(
    private readonly cryptoLog: CryptoLogService,
    private readonly config: ConfigService,
  ) {}

  private ensureMonitorEnabled(headerToken?: string) {
    const enabled = this.config.get<string>('ENABLE_CRYPTO_MONITOR') === 'true';
    const isProd = this.config.get<string>('NODE_ENV') === 'production';

    if (!enabled || isProd) {
      throw new NotFoundException();
    }

    const expectedToken = this.config.get<string>('CRYPTO_MONITOR_TOKEN');
    if (expectedToken && headerToken !== expectedToken) {
      throw new UnauthorizedException('Invalid monitor token');
    }
  }

  @Get('groups')
  getGroups(
    @Headers('x-monitor-token') monitorToken?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('operation') operation?: 'encrypt' | 'decrypt' | 'mixed',
    @Query('keyword') keyword?: string,
  ) {
    this.ensureMonitorEnabled(monitorToken);

    return this.cryptoLog.getGroups({
      page: Number(page ?? 1),
      limit: Number(limit ?? 10),
      operation,
      keyword,
    });
  }

  @Delete('groups')
  clearGroups(@Headers('x-monitor-token') monitorToken?: string) {
    this.ensureMonitorEnabled(monitorToken);
    this.cryptoLog.clearGroups();
    return { message: 'Logs cleared' };
  }
}
