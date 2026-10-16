import { Module } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { GradingService } from './grading.service';
import { WechatModule } from '../wechat/wechat.module';

@Module({
  imports: [WechatModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, GradingService],
  exports: [AssignmentsService, GradingService],
})
export class AssignmentsModule {}
