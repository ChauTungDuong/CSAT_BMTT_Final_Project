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

  async sendTemporaryPasswordEmail(to: string, temporaryPassword: string) {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER'),
      to,
      subject: 'Mật khẩu tạm thời đăng nhập hệ thống',
      text: `Mật khẩu tạm thời của bạn là: ${temporaryPassword}. Vui lòng đăng nhập và đổi mật khẩu ngay lập tức.`,
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
}
