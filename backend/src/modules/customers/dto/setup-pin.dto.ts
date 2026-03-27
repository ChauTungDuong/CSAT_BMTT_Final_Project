import { IsString, IsNotEmpty, Length } from 'class-validator';

export class SetupPinDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Mã PIN phải dài chính xác 6 ký tự' })
  pin: string;
}
