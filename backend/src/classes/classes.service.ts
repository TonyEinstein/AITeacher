import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.class.create({ data });
  }

  findByGrade(gradeId: number) {
    return this.prisma.class.findMany({
      where: { gradeId },
      include: { students: true },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.class.findUnique({
      where: { id },
      include: { students: true, grade: true },
    });
  }

  update(id: number, data: any) {
    return this.prisma.class.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.class.delete({ where: { id } });
  }
}