import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('CARDS')
export class Card {
  @PrimaryColumn({ name: 'ID', length: 36 })
  id: string;

  @Column({ name: 'CUSTOMER_ID', length: 36 })
  customerId: string;

  @Column({ name: 'ACCOUNT_ID', length: 36, nullable: true })
  accountId: string | null;

  @Column({ name: 'CARD_NUMBER', type: 'blob' })
  cardNumber: Buffer;

  @Column({ name: 'CVV', type: 'blob' })
  cvv: Buffer;

  @Column({ name: 'CARD_EXPIRY', type: 'blob' })
  cardExpiry: Buffer;

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
