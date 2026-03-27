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
import { SetupPinDto } from './dto/setup-pin.dto';

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
    @Query('viewToken') viewToken?: string,
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
      viewToken,
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
    const result = await this.service.verifyPin(
      customerId,
      req.user.sub,
      dto.pin,
      req.ip,
    );
    if (!result.verified) {
      if (result.locked) {
        throw new UnauthorizedException({
          message: 'Tài khoản đã bị khóa vì nhập sai PIN quá 5 lần',
          locked: true,
          remainingAttempts: 0,
        });
      }
      throw new UnauthorizedException({
        message: result.message,
        locked: false,
        remainingAttempts: result.remainingAttempts,
      });
    }

    const session = this.service.createPinViewSession(req.user.sub);
    return { verified: true, ...session };
  }

  // Cài đặt PIN (lần đầu)
  @Post('me/setup-pin')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async setupPin(@Body() dto: SetupPinDto, @Req() req: any) {
    const customerId = await this.service.getCustomerIdByUserId(req.user.sub);
    if (!customerId) throw new NotFoundException('Hồ sơ chưa được tạo');
    return this.service.setupPin(
      customerId,
      req.user.sub,
      dto.password,
      dto.pin,
      req.ip,
    );
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

  // Admin xem chi tiết một customer
  @Get(':id')
  @Roles(Role.ADMIN)
  async getCustomerById(@Param('id') id: string, @Req() req: any) {
    return this.service.getProfile(
      id,
      req.user.sub,
      req.user.role as Role,
      false,
      req.ip,
      undefined,
    );
  }
}
