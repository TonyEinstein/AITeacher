import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private service: TrackingService) {}

  /** 官网转化埋点（无需登录） */
  @Post('events')
  @HttpCode(200)
  create(@Body() body: any) {
    return this.service.create(body);
  }
}
