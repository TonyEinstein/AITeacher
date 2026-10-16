import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private schoolsService: SchoolsService) {}

  @Post()
  @HttpCode(200)
  @Roles('super_admin')
  create(@Body() body: any) {
    return this.schoolsService.create(body);
  }

  @Get()
  @Roles('super_admin')
  findAll(@Query('page') page = 1, @Query('pageSize') pageSize = 20, @Query('keyword') keyword?: string, @Query('status') status?: string) {
    return this.schoolsService.findAll(Number(page), Number(pageSize), keyword, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(Number(id));
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() body: any) {
    return this.schoolsService.update(Number(id), body);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.schoolsService.remove(Number(id));
  }
}