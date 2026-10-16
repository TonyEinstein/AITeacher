import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, UseGuards, Req, ForbiddenException, HttpCode } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('question-bank')
@UseGuards(JwtAuthGuard)
export class QuestionBankController {
  constructor(private readonly service: QuestionBankService) {}

  @Post()
  @HttpCode(200)
  create(@Req() req: any, @Body() body: any) {
    this.assertSubjectOwnership(req.user, body.subjectId);
    return this.service.create(body);
  }

  @Post('batch')
  @HttpCode(200)
  createMany(@Req() req: any, @Body() body: { questions: any[] }) {
    // 批量创建时校验每道题的学科归属
    for (const q of body.questions || []) {
      this.assertSubjectOwnership(req.user, q.subjectId);
    }
    return this.service.createMany(body.questions);
  }

  @Get()
  list(
    @Query('subjectId') subjectId?: string,
    @Query('difficulty') difficulty?: string,
    @Query('knowledgePoint') kp?: string,
    @Query('page') page = '1',
  ) {
    return this.service.list(
      subjectId ? parseInt(subjectId) : undefined,
      difficulty ? parseInt(difficulty) : undefined,
      kp,
      parseInt(page),
    );
  }

  @Put(':id')
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    this.assertSubjectOwnership(req.user, body.subjectId);
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Get('knowledge-points/:subjectId')
  kps(@Param('subjectId', ParseIntPipe) subjectId: number) {
    return this.service.knowledgePoints(subjectId);
  }

  // subject_admin 只能操作自己学科的数据
  private assertSubjectOwnership(user: any, subjectId: any) {
    if (user?.role === 'subject_admin') {
      if (subjectId === undefined || Number(subjectId) !== Number(user.subjectId)) {
        throw new ForbiddenException('无权操作其他学科的数据');
      }
    }
  }
}
