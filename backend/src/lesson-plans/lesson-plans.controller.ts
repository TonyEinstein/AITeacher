import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { LessonPlansService } from './lesson-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('lesson-plans')
@UseGuards(JwtAuthGuard)
export class LessonPlansController {
  constructor(private lessonPlansService: LessonPlansService) {}

  @Post('generate-outline')
  @HttpCode(200)
  generateOutline(@Body('textbookId') textbookId: number) {
    return this.lessonPlansService.generateOutline(Number(textbookId));
  }

  @Post('generate')
  @HttpCode(200)
  generate(@Body() body: { textbookId: number; chapter: string }) {
    return this.lessonPlansService.generateLessonPlan(Number(body.textbookId), body.chapter);
  }

  @Get()
  findByTextbook(@Query('textbookId') textbookId: string) {
    const id = Number(textbookId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 textbookId 参数');
    }
    return this.lessonPlansService.findByTextbook(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lessonPlansService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.lessonPlansService.update(Number(id), body);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@Param('id') id: string) {
    return this.lessonPlansService.confirm(Number(id));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonPlansService.remove(Number(id));
  }
}