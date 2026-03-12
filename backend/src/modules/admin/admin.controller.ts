import {
  Controller,
  Get,
  Patch,
  Delete,
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
  getUsers(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.getUsers(+page, +limit);
  }

  // Kích hoạt / vô hiệu hoá tài khoản
  @Patch('users/:id/status')
  toggleStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: any,
  ) {
    return this.service.setUserStatus(id, body.isActive, req.user.sub, req.ip);
  }

  // Đổi vai trò người dùng
  @Patch('users/:id/role')
  changeRole(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Req() req: any,
  ) {
    return this.service.changeUserRole(id, body.role, req.user.sub, req.ip);
  }

  // Xoá người dùng (chỉ tài khoản không có hồ sơ khách hàng)
  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteUser(id, req.user.sub, req.ip);
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
