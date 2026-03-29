import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('ACCOUNTS')
export class Account {
  @PrimaryColumn({ name: 'ID', length: 36 })
  id: string;

  @Column({ name: 'CUSTOMER_ID', length: 36 })
  customerId: string;

  @Column({ name: 'ACCOUNT_NUMBER', type: 'blob' })
  accountNumber: Buffer;

  @Column({ name: 'ACCOUNT_NUMBER_HASH', length: 64, unique: true })
  accountNumberHash: string;

  @Column({ name: 'ACCOUNT_TYPE', length: 20, default: 'saving' })
  accountType: string;

  @Column({ name: 'BALANCE', type: 'blob' })
  balance: Buffer;

  @Column({
    name: 'IS_ACTIVE',
    type: 'decimal',
    precision: 1,
    scale: 0,
    default: 1,
  })
  isActive: number;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;
}
