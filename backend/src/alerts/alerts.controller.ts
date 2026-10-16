import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'group_admin', 'school_admin', 'grade_admin')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  /** 预警列表；super_admin 不传 schoolId 看全部，校管/年级管强制看本校 */
  @Get()
  list(@Req() req: any, @Query() query: any) {
    return this.service.list({
      schoolId: this.resolveSchoolId(req, query.schoolId),
      status: query.status,
      level: query.level,
      type: query.type,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  /** 预警统计（按类型/等级聚合） */
  @Get('stats')
  stats(@Req() req: any, @Query('schoolId') schoolId?: string) {
    return this.service.stats(this.resolveSchoolId(req, schoolId));
  }

  /** 某个学生的预警历史 */
  @Get('student/:studentId')
  byStudent(@Param('studentId') studentId: string) {
    return this.service.byStudent(Number(studentId));
  }

  /** 手动触发一次扫描（super_admin 可指定集团；集团管理员只能扫本集团） */
  @Post('scan')
  @Roles('super_admin', 'group_admin')
  @HttpCode(200)
  scan(@Req() req: any, @Query('schoolId') schoolId?: string) {
    const user = req.user;
    // 非平台角色强制限本集团；未绑定学校时用 -1 兜底（扫不到任何学校，失败关闭）
    const scoped =
      user?.role === 'super_admin'
        ? schoolId
          ? Number(schoolId)
          : undefined
        : (user?.schoolId ?? -1);
    return this.service.scan(scoped);
  }

  /** 处理预警：handled 已处理 / ignored 已忽略 */
  @Post(':id/handle')
  @HttpCode(200)
  handle(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const status = body?.status === 'ignored' ? 'ignored' : 'handled';
    return this.service.handle(Number(id), status, req.user?.id);
  }

  /** 校管/年级管强制限定本校，super_admin 可跨校 */
  private resolveSchoolId(req: any, raw?: string): number | undefined {
    const user = req.user;
    if (user?.role === 'super_admin' || user?.role === 'group_admin') {
      return raw ? Number(raw) : undefined;
    }
    return user?.schoolId ?? undefined;
  }
}
