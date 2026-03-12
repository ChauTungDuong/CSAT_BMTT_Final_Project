import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  MaxLength,
} from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  fromAccountId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  toAccountNumber: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @MaxLength(500)
  description?: string;
}
