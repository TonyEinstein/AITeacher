import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.agent.create({ data });
  }

  findBySchool(schoolId: number) {
    return this.prisma.agent.findMany({
      where: { schoolId },
      include: { subject: true },
    });
  }

  findOne(id: number) {
    return this.prisma.agent.findUnique({
      where: { id },
      include: { subject: true },
    });
  }

  update(id: number, data: any) {
    return this.prisma.agent.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.agent.delete({ where: { id } });
  }
}