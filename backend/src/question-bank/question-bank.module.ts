import { Module } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';
import { QuestionBankController } from './question-bank.controller';

@Module({
  controllers: [QuestionBankController],
  providers: [QuestionBankService],
})
export class QuestionBankModule {}