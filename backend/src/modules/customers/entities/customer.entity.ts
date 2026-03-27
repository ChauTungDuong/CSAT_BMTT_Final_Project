import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('CUSTOMERS')
export class Customer {
  @PrimaryColumn({ name: 'ID', length: 36 })
  id: string;

  @Column({ name: 'USER_ID', length: 36, unique: true })
  userId: string;

  @Column({ name: 'FULL_NAME', length: 200 })
  fullName: string;

  @Column({ name: 'EMAIL', length: 200 })
  email: string;

  @Column({ name: 'PHONE', type: 'blob' })
  phone: Buffer;

  @Column({ name: 'CCCD', type: 'blob' })
  cccd: Buffer;

  @Column({ name: 'DATE_OF_BIRTH', type: 'blob' })
  dateOfBirth: Buffer;

  @Column({ name: 'ADDRESS', type: 'blob' })
  address: Buffer;

  @Column({ name: 'PIN_HASH', length: 255, nullable: true })
  pinHash: string | null;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
