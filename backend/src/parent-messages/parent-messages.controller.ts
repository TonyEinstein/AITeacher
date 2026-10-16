import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, HttpCode, BadRequestException } from '@nestjs/common';
import { ParentMessagesService } from './parent-messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('parent-messages')
@UseGuards(JwtAuthGuard)
export class ParentMessagesController {
  constructor(private service: ParentMessagesService) {}

  @Post()
  @HttpCode(200)
  create(@Request() req: any, @Body() body: { content: string; studentId?: number }) {
    return this.service.create(req.user.sub || req.user.id, body.content, body.studentId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  findPending(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.service.findPending(id);
  }

  @Get('mine')
  findMine(@Request() req: any) {
    return this.service.findByParent(req.user.sub || req.user.id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  approve(@Param('id') id: string) {
    return this.service.approve(Number(id));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  reject(@Param('id') id: string) {
    return this.service.reject(Number(id));
  }

  @Post(':id/delivered')
  @HttpCode(200)
  markDelivered(@Param('id') id: string) {
    return this.service.markDelivered(Number(id));
  }
}
