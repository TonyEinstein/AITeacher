import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { WrongQuestionsService } from './wrong-questions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wrong-questions')
@UseGuards(JwtAuthGuard)
export class WrongQuestionsController {
  constructor(private service: WrongQuestionsService) {}

  @Get('student/:studentId')
  findByStudent(
    @Param('studentId') studentId: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.findByStudent(Number(studentId), subjectId ? Number(subjectId) : undefined);
  }

  @Get('stats/:studentId')
  stats(@Param('studentId') studentId: string, @Query('subjectId') subjectId?: string) {
    return this.service.stats(Number(studentId), subjectId ? Number(subjectId) : undefined);
  }

  /**
   * 学科薄弱画像（PRD §3.25）：按知识点聚合的薄弱点排序。
   * 口径：基于错题数（非错误率），详见 src/wrong-questions/weakness.ts
   */
  @Get('weaknesses/:studentId')
  weaknesses(
    @Param('studentId') studentId: string,
    @Query('subjectId') subjectId?: string,
    @Query('topN') topN?: string,
  ) {
    return this.service.weaknesses(
      Number(studentId),
      subjectId ? Number(subjectId) : undefined,
      topN ? Number(topN) : 10,
    );
  }

  @Delete(':id')
  markMastered(@Param('id') id: string) {
    return this.service.markMastered(Number(id));
  }

  /** 全班薄弱分布（教师视角）：按知识点统计「多少学生在错」 */
  @Get('class-distribution/:classId')
  classDistribution(@Param('classId') classId: string, @Query('topN') topN?: string) {
    return this.service.classDistribution(Number(classId), topN ? Number(topN) : 5);
  }
}
