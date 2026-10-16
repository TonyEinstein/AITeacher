import { Controller, Get, Put, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly service: PreferencesService) {}

  @Get('student/:studentId')
  get(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.service.get(studentId);
  }

  @Put('student/:studentId')
  update(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() body: { style?: string; speed?: string; myopiaReminder?: boolean },
  ) {
    return this.service.update(studentId, body);
  }
}
