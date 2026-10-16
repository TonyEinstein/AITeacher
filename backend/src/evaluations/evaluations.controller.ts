import { Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationsController {
  constructor(private service: EvaluationsService) {}

  // 课后打分
  @Post('lesson/:recordId/score')
  @HttpCode(200)
  scoreAfterLesson(@Param('recordId') recordId: string) {
    return this.service.scoreAfterLesson(Number(recordId));
  }

  // 学生综合报告
  @Get('student/:studentId/report')
  studentReport(
    @Param('studentId') studentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.studentReport(Number(studentId), startDate, endDate);
  }

  // 预警列表
  @Get('warnings')
  warnings(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.service.warnings(id);
  }
}
