import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('USERS')
export class User {
  @PrimaryColumn({ name: 'ID', length: 36 })
  id: string;

  @Column({ name: 'USERNAME', length: 100, unique: true })
  username: string;

  @Column({ name: 'PASSWORD_HASH', length: 255 })
  passwordHash: string;

  @Column({ name: 'ADMIN_PIN_HASH', length: 255, nullable: true })
  adminPinHash: string | null;

  @Column({
    name: 'ROLE',
    length: 20,
    default: 'customer',
  })
  role: string;

  @Column({ name: 'FULL_NAME', length: 200 })
  fullName: string;

  @Column({
    name: 'FORCE_PASSWORD_CHANGE',
    type: 'decimal',
    precision: 1,
    scale: 0,
    default: 0,
  })
  forcePasswordChange: number;

  @Column({ name: 'EMAIL', length: 200 })
  email: string;

  @Column({ name: 'EMAIL_ENCRYPTED', type: 'blob', nullable: true })
  emailEncrypted: Buffer | null;

  @Column({ name: 'EMAIL_HASH', length: 64, nullable: true })
  emailHash: string | null;

  @Column({
    name: 'IS_ACTIVE',
    type: 'decimal',
    precision: 1,
    scale: 0,
    default: 1,
  })
  isActive: number;

  @Column({
    name: 'PASSWORD_FAILED_ATTEMPTS',
    type: 'number',
    precision: 2,
    default: 0,
  })
  passwordFailedAttempts: number;

  @Column({
    name: 'FORGOT_OTP_FAILED_ATTEMPTS',
    type: 'number',
    precision: 2,
    default: 0,
  })
  forgotOtpFailedAttempts: number;

  @Column({
    name: 'PASSWORD_LOCKED',
    type: 'number',
    precision: 1,
    default: 0,
  })
  passwordLocked: number;

  @Column({ name: 'PASSWORD_LOCKED_AT', type: 'timestamp', nullable: true })
  passwordLockedAt: Date | null;

  @Column({ name: 'LOCK_REASON', length: 32, default: 'NONE' })
  lockReason: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
