import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { TransactionsService } from './transactions.service';
import { TransferDto } from './dto/transfer.dto';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post('transfer')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  transfer(@Body() dto: TransferDto, @Req() req: any) {
    return this.service.transfer(dto, req.user.sub, req.ip);
  }

  @Get('accounts/:accountId/history')
  @Roles(Role.CUSTOMER)
  getHistory(
    @Param('accountId') accountId: string,
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.service.getHistory(
      accountId,
      req.user.sub,
      req.ip,
      +page,
      +limit,
    );
  }
}
