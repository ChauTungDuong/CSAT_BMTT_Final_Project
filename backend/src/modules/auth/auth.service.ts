import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ip: string) {
    const exists = await this.userRepo.findOne({
      where: { username: dto.username },
    });
    if (exists) throw new ConflictException('Tên đăng nhập đã tồn tại');

    // Băm mật khẩu — 12 rounds ≈ 250ms (đủ chậm để chống brute force)
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const id = `USR-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;

    const user = this.userRepo.create({
      id,
      username: dto.username,
      passwordHash,
      role: 'customer',
    });
    await this.userRepo.save(user);

    await this.auditService.log(
      'REGISTER',
      user.id,
      null,
      ip,
      `Role: ${user.role}`,
    );
    return { message: 'Đăng ký thành công' };
  }

  async login(dto: LoginDto, ip: string) {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    // KHÔNG phân biệt "user không tồn tại" và "sai mật khẩu" (chống user enumeration)
    const isValid = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !isValid || !user.isActive) {
      await this.auditService.log(
        'LOGIN_FAIL',
        user?.id || null,
        null,
        ip,
        `Username: ${dto.username}`,
      );
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    await this.auditService.log(
      'LOGIN_SUCCESS',
      user.id,
      null,
      ip,
      `Role: ${user.role}`,
    );
    return { accessToken: token, role: user.role };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
    };
  }

  async updateProfile(
    userId: string,
    data: { fullName?: string; email?: string },
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.email !== undefined) user.email = data.email;
    await this.userRepo.save(user);
    return { message: 'Cập nhật hồ sơ thành công' };
  }
}
