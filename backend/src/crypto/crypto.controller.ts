import { Controller, Get, Query } from '@nestjs/common';
import { CryptoLogService } from './services/crypto-log.service';

@Controller('crypto')
export class CryptoController {
  constructor(private readonly cryptoLog: CryptoLogService) {}

  @Get('groups')
  getGroups(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('operation') operation?: 'encrypt' | 'decrypt' | 'mixed',
    @Query('keyword') keyword?: string,
  ) {
    return this.cryptoLog.getGroups({
      page: Number(page ?? 1),
      limit: Number(limit ?? 10),
      operation,
      keyword,
    });
  }
}
