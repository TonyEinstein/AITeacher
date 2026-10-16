import { Module } from '@nestjs/common';
import { LessonRecordsService } from './lesson-records.service';
import { LessonRecordsController } from './lesson-records.controller';
import { LessonAgentModule } from '../lesson-agent/lesson.agent.module';

@Module({
  imports: [LessonAgentModule],
  controllers: [LessonRecordsController],
  providers: [LessonRecordsService],
})
export class LessonRecordsModule {}
