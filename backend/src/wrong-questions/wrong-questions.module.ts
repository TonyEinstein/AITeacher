import { Module } from '@nestjs/common';
import { WrongQuestionsService } from './wrong-questions.service';
import { WrongQuestionsController } from './wrong-questions.controller';

@Module({
  controllers: [WrongQuestionsController],
  providers: [WrongQuestionsService],
  exports: [WrongQuestionsService],
})
export class WrongQuestionsModule {}
