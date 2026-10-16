import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards, HttpCode } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('surveys')
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  // 管理端：全量分页列表（super_admin / school_admin）
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  findAll(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.service.findAll(Number(page), Number(pageSize));
  }

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  create(@Body() body: { title: string; questions: any[] }) {
    return this.service.create(body.title, body.questions);
  }

  @Get('active')
  listActive() { return this.service.listActive(); }

  @Post(':id/respond')
  @HttpCode(200)
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { answers: any; parentId?: number },
  ) {
    return this.service.submit(id, body.answers, body.parentId);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  stats(@Param('id', ParseIntPipe) id: number) {
    return this.service.stats(id);
  }
}
