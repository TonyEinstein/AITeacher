import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rankings')
@UseGuards(JwtAuthGuard)
export class RankingsController {
  constructor(private readonly service: RankingsService) {}

  @Get('class/:classId')
  classRanking(@Param('classId', ParseIntPipe) classId: number) {
    return this.service.classRanking(classId);
  }

  @Get('grade/:gradeId')
  gradeRanking(@Param('gradeId', ParseIntPipe) gradeId: number) {
    return this.service.gradeRanking(gradeId);
  }

  @Get('class-performance/:classId')
  classPerf(@Param('classId', ParseIntPipe) classId: number) {
    return this.service.classPerformance(classId);
  }

  @Get('grade-performance/:gradeId')
  gradePerf(@Param('gradeId', ParseIntPipe) gradeId: number) {
    return this.service.gradePerformance(gradeId);
  }

  @Get('cross-school/:studentId')
  crossSchool(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('scope') scope: 'county' | 'city' | 'province' | 'national' = 'city',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.crossSchoolRanking(
      studentId,
      scope,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
    );
  }
}