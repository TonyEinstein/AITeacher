import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { LessonRecordsService } from './lesson-records.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('lesson-records')
@UseGuards(JwtAuthGuard)
export class LessonRecordsController {
  constructor(private recordsService: LessonRecordsService) {}

  @Post('start')
  @HttpCode(200)
  start(@Body('scheduleId') scheduleId: number) {
    return this.recordsService.startLesson(Number(scheduleId));
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@Param('id') id: string, @Body() body: any) {
    return this.recordsService.endLesson(Number(id), body?.summary);
  }

  @Post(':id/behavior-event')
  @HttpCode(200)
  addBehaviorEvent(@Param('id') id: string, @Body() event: any) {
    return this.recordsService.addBehaviorEvent(Number(id), event);
  }

  @Post(':id/attendance')
  @HttpCode(200)
  recordAttendance(
    @Param('id') id: string,
    @Body() body: { studentId: number; status: string },
  ) {
    return this.recordsService.recordAttendance(Number(id), body.studentId, body.status);
  }

  @Get()
  findByClass(
    @Query('classId') classId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const id = Number(classId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 classId 参数');
    }
    return this.recordsService.findByClass(id, startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recordsService.findOne(Number(id));
  }
}
