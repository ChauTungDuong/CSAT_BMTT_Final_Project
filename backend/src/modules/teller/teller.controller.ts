import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { TellerService } from './teller.service';

@Controller('teller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TELLER)
export class TellerController {
  constructor(private readonly service: TellerService) {}

  // Danh sách tất cả khách hàng (masked, mặc định cho teller)
  @Get('customers')
  listCustomers(@Req() req: any) {
    return this.service.getAllCustomers(req.user.sub, req.ip);
  }

  // Tìm kiếm khách hàng theo tên hoặc email
  @Get('search')
  search(@Query('q') query: string, @Req() req: any) {
    return this.service.searchCustomer(query || '', req.user.sub, req.ip);
  }

  // Xem thông tin khách hàng (partial mask cho teller)
  @Get('customers/:id')
  getCustomer(@Param('id') id: string, @Req() req: any) {
    return this.service.getCustomerForTeller(id, req.user.sub, req.ip);
  }

  // Xem tài khoản ngân hàng của khách (balance ẩn)
  @Get('customers/:id/accounts')
  getAccounts(@Param('id') id: string, @Req() req: any) {
    return this.service.getAccountsForTeller(id, req.user.sub, req.ip);
  }
}
