import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(
    eventType: string,
    userId: string | null,
    targetId: string | null,
    ipAddress: string,
    detail: string,
  ): Promise<void> {
    const entry = this.auditRepo.create({
      eventType,
      userId,
      targetId,
      ipAddress,
      detail,
    });
    await this.auditRepo.save(entry);
  }

  async findAll(
    page: number,
    limit: number,
    eventType?: string,
    userId?: string,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const where: FindManyOptions<AuditLog>['where'] = {};
    if (eventType) (where as any).eventType = eventType;
    if (userId) (where as any).userId = userId;

    const [items, total] = await this.auditRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }
}
