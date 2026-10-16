import { Controller, Get, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private service: DashboardService) {}

  /**
   * 数据范围解析（PRD §3.32 / §8.7）
   *
   * - super_admin：平台视角；不传 schoolId 时看全部学校
   * - group_admin：**只能看本集团**（以 JWT 里的 schoolId 为准，忽略 query 传参）
   * - school_admin：只能看本校
   *
   * 注意：`RolesGuard` 会把 group_admin 视为 super_admin 以复用角色白名单，
   * 因此**范围收窄必须在业务层显式做**，否则集团管理员可越权读取其他集团数据。
   */
  private resolveScope(req: any, rawSchoolId?: string): number | undefined {
    const user = req.user;
    if (user?.role === 'super_admin') {
      return rawSchoolId ? Number(rawSchoolId) : undefined;
    }
    if (!user?.schoolId) {
      // 非平台角色必须绑定学校，否则无法确定范围 —— 失败关闭，不放行全量
      throw new ForbiddenException('账号未绑定学校，无法确定数据范围');
    }
    return user.schoolId;
  }

  // 公司级数据：super_admin 看全部；group_admin 只看本集团
  @Get('global')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin')
  globalOverview(@Req() req: any, @Query('schoolId') schoolId?: string) {
    return this.service.globalOverview(this.resolveScope(req, schoolId));
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  schoolHealth(@Req() req: any) {
    return this.service.schoolHealth(this.resolveScope(req));
  }

  // LLM 用量监控（super_admin 全部；group_admin 本集团）
  @Get('usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin')
  usage(@Req() req: any, @Query('days') days?: string) {
    return this.service.getUsage(days ? Number(days) : 30, this.resolveScope(req));
  }

  // 成本 ROI 报表（PRD §3.11）：super_admin 看全部，school_admin 看本校
  @Get('roi')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'group_admin', 'school_admin')
  roi(@Req() req: any, @Query('schoolId') schoolId?: string) {
    const user = req.user;
    const scoped =
      user?.role === 'super_admin' || user?.role === 'group_admin'
        ? schoolId
          ? Number(schoolId)
          : undefined
        : user?.schoolId ?? undefined;
    return this.service.roiReport(scoped);
  }

  @Get('school/:schoolId')
  schoolOverview(@Param('schoolId') schoolId: string) {
    return this.service.schoolOverview(Number(schoolId));
  }
  @Get('grade/:gradeId')
  gradeOverview(@Param('gradeId') gradeId: string) {
    return this.service.gradeOverview(Number(gradeId));
  }

  @Get('class/:classId')
  classOverview(@Param('classId') classId: string) {
    return this.service.classOverview(Number(classId));
  }
}
