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

  @Column({ name: 'PHONE', type: 'blob', nullable: true })
  phone: Buffer | null;

  @Column({ name: 'CCCD', type: 'blob', nullable: true })
  cccd: Buffer | null;

  @Column({ name: 'DATE_OF_BIRTH', type: 'blob', nullable: true })
  dateOfBirth: Buffer | null;

  @Column({ name: 'ADDRESS', type: 'blob', nullable: true })
  address: Buffer | null;

  @Column({ name: 'PIN_HASH', length: 255, nullable: true })
  pinHash: string | null;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
