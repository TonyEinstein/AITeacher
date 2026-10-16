import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'group_admin', 'school_admin')
export class ClassesController {
  constructor(private classesService: ClassesService) {}

  @Post()
  @HttpCode(200)
  create(@Body() body: any) {
    return this.classesService.create(body);
  }

  @Get()
  findByGrade(@Query('gradeId') gradeId: string) {
    const id = Number(gradeId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 gradeId 参数');
    }
    return this.classesService.findByGrade(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.classesService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classesService.remove(Number(id));
  }
}
