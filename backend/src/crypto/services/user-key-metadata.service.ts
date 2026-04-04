import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserKeyMetadata } from '../../modules/auth/entities/user-key-metadata.entity';

@Injectable()
export class UserKeyMetadataService {
  constructor(
    @InjectRepository(UserKeyMetadata)
    private readonly repo: Repository<UserKeyMetadata>,
  ) {}

  findByUserId(userId: string): Promise<UserKeyMetadata | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async upsertMetadata(input: {
    userId: string;
    kdfAlgo?: string;
    kdfIterations: number;
    kdfSaltHex: string;
    wrappedDekB64: Buffer;
    recoveryWrappedDekB64?: Buffer | null;
    keyVersion?: number;
    passwordEpoch?: number;
    migrationState?: string;
  }): Promise<UserKeyMetadata> {
    const existing = await this.findByUserId(input.userId);
    const entity = this.repo.create({
      ...(existing || {}),
      userId: input.userId,
      kdfAlgo: input.kdfAlgo || 'pbkdf2-sha256',
      kdfIterations: input.kdfIterations,
      kdfSaltHex: input.kdfSaltHex,
      wrappedDekB64: input.wrappedDekB64,
      recoveryWrappedDekB64: input.recoveryWrappedDekB64 ?? null,
      keyVersion: input.keyVersion || 1,
      passwordEpoch: input.passwordEpoch || 1,
      migrationState: input.migrationState || 'legacy',
    });
    return this.repo.save(entity);
  }
}
