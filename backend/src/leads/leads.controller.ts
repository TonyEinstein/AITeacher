import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// 公开留资接口独立限流：每 IP 每分钟 5 次（比全局 60 次更严，防表单刷量）
const PUBLIC_LEAD_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('leads')
export class LeadsController {
  constructor(private service: LeadsService) {}

  // 公开提交接口（官网表单用，不需要登录）
  @Post('public')
  @HttpCode(200)
  @Throttle(PUBLIC_LEAD_THROTTLE)
  createPublic(@Body() dto: CreateLeadDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  findAll(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.service.findAll(Number(page), Number(pageSize));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
