import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, req.ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 900000 } })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Body() body: { fullName?: string; email?: string },
    @Req() req: any,
  ) {
    return this.authService.updateProfile(req.user.sub, body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: any,
  ) {
    return this.authService.changePassword(
      req.user.sub,
      body.currentPassword,
      body.newPassword,
      req.ip,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: any) {
    return this.authService.logout(req.user.sub, req.ip);
  }

  @Post('forgot-password/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 900000 } })
  requestForgotPasswordOtp(
    @Body() body: { username: string; email: string },
    @Req() req: any,
  ) {
    return this.authService.requestForgotPasswordOtp(
      body.username,
      body.email,
      req.ip,
    );
  }

  @Post('forgot-password/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 900000 } })
  confirmForgotPassword(
    @Body()
    body: {
      username: string;
      email: string;
      otp: string;
      newPassword: string;
      confirmPassword: string;
    },
    @Req() req: any,
  ) {
    return this.authService.confirmForgotPassword(
      body.username,
      body.email,
      body.otp,
      body.newPassword,
      body.confirmPassword,
      req.ip,
    );
  }
}
