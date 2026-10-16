import {
  Controller, Get, Post, Body, Param, Put, Delete, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
 HttpCode, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssignmentsService } from './assignments.service';
import { GradingService } from './grading.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const fileUploadOptions = {
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req: any, file: any, cb: any) => {
    if (/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片或 PDF'), false);
  },
};

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentsController {
  constructor(
    private assignmentsService: AssignmentsService,
    private gradingService: GradingService,
  ) {}

  // AI 生成作业
  @Post('generate')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  generate(@Body() body: { lessonPlanId: number; classIds: number[]; options?: any }) {
    return this.assignmentsService.generateByLesson(body.lessonPlanId, body.classIds, body.options);
  }

  // 手动创建
  @Post()
  @HttpCode(200)
  create(@Body() body: any) {
    return this.assignmentsService.create(body);
  }

  // 确认下发
  @Post(':id/publish')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  publish(@Param('id') id: string) {
    return this.assignmentsService.confirmAndPublish(Number(id));
  }

  // 按班级查询
  @Get()
  findByClass(@Query('classId') classId: string) {
    const id = Number(classId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 classId 参数');
    }
    return this.assignmentsService.findByClass(id);
  }

  // 学生查询自己的作业
  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.assignmentsService.findByStudent(Number(studentId));
  }

  // 待复核列表（必须放在 :id 之前，否则会被 :id 路由拦截）
  @Get('review/pending')
  pendingReview(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.gradingService.findPendingReview(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assignmentsService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.assignmentsService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assignmentsService.remove(Number(id));
  }

  // 学生提交作业（支持拍照）
  @Post(':id/submit/:studentId')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', fileUploadOptions))
  submit(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    let content = null;
    try {
      content = body.content ? JSON.parse(body.content) : null;
    } catch {
      content = body.content;
    }
    return this.assignmentsService.submit(Number(id), Number(studentId), { content, file });
  }

  // AI 批改
  @Post('submission/:submissionId/grade')
  @HttpCode(200)
  grade(@Param('submissionId') submissionId: string) {
    return this.gradingService.gradeSubmission(Number(submissionId));
  }

  // 老师复核
  @Post('submission/:submissionId/review')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  review(
    @Param('submissionId') submissionId: string,
    @Body() body: { score: number; comment: string },
    @Req() req: any,
  ) {
    return this.gradingService.review(Number(submissionId), body.score, body.comment, req.user?.id);
  }
}
