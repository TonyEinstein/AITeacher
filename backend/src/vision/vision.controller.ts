import { Controller, Post, Get, Body, Param, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { VisionService } from './vision.service';
import type { VisionEventDto, MinuteAggregateDto } from './vision.service';

// 边缘设备是高频机器调用（每分钟聚合 + 事件流），不适用人类用户的 60 次/分限流
@SkipThrottle()
@Controller('vision')
export class VisionController {
  constructor(private readonly vision: VisionService) {}

  /** 边缘端上报单条行为事件 */
  @Post('events')
  async reportEvent(
    @Headers('x-edge-token') token: string,
    @Body() dto: VisionEventDto,
  ) {
    // 简单鉴权：开发阶段用固定 token，生产换成按设备颁发
    if (token !== process.env.EDGE_API_TOKEN && process.env.EDGE_API_TOKEN) {
      throw new UnauthorizedException('invalid edge token');
    }
    return this.vision.ingestEvent(dto);
  }

  /** 边缘端上报每分钟聚合统计 */
  @Post('aggregates')
  async reportAggregate(
    @Headers('x-edge-token') token: string,
    @Body() dto: MinuteAggregateDto,
  ) {
    if (token !== process.env.EDGE_API_TOKEN && process.env.EDGE_API_TOKEN) {
      throw new UnauthorizedException('invalid edge token');
    }
    return this.vision.ingestMinuteAggregate(dto);
  }

  /** 后台查询某节课的事件流 */
  @Get('lessons/:lessonRecordId/events')
  listLessonEvents(@Param('lessonRecordId') id: string, @Query('limit') limit?: string) {
    return this.vision.listEvents(parseInt(id, 10), parseInt(limit || '100', 10));
  }

  /** 后台查询某节课的每分钟聚合 */
  @Get('lessons/:lessonRecordId/aggregates')
  listLessonAggregates(@Param('lessonRecordId') id: string) {
    return this.vision.listAggregates(parseInt(id, 10));
  }

  /** 边缘端拉取远程配置（阈值/白名单/模型版本）；带 serial 时附带当前课次上下文 */
  @Get('config')
  getEdgeConfig(@Headers('x-edge-token') token: string, @Query('serial') serial?: string) {
    if (token !== process.env.EDGE_API_TOKEN && process.env.EDGE_API_TOKEN) {
      throw new UnauthorizedException('invalid edge token');
    }
    return this.vision.getEdgeConfig(serial);
  }
}
