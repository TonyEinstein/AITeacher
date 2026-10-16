import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { StudentsService } from './students.service';

/**
 * 学生端公开查询（登录前使用，不带 JWT 守卫）
 * 路由顺序：lookup 必须在 students.controller 的 :id 之前注册
 */
@Controller('students')
export class StudentsPublicController {
  constructor(private studentsService: StudentsService) {}

  /** 学生端登录：按学号（+姓名可选）查询学生 */
  @Get('lookup')
  lookup(@Query('studentNo') studentNo: string, @Query('name') name?: string) {
    if (!studentNo || !studentNo.trim()) {
      throw new BadRequestException('缺少 studentNo 参数');
    }
    return this.studentsService.lookup(studentNo.trim(), name);
  }
}
