import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  // 学科字典列表
  @Get()
  list() {
    return this.service.findAll();
  }
}
