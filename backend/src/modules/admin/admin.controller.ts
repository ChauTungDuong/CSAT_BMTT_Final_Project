import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // Danh sách user
  @Get('users')
  getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('q') q?: string,
  ) {
    return this.service.getUsers(+page, +limit, q);
  }

  // Kích hoạt / vô hiệu hoá tài khoản
  @Patch('users/:id/status')
  toggleStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean; adminPin: string; reason: string },
    @Req() req: any,
  ) {
    return this.service.setUserStatus(
      id,
      body.isActive,
      req.user.sub,
      req.ip,
      body.adminPin,
      body.reason,
    );
  }

  @Post('security/set-pin')
  setAdminPin(@Body() body: { pin: string }, @Req() req: any) {
    return this.service.setAdminSecurityPin(req.user.sub, body.pin, req.ip);
  }

  @Post('security/change-pin')
  changeAdminPin(
    @Body()
    body: {
      currentPassword: string;
      currentPin: string;
      newPin: string;
      confirmPin: string;
    },
    @Req() req: any,
  ) {
    return this.service.changeAdminSecurityPin(
      req.user.sub,
      body.currentPassword,
      body.currentPin,
      body.newPin,
      body.confirmPin,
      req.ip,
    );
  }

  // Audit log
  @Get('audit-logs')
  getAuditLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('eventType') eventType?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.getAuditLogs(+page, +limit, eventType, userId);
  }

  // Thống kê hệ thống
  @Get('stats')
  getStats() {
    return this.service.getSystemStats();
  }
}
