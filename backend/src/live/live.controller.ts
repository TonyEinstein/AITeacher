import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LiveService } from './live.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('live')
@UseGuards(JwtAuthGuard)
export class LiveController {
  constructor(private service: LiveService) {}

  @Get('push/room/:roomId')
  getPushUrl(@Param('roomId') roomId: string) {
    const key = this.service.getStreamKeyByRoom(Number(roomId));
    return { streamKey: key, ...this.service.getPushUrl(key) };
  }

  @Get('pull/room/:roomId')
  getPullUrl(@Param('roomId') roomId: string) {
    const key = this.service.getStreamKeyByRoom(Number(roomId));
    return { streamKey: key, ...this.service.getPullUrl(key) };
  }

  @Get('pull/lesson/:scheduleId')
  getLessonPullUrl(@Param('scheduleId') scheduleId: string) {
    const key = this.service.getStreamKeyBySchedule(Number(scheduleId));
    return { streamKey: key, ...this.service.getPullUrl(key) };
  }
}
