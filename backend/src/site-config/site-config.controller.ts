import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SiteConfigService } from './site-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('site-config')
export class SiteConfigController {
  constructor(private service: SiteConfigService) {}

  /** 官网公开读取（无需登录） */
  @Get('public')
  getPublic() {
    return this.service.getPublic();
  }

  /** 管理端读取（super_admin） */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  get() {
    return this.service.get();
  }

  /** 管理端更新（super_admin）：ICP 备案号/联系方式/数据背书等 */
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  update(@Body() body: any) {
    return this.service.update(body);
  }
}
