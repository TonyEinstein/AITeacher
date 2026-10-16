import { Module } from '@nestjs/common';
import { WorkloadService } from './workload.service';
import { WorkloadController } from './workload.controller';

@Module({
  controllers: [WorkloadController],
  providers: [WorkloadService],
})
export class TeachersModule {}
