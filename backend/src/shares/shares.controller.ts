import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SharesService } from './shares.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// 公开传播页面：浏览限流放宽到 120 次/分（朋友圈转发可能瞬时多人点开）
const PUBLIC_THROTTLE = { default: { ttl: 60_000, limit: 120 } };

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  // 生成学生快照（需登录）
  @Post('student/:studentId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  createStudentSnapshot(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.sharesService.createStudentSnapshot(studentId);
  }

  // 生成班级快照
  @Post('class/:classId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  createClassSnapshot(@Param('classId', ParseIntPipe) classId: number) {
    return this.sharesService.createGroupSnapshot('class', classId);
  }

  // 生成年级快照
  @Post('grade/:gradeId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  createGradeSnapshot(@Param('gradeId', ParseIntPipe) gradeId: number) {
    return this.sharesService.createGroupSnapshot('grade', gradeId);
  }

  // 生成学校快照
  @Post('school/:schoolId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  createSchoolSnapshot(@Param('schoolId', ParseIntPipe) schoolId: number) {
    return this.sharesService.createGroupSnapshot('school', schoolId);
  }

  // 免登录查看快照（公开，朋友圈点开直接看）
  @Get('public/:id')
  @Throttle(PUBLIC_THROTTLE)
  viewPublic(@Param('id', ParseIntPipe) id: number) {
    return this.sharesService.viewSnapshot(id);
  }

  // 留资提交（公开，底部 CTA）
  @Post('public/:id/lead')
  @HttpCode(200)
  @Throttle(PUBLIC_THROTTLE)
  submitLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; phone: string; company?: string; message?: string },
  ) {
    return this.sharesService.submitLead(id, body);
  }

  // 管理员查看留资列表
  @Get('leads/list')
  @UseGuards(JwtAuthGuard)
  listLeads() {
    return this.sharesService.listLeads();
  }

  // 分享传播数据看板（按学校聚合：浏览量/留资/转化率/趋势，PRD §3.29）
  @Get('dashboard/school/:schoolId')
  @UseGuards(JwtAuthGuard)
  schoolDashboard(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Query('days') days?: string,
  ) {
    return this.sharesService.schoolDashboard(schoolId, days ? Number(days) : 30);
  }
}
