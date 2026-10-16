import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, HttpCode } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrdersController {
  constructor(private service: WorkOrdersService) {}

  @Get('stats')
  @Roles('super_admin', 'group_admin', 'school_admin')
  stats(@Req() req: any) {
    return this.service.stats(req.user);
  }

  @Get()
  @Roles('super_admin', 'group_admin', 'school_admin')
  findAll(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('schoolId') schoolId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.findAll(Number(page), Number(pageSize), { status, type, schoolId: schoolId ? Number(schoolId) : undefined, keyword }, req.user);
  }

  @Get(':id')
  @Roles('super_admin', 'group_admin', 'school_admin')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Post()
  @HttpCode(200)
  @Roles('super_admin', 'group_admin', 'school_admin')
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Put(':id')
  @Roles('super_admin', 'group_admin', 'school_admin')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(Number(id), body);
  }

  @Put(':id/status')
  @Roles('super_admin', 'group_admin', 'school_admin')
  transition(@Param('id') id: string, @Body() body: any) {
    return this.service.transition(Number(id), body);
  }

  @Delete(':id')
  @Roles('super_admin', 'group_admin', 'school_admin')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
