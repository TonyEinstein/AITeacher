import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('exams')
@UseGuards(JwtAuthGuard)
export class ExamsController {
  constructor(private examsService: ExamsService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  create(@Body() body: any) {
    return this.examsService.create(body);
  }

  @Get()
  findBySchool(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.examsService.findBySchool(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.findOne(Number(id));
  }

  // AI 组卷
  @Post(':id/generate-paper')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  generatePaper(@Param('id') id: string, @Body() body: any) {
    return this.examsService.generatePaper(Number(id), body);
  }

  // 锁卷
  @Post('paper/:paperId/lock')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  lockPaper(@Param('paperId') paperId: string, @Body() body?: any) {
    return this.examsService.lockPaper(Number(paperId), body);
  }

  // 作弊记录
  @Post(':id/cheat')
  @HttpCode(200)
  recordCheat(
    @Param('id') id: string,
    @Body() body: { studentId: number; type: string; evidence?: string },
  ) {
    return this.examsService.recordCheat(Number(id), body.studentId, body.type, body.evidence);
  }

  // 录入成绩
  @Post(':id/score')
  @HttpCode(200)
  recordScore(
    @Param('id') id: string,
    @Body() body: { studentId: number; score: number; paperId?: number },
  ) {
    return this.examsService.recordScore(Number(id), body.studentId, body.score, body.paperId);
  }

  // 考试分析
  @Get(':id/analysis')
  analysis(@Param('id') id: string) {
    return this.examsService.examAnalysis(Number(id));
  }
}
