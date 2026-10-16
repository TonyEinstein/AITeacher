import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  // 全部学科字典
  findAll() {
    return this.prisma.subject.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }
}
