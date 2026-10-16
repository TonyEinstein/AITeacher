import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.grade.create({ data });
  }

  findBySchool(schoolId: number) {
    return this.prisma.grade.findMany({
      where: { schoolId },
      include: { classes: true },
      orderBy: { id: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.grade.findUnique({ where: { id }, include: { classes: true } });
  }

  update(id: number, data: any) {
    return this.prisma.grade.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.grade.delete({ where: { id } });
  }
}