import { Controller, Get, Post, Body, Query, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PracticeService } from './practice.service';
import type { PracticeType } from './practice.service';

@Controller('practice')
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  /** 提交一次专项练习（眼镜/手表/小程序端调用） */
  @Post('record')
  @HttpCode(200)
  record(
    @Body()
    body: {
      sessionId: number;
      practiceType: PracticeType;
      subject?: string;
      question: string;
      userAnswer: string;
      correctAnswer?: string;
      isCorrect?: boolean | null;
    },
  ) {
    return this.practice.record(body);
  }

  /** 学生专项练习历史 */
  @Get('history')
  history(@Query('studentId') studentId: string, @Query('type') type?: PracticeType) {
    return this.practice.history(Number(studentId), type);
  }

  /** 学生分类型统计（含朗读打卡连续天数） */
  @Get('stats')
  stats(@Query('studentId') studentId: string) {
    return this.practice.studentStats(Number(studentId));
  }
}
