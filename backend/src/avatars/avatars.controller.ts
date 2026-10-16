import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, UseGuards, HttpCode } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('avatars')
@UseGuards(JwtAuthGuard)
export class AvatarsController {
  constructor(private readonly service: AvatarsService) {}

  @Get()
  list(@Query('schoolId') schoolId?: string) {
    return this.service.list(schoolId ? parseInt(schoolId) : undefined);
  }

  @Post()
  @HttpCode(200)
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post('custom/:schoolId')
  @HttpCode(200)
  custom(@Param('schoolId', ParseIntPipe) schoolId: number, @Body() body: any) {
    return this.service.createCustom(schoolId, body);
  }
}