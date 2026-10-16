import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  create(@Body() body: any) {
    return this.schedulesService.create(body);
  }

  @Post('auto')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  autoSchedule(@Body() body: { schoolId: number; classId: number; lessonPlanIds: number[] }) {
    return this.schedulesService.autoSchedule(body.schoolId, body.classId, body.lessonPlanIds);
  }

  // ===== 调课：整体顺延 / 临时停课 / 单节改时间（PRD §3.15、§3.23）=====

  /** 调课整体顺延：把某班/年级/学校 fromDate 之后未开始的课整体后移 N 天 */
  @Post('postpone')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin')
  postpone(
    @Body()
    body: { scope: 'class' | 'grade' | 'school'; targetId: number; fromDate: string; days: number },
  ) {
    return this.schedulesService.postpone(body);
  }

  /** 临时停课；可选同时安排补课（makeupStartTime / makeupEndTime） */
  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin')
  cancel(@Param('id') id: string, @Body() body: any) {
    return this.schedulesService.cancelLesson(Number(id), body ?? {});
  }

  /** 单节课改时间（带同班冲突检测） */
  @Put(':id/reschedule')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin')
  reschedule(@Param('id') id: string, @Body() body: { startTime: string; endTime: string }) {
    return this.schedulesService.reschedule(Number(id), body.startTime, body.endTime);
  }

  @Get()
  findByClass(@Query('classId') classId?: string, @Query('schoolId') schoolId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.schedulesService.findByClass(classId ? Number(classId) : undefined, schoolId ? Number(schoolId) : undefined, startDate, endDate);
  }

  @Get('today/:boxId')
  findTodayByBox(@Param('boxId') boxId: string) {
    return this.schedulesService.findTodayByBox(Number(boxId));
  }

  /** 某节课的补课记录 */
  @Get(':id/makeups')
  makeups(@Param('id') id: string) {
    return this.schedulesService.findMakeups(Number(id));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(Number(id));
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  update(@Param('id') id: string, @Body() body: any) {
    return this.schedulesService.update(Number(id), body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin')
  remove(@Param('id') id: string) {
    return this.schedulesService.remove(Number(id));
  }
}
