import { Module } from '@nestjs/common';
import { TutoringService } from './tutoring.service';
import { TutoringController } from './tutoring.controller';

@Module({
  controllers: [TutoringController],
  providers: [TutoringService],
  exports: [TutoringService],
})
export class TutoringModule {}
