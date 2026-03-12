import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  // Customer tạo hồ sơ lần đầu
  @Post('profile')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  createProfile(@Body() dto: CreateCustomerDto, @Req() req: any) {
    return this.service.createProfile(req.user.sub, dto, req.ip);
  }

  // Xem hồ sơ của mình (customer)
  @Get('me')
  @Roles(Role.CUSTOMER)
  async getMyProfile(
    @Req() req: any,
    @Query('pinVerified') pinVerified?: string,
  ) {
    const isPinVerified = pinVerified === 'true';
    const customerId = await this.service.getCustomerIdByUserId(req.user.sub);
    if (!customerId) throw new NotFoundException('Hồ sơ chưa được tạo');
    return this.service.getProfile(
      customerId,
      req.user.sub,
      Role.CUSTOMER,
      isPinVerified,
      req.ip,
    );
  }

  // Cập nhật hồ sơ
  @Put('me')
  @Roles(Role.CUSTOMER)
  async updateMyProfile(@Body() dto: UpdateCustomerDto, @Req() req: any) {
    const customerId = await this.service.getCustomerIdByUserId(req.user.sub);
    if (!customerId) throw new NotFoundException('Hồ sơ chưa được tạo');
    return this.service.updateProfile(customerId, req.user.sub, dto, req.ip);
  }

  // Xác thực PIN để xem full info
  @Post('me/verify-pin')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async verifyPin(@Body() dto: VerifyPinDto, @Req() req: any) {
    const customerId = await this.service.getCustomerIdByUserId(req.user.sub);
    if (!customerId) throw new NotFoundException('Hồ sơ chưa được tạo');
    const valid = await this.service.verifyPin(
      customerId,
      req.user.sub,
      dto.pin,
      req.ip,
    );
    if (!valid) throw new UnauthorizedException('PIN không đúng');
    return { verified: true };
  }

  // Đặt/đổi PIN
  @Put('me/pin')
  @Roles(Role.CUSTOMER)
  async setPin(
    @Body() body: { pin: string; oldPin?: string },
    @Req() req: any,
  ) {
    const customerId = await this.service.getCustomerIdByUserId(req.user.sub);
    if (!customerId) throw new NotFoundException('Hồ sơ chưa được tạo');
    return this.service.setPin(
      customerId,
      req.user.sub,
      body.pin,
      req.ip,
      body.oldPin,
    );
  }

  // Teller / Admin xem chi tiết một customer
  @Get(':id')
  @Roles(Role.TELLER, Role.ADMIN)
  async getCustomerById(@Param('id') id: string, @Req() req: any) {
    return this.service.getProfile(
      id,
      req.user.sub,
      req.user.role as Role,
      false,
      req.ip,
    );
  }
}
