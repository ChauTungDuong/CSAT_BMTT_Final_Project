import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Mã PIN phải gồm 6 chữ số' })
  pin: string;
}

export class RevealCardDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Mã PIN phải gồm 6 chữ số' })
  pin: string;
}
