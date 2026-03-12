import { Module } from '@nestjs/common';
import { MaskingEngine } from './masking.engine';

@Module({
  providers: [MaskingEngine],
  exports: [MaskingEngine],
})
export class MaskingModule {}
