import { Module } from '@nestjs/common';
import { PracticeService } from './practice.service';
import { PracticeController } from './practice.controller';

@Module({
  controllers: [PracticeController],
  providers: [PracticeService],
})
export class PracticeModule {}
