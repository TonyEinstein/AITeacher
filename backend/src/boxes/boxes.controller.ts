import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, Req, HttpCode, Headers, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BoxesService } from './boxes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('boxes')
export class BoxesController {
  constructor(private boxesService: BoxesService) {}

  @Post('register')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  register(@Body() body: { serialNumber: string; schoolId: number; type?: string }, @Req() req: any) {
    return this.boxesService.register(body, req.user);
  }

  // 设备心跳：设备端无 JWT，用注册时下发的 X-Device-Token 鉴权（高频机器调用，不限流）
  @Post('heartbeat/:serial')
  @HttpCode(200)
  @SkipThrottle()
  heartbeat(
    @Param('serial') serial: string,
    @Headers('x-device-token') deviceToken: string,
    @Body() body: { faultCode?: string; faultMessage?: string },
  ) {
    return this.boxesService.heartbeat(serial, deviceToken, body.faultCode, body.faultMessage);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  findBySchool(
    @Query('schoolId') schoolId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.boxesService.findBySchool(id, Number(page), Number(pageSize));
  }

  // 公司级设备总览（超级管理员看全部；集团管理员只看本集团）——必须在 :serial 路由之前声明
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin')
  findAll(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 50,
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: string,
    @Query('faultOnly') faultOnly?: string,
  ) {
    const user = req.user;
    // 集团管理员强制限本集团，忽略 query 传参；未绑定学校时用 -1 兜底（查不到数据，失败关闭）
    const scopedSchoolId =
      user?.role === 'super_admin'
        ? schoolId
          ? Number(schoolId)
          : undefined
        : (user?.schoolId ?? -1);
    return this.boxesService.findAll({
      page: Number(page),
      pageSize: Number(pageSize),
      schoolId: scopedSchoolId,
      status,
      faultOnly: faultOnly === 'true',
    });
  }

  // OTA：盒子查询最新版本（设备端调用，不走 JWT；升级脚本重试频繁，不限流）
  @Get('ota/latest')
  @SkipThrottle()
  getLatestOta(@Query('serial') serial: string) {
    if (!serial || !serial.trim()) {
      throw new BadRequestException('缺少 serial 参数');
    }
    return this.boxesService.getLatestOta(serial);
  }

  // OTA：盒子上报升级结果（设备端，不限流）
  @Post('ota/report')
  @HttpCode(200)
  @SkipThrottle()
  reportOta(@Body() body: { serial: string; version: string; status: string }) {
    return this.boxesService.reportOta(body.serial, body.version, body.status);
  }

  // ===== OTA 灰度发布与回滚（PRD §4.4.1）=====

  /** 发布新版本到指定通道（canary 灰度 / stable 正式） */
  @Post('ota/releases')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin')
  publishRelease(
    @Body()
    body: {
      version: string;
      packageUrl: string;
      checksum?: string;
      channel: 'canary' | 'stable';
      note?: string;
    },
    @Req() req: any,
  ) {
    return this.boxesService.publishRelease({ ...body, createdBy: req.user?.id });
  }

  /** 回滚指定通道到旧版本 */
  @Post('ota/rollback')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin')
  rollback(
    @Body()
    body: {
      channel: 'canary' | 'stable';
      rollbackToVersion: string;
      packageUrl: string;
      checksum?: string;
      note?: string;
    },
    @Req() req: any,
  ) {
    return this.boxesService.rollbackRelease({ ...body, createdBy: req.user?.id });
  }

  /** 设置盒子灰度分组 */
  @Put(':id/ota-group')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  setOtaGroup(@Param('id') id: string, @Body('group') group: 'canary' | 'stable') {
    return this.boxesService.setOtaGroup(Number(id), group);
  }

  /** 发布历史（回滚溯源） */
  @Get('ota/releases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  listReleases(@Query('channel') channel?: 'canary' | 'stable') {
    return this.boxesService.listReleases(channel);
  }

  @Get(':serial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  findBySerial(@Param('serial') serial: string) {
    return this.boxesService.findBySerial(serial);
  }

  @Put(':id/assign-room')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  assignRoom(@Param('id') id: string, @Body('roomId') roomId: number) {
    return this.boxesService.assignRoom(Number(id), roomId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  remove(@Param('id') id: string) {
    return this.boxesService.remove(Number(id));
  }
}
