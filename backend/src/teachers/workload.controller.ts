import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkloadService } from './workload.service';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkloadController {
  constructor(private readonly workload: WorkloadService) {}

  /** 单校教师工作量总览（复核量、审批时效，PRD §3.14） */
  @Get('workload')
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin')
  schoolWorkload(@Query('schoolId') schoolId: string, @Query('days') days?: string, @Req() req?: any) {
    // 集团管理员只看本集团绑定校；其余按 query 或用户归属
    const id = Number(schoolId) || req?.user?.schoolId;
    return this.workload.schoolOverview(Number(id), days ? Number(days) : 30);
  }

  /** 教师个人工作量（本人或管理员查看） */
  @Get('workload/me')
  @Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin', 'subject_admin', 'teacher')
  myWorkload(@Req() req: any, @Query('days') days?: string) {
    return this.workload.personalWorkload(req.user.id, days ? Number(days) : 30);
  }
}
