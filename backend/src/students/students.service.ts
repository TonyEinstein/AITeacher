import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.student.create({ data });
  }

  findByClass(classId: number) {
    return this.prisma.student.findMany({
      where: { classId },
      orderBy: { studentNo: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.student.findUnique({
      where: { id },
      include: { class: { include: { grade: true } }, parents: true },
    });
  }

  /** 学生端登录：按学号（+姓名可选）查询学生 */
  async lookup(studentNo: string, name?: string) {
    const student = await this.prisma.student.findFirst({
      where: { studentNo, ...(name ? { name } : {}) },
      include: { class: { include: { grade: true } }, parents: true },
    });
    if (!student) throw new NotFoundException('未找到该学生，请核对学号');
    return student;
  }

  update(id: number, data: any) {
    return this.prisma.student.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.student.delete({ where: { id } });
  }
}