import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { GradesService } from './grades.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'group_admin', 'school_admin')
export class GradesController {
  constructor(private gradesService: GradesService) {}

  @Post()
  @HttpCode(200)
  create(@Body() body: any) {
    return this.gradesService.create(body);
  }

  @Get()
  findBySchool(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.gradesService.findBySchool(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gradesService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.gradesService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gradesService.remove(Number(id));
  }
}
