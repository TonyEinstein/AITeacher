import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.room.create({ data });
  }

  findBySchool(schoolId: number) {
    return this.prisma.room.findMany({
      where: { schoolId },
      include: { boxes: true },
      orderBy: { code: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.room.findUnique({ where: { id }, include: { boxes: true } });
  }

  update(id: number, data: any) {
    return this.prisma.room.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.room.delete({ where: { id } });
  }
}