import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { CampusesService } from './campuses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('campuses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'group_admin', 'school_admin')
export class CampusesController {
  constructor(private readonly service: CampusesService) {}

  @Get('school/:schoolId')
  list(@Param('schoolId', ParseIntPipe) schoolId: number) {
    return this.service.listBySchool(schoolId);
  }

  /**
   * 跨校区汇总（PRD §3.32）
   *
   * super_admin 可显式指定 schoolId 看任意集团；
   * 集团管理员 / 校区管理员只能看自己所属集团（以 JWT 里的 schoolId 为准，不信任 query）。
   */
  @Get('group-overview')
  @Roles('super_admin', 'group_admin', 'school_admin')
  groupOverview(@Req() req: any, @Query('schoolId') schoolId?: string) {
    const user = req.user;
    const isPlatform = user?.role === 'super_admin';
    const scoped = isPlatform ? (schoolId ? Number(schoolId) : user?.schoolId) : user?.schoolId;
    if (!scoped) throw new BadRequestException('无法确定集团：用户未绑定学校，请显式指定 schoolId');
    return this.service.groupOverview(Number(scoped));
  }

  @Post()
  @HttpCode(200)
  create(@Body() body: { schoolId: number; name: string; address?: string }) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.update(id, body);
  }
}
