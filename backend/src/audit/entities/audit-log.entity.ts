import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('AUDIT_LOGS')
export class AuditLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'EVENT_TYPE', length: 50 })
  eventType: string;

  @Column({ name: 'USER_ID', length: 36, nullable: true })
  userId: string | null;

  @Column({ name: 'TARGET_ID', length: 36, nullable: true })
  targetId: string | null;

  @Column({ name: 'IP_ADDRESS', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'USER_AGENT', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ name: 'DETAIL', length: 1000, nullable: true })
  detail: string | null;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;
}
