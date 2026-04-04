import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('USER_KEY_METADATA')
export class UserKeyMetadata {
  @PrimaryColumn({ name: 'USER_ID', length: 36 })
  userId: string;

  @Column({ name: 'KDF_ALGO', length: 32, default: 'pbkdf2-sha256' })
  kdfAlgo: string;

  @Column({ name: 'KDF_ITERATIONS', type: 'number', default: 310000 })
  kdfIterations: number;

  @Column({ name: 'KDF_SALT_HEX', length: 128 })
  kdfSaltHex: string;

  @Column({ name: 'WRAPPED_DEK_B64', type: 'clob' })
  wrappedDekB64: string;

  @Column({ name: 'RECOVERY_WRAPPED_DEK_B64', type: 'clob', nullable: true })
  recoveryWrappedDekB64: string | null;

  @Column({ name: 'KEY_VERSION', type: 'number', default: 1 })
  keyVersion: number;

  @Column({ name: 'PASSWORD_EPOCH', type: 'number', default: 1 })
  passwordEpoch: number;

  @Column({ name: 'MIGRATION_STATE', length: 24, default: 'legacy' })
  migrationState: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
