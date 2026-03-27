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

  @Column({
    name: 'ROLE',
    length: 20,
    default: 'customer',
  })
  role: string;

  @Column({ name: 'FULL_NAME', length: 200 })
  fullName: string;

  @Column({ name: 'EMAIL', length: 200 })
  email: string;

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

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
