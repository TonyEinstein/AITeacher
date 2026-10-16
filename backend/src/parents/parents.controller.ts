import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('parents')
export class ParentsController {
  constructor(private parentsService: ParentsService) {}

  @Post('bind')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  bindStudent(
    @Request() req: any,
    @Body() body: { studentNo: string; studentName: string; relation: string; phone?: string },
  ) {
    return this.parentsService.bindStudent(
      req.user.sub || req.user.id,
      body.studentNo,
      body.studentName,
      body.relation,
      body.phone,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyInfo(@Request() req: any) {
    return this.parentsService.findOne(req.user.sub || req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.parentsService.findOne(Number(id));
  }
}