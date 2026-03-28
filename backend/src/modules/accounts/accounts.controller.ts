import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { AccountsService } from './accounts.service';

@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  // Customer xem tài khoản của mình
  @Get('me')
  @Roles(Role.CUSTOMER)
  getMyAccounts(@Req() req: any) {
    return this.service.getMyAccounts(req.user.sub, req.ip);
  }
}
