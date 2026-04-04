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

  @Column({ name: 'EMAIL', type: 'blob' })
  email: Buffer;

  @Column({ name: 'EMAIL_HASH', length: 64, nullable: true })
  emailHash: string | null;

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

  @Column({
    name: 'PIN_FAILED_ATTEMPTS',
    type: 'decimal',
    precision: 2,
    scale: 0,
    default: 0,
  })
  pinFailedAttempts: number;

  @Column({
    name: 'PIN_LOCKED',
    type: 'decimal',
    precision: 1,
    scale: 0,
    default: 0,
  })
  pinLocked: number;

  @Column({ name: 'PIN_LOCKED_AT', type: 'timestamp', nullable: true })
  pinLockedAt: Date | null;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
