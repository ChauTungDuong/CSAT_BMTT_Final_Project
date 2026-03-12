import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('TRANSACTIONS')
export class Transaction {
  @PrimaryColumn({ name: 'ID', length: 36 })
  id: string;

  @Column({ name: 'FROM_ACCOUNT_ID', length: 36, nullable: true })
  fromAccountId: string | null;

  @Column({ name: 'TO_ACCOUNT_ID', length: 36, nullable: true })
  toAccountId: string | null;

  @Column({ name: 'AMOUNT', type: 'blob' })
  amount: Buffer;

  @Column({ name: 'TRANSACTION_TYPE', length: 30 })
  transactionType: string;

  @Column({ name: 'STATUS', length: 20, default: 'completed' })
  status: string;

  @Column({ name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'REFERENCE_CODE', length: 50, nullable: true, unique: true })
  referenceCode: string | null;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;
}
