import {
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/, {
    message: 'Ngày sinh phải có định dạng DD/MM/YYYY hoặc YYYY-MM-DD',
  })
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
