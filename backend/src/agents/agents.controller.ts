import { Controller, Get, Post, Body, Param, Put, Patch, Delete, Query, UseGuards, Req, ForbiddenException, HttpCode, BadRequestException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post()
  @HttpCode(200)
  create(@Req() req: any, @Body() body: any) {
    this.assertSubjectOwnership(req.user, body.subjectId);
    return this.agentsService.create(body);
  }

  @Get()
  findBySchool(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.agentsService.findBySchool(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(Number(id));
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.assertSubjectOwnership(req.user, body.subjectId);
    return this.agentsService.update(Number(id), body);
  }

  @Patch(':id/style')
  updateStyle(@Param('id') id: string, @Body() body: { style: string }) {
    return this.agentsService.update(Number(id), { style: body.style });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agentsService.remove(Number(id));
  }

  // subject_admin 只能操作自己学科的数据
  private assertSubjectOwnership(user: any, subjectId: any) {
    if (user?.role === 'subject_admin') {
      if (subjectId === undefined || Number(subjectId) !== Number(user.subjectId)) {
        throw new ForbiddenException('无权操作其他学科的数据');
      }
    }
  }
}
