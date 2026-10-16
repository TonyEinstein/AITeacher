import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'group_admin', 'school_admin')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Post()
  @HttpCode(200)
  create(@Body() body: any) {
    return this.roomsService.create(body);
  }

  @Get()
  findBySchool(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.roomsService.findBySchool(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.roomsService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomsService.remove(Number(id));
  }
}
