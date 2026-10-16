import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'group_admin', 'school_admin')
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  @Post()
  @HttpCode(200)
  create(@Body() body: any) {
    return this.studentsService.create(body);
  }

  @Get()
  findByClass(@Query('classId') classId: string) {
    const id = Number(classId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 classId 参数');
    }
    return this.studentsService.findByClass(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.studentsService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studentsService.remove(Number(id));
  }
}
