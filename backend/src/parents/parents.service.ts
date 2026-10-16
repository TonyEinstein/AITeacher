import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParentsService {
  constructor(private prisma: PrismaService) {}

  // 家长绑定学生（通过学号 + 姓名验证）
  async bindStudent(parentId: number, studentNo: string, studentName: string, relation: string, phone?: string) {
    const student = await this.prisma.student.findUnique({
      where: { studentNo },
    });

    if (!student || student.name !== studentName) {
      throw new BadRequestException('学号或姓名不正确');
    }

    return this.prisma.parent.update({
      where: { id: parentId },
      data: {
        studentId: student.id,
        name: studentName + '家长',
        relation,
        phone,
      },
      include: { student: true },
    });
  }

  findOne(id: number) {
    return this.prisma.parent.findUnique({
      where: { id },
      include: { student: { include: { class: { include: { grade: true } } } } },
    });
  }
}