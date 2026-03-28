import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }

  async sendPinSetupEmail(to: string, pin: string) {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER'),
      to,
      subject: 'Mã PIN Của Bạn Đã Được Thiết Lập',
      text: `Mã PIN mới của bạn là: ${pin}. Vui lòng không chia sẻ mã này cho bất kỳ ai.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Đã gửi email cấu hình mã PIN đến ${to}`);
    } catch (error) {
      this.logger.error(`Lỗi gửi email: ${(error as Error).message}`);
    }
  }

  async sendTemporaryPasswordEmail(
    to: string,
    temporaryPassword: string,
    reason?: string,
  ) {
    const reasonSuffix = reason?.trim()
      ? ` Lý do hỗ trợ từ quản trị viên: ${reason.trim()}.`
      : '';

    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER'),
      to,
      subject: 'Mật khẩu tạm thời đăng nhập hệ thống',
      text: `Mật khẩu tạm thời của bạn là: ${temporaryPassword}. Vui lòng đăng nhập và đổi mật khẩu ngay lập tức.${reasonSuffix}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Đã gửi mật khẩu tạm thời đến ${to}`);
    } catch (error) {
      this.logger.error(
        `Lỗi gửi email mật khẩu tạm: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async sendAccountLockStatusEmail(
    to: string,
    username: string,
    reason: string,
  ) {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER'),
      to,
      subject: 'Thông báo tài khoản bị khóa tạm thời',
      text: `Tài khoản ${username} của bạn đã bị khóa bởi quản trị viên. Lý do: ${reason}. Nếu bạn không yêu cầu thao tác này, vui lòng liên hệ bộ phận hỗ trợ ngay.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Đã gửi thông báo khóa tài khoản đến ${to}`);
    } catch (error) {
      this.logger.error(
        `Lỗi gửi email khóa tài khoản: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async sendPasswordResetOtpEmail(to: string, otp: string) {
    await this.sendOtpEmail(
      to,
      otp,
      'Xác thực đặt lại mật khẩu',
      'Mã OTP có hiệu lực trong 5 phút.',
    );
  }

  async sendPinChangeOtpEmail(to: string, otp: string) {
    await this.sendOtpEmail(
      to,
      otp,
      'Xác thực đổi mã PIN',
      'Mã OTP có hiệu lực trong 5 phút.',
    );
  }

  private async sendOtpEmail(
    to: string,
    otp: string,
    subjectPrefix: string,
    footer: string,
  ) {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER'),
      to,
      subject: `${subjectPrefix} - CSAT Bank`,
      text: `OTP của bạn là: ${otp}. ${footer} Tuyệt đối không chia sẻ mã này cho bất kỳ ai.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Đã gửi OTP đến ${to} cho mục đích: ${subjectPrefix}`);
    } catch (error) {
      this.logger.error(`Lỗi gửi OTP email: ${(error as Error).message}`);
      throw error;
    }
  }
}
