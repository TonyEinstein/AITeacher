import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, HttpCode } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}

  @Get()
  @Roles('super_admin', 'group_admin', 'school_admin')
  findAll(@Req() req: any, @Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.service.findAll(Number(page), Number(pageSize), req.user);
  }

  @Get('school/:schoolId')
  @Roles('super_admin', 'group_admin', 'school_admin')
  findBySchool(@Param('schoolId') schoolId: string) {
    return this.service.findBySchool(Number(schoolId));
  }

  @Post('school/:schoolId/renew')
  @HttpCode(200)
  @Roles('super_admin', 'group_admin', 'school_admin')
  renew(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.service.renew(Number(schoolId), body);
  }

  @Put('school/:schoolId/configure')
  @Roles('super_admin', 'group_admin', 'school_admin')
  configure(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.service.configure(Number(schoolId), body);
  }

  @Put('school/:schoolId/disable')
  @Roles('super_admin', 'group_admin', 'school_admin')
  disable(@Param('schoolId') schoolId: string) {
    return this.service.disable(Number(schoolId));
  }

  @Put('school/:schoolId/enable')
  @Roles('super_admin', 'group_admin', 'school_admin')
  enable(@Param('schoolId') schoolId: string) {
    return this.service.enable(Number(schoolId));
  }
}
