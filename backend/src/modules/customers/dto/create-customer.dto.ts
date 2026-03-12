import {
  IsString,
  IsNotEmpty,
  IsEmail,
  Matches,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,11}$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{12}$/, { message: 'CCCD phải có 12 chữ số' })
  cccd: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'Ngày sinh phải có định dạng DD/MM/YYYY',
  })
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN phải là 6 chữ số' })
  pin?: string;
}
