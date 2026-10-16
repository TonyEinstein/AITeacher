import {
  Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards,
 HttpCode } from '@nestjs/common';
import { TutoringService } from './tutoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tutoring')
@UseGuards(JwtAuthGuard)
export class TutoringController {
  constructor(private readonly tutoringService: TutoringService) {}

  // ===== 辅导服务订阅 =====
  @Post('subscribe/:studentId')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  subscribe(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() body: { plan?: string; months: number; glassesDeviceId?: number; watchDeviceId?: number },
  ) {
    return this.tutoringService.subscribe(studentId, body);
  }

  @Get('subscription/:studentId')
  getSubscription(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.tutoringService.getSubscription(studentId);
  }

  @Get('subscriptions/school/:schoolId')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  listSubscriptions(@Param('schoolId', ParseIntPipe) schoolId: number) {
    return this.tutoringService.listSubscriptions(schoolId);
  }

  @Post('cancel/:studentId')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  cancel(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.tutoringService.cancelSubscription(studentId);
  }

  // ===== 穿戴设备 =====
  @Post('devices/register')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  registerDevice(@Body() body: { schoolId: number; type: string; serialNumber: string; model?: string }) {
    return this.tutoringService.registerDevice(body);
  }

  @Get('devices/:schoolId')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  listDevices(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Query('type') type?: string,
  ) {
    return this.tutoringService.listDevices(schoolId, type);
  }

  @Post('devices/heartbeat/:serial')
  @HttpCode(200)
  heartbeat(@Param('serial') serial: string) {
    return this.tutoringService.deviceHeartbeat(serial);
  }

  // ===== 辅导会话 =====
  @Post('session/start/:studentId')
  @HttpCode(200)
  startSession(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.tutoringService.startSession(studentId);
  }

  @Post('session/:sessionId/chat')
  @HttpCode(200)
  chat(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() body: { message: string },
  ) {
    return this.tutoringService.chat(sessionId, body.message);
  }

  @Post('session/:sessionId/end')
  @HttpCode(200)
  endSession(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.tutoringService.endSession(sessionId);
  }

  @Get('history/:studentId')
  history(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.tutoringService.sessionHistory(studentId);
  }

  @Get('practice/:studentId')
  practiceHistory(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.tutoringService.practiceHistory(studentId);
  }

  @Get('stats/:studentId')
  stats(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.tutoringService.tutoringStats(studentId);
  }

  // ===== 近视提醒反馈（PRD §24.7）=====
  /** 眼镜/手表端上报「是否按提醒休息」 */
  @Post('myopia/:reminderId/rested')
  @HttpCode(200)
  reportMyopiaRested(
    @Param('reminderId', ParseIntPipe) reminderId: number,
    @Body() body: { studentId: number; rested: boolean },
  ) {
    return this.tutoringService.reportMyopiaRested(Number(body.studentId), reminderId, !!body.rested);
  }

  /** 近视提醒依从性统计（按提醒休息的比例） */
  @Get('myopia/:studentId/compliance')
  myopiaCompliance(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.tutoringService.myopiaComplianceStats(studentId);
  }
}
