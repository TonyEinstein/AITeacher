import { Controller, Get, Post, Param, ParseIntPipe, Query, UseGuards, HttpCode } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @Query('studentId') studentId?: string,
    @Query('userId') userId?: string,
    @Query('unread') unread?: string,
  ) {
    return this.service.list(
      studentId ? parseInt(studentId) : undefined,
      userId ? parseInt(userId) : undefined,
      unread === 'true' || unread === '1',
    );
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.service.markRead(id);
  }

  @Get('unread-count')
  unread(@Query('studentId') studentId?: string) {
    return this.service.unreadCount(studentId ? parseInt(studentId) : undefined).then((count) => ({ count }));
  }
}