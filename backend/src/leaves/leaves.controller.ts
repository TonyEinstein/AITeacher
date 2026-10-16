import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards, HttpCode } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  @Post('apply/:studentId')
  @HttpCode(200)
  apply(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() body: { type: string; startDate: string; endDate?: string; reason: string },
  ) {
    return this.service.apply(studentId, body);
  }

  @Post(':id/review')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { approved: boolean; reviewerId: number; comment?: string },
  ) {
    return this.service.approve(id, body.approved, body.reviewerId, body.comment);
  }

  @Get('pending/:schoolId')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  pending(@Param('schoolId', ParseIntPipe) schoolId: number) {
    return this.service.pending(schoolId);
  }

  @Get('student/:studentId')
  byStudent(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.service.byStudent(studentId);
  }

  @Get('on-leave/:studentId')
  isOnLeave(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.service.isOnLeave(studentId).then((onLeave) => ({ onLeave }));
  }
}
