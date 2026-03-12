import { IsString, Matches } from 'class-validator';

export class VerifyPinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN phải là 6 chữ số' })
  pin: string;
}
