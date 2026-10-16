import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        company: dto.company,
        message: dto.message || null,
      },
    });
  }

  async findAll(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.lead.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { shareSnapshot: { select: { id: true, type: true, targetId: true } } },
      }),
      this.prisma.lead.count(),
    ]);
    return { list, total, page, pageSize };
  }

  async findOne(id: number) {
    return this.prisma.lead.findUnique({ where: { id } });
  }

  async remove(id: number) {
    return this.prisma.lead.delete({ where: { id } });
  }
}
