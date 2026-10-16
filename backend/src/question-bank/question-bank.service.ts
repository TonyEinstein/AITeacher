import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionBankService {
  constructor(private prisma: PrismaService) {}

  create(data: { subjectId: number; question: string; type: string; answer: string; difficulty: number; knowledgePoint?: string }) {
    return this.prisma.questionBank.create({ data });
  }

  async createMany(questions: any[]) {
    const result = await this.prisma.questionBank.createMany({ data: questions, skipDuplicates: true });
    return result;
  }

  list(subjectId?: number, difficulty?: number, knowledgePoint?: string, page = 1, pageSize = 50) {
    const where: any = {};
    if (subjectId) where.subjectId = subjectId;
    if (difficulty) where.difficulty = difficulty;
    if (knowledgePoint) where.knowledgePoint = { contains: knowledgePoint };
    return this.prisma.questionBank.findMany({
      where,
      include: { subject: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: number, data: any) {
    return this.prisma.questionBank.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.questionBank.delete({ where: { id } });
  }

  // 知识点列表
  knowledgePoints(subjectId: number) {
    return this.prisma.questionBank.findMany({
      where: { subjectId, knowledgePoint: { not: null } },
      select: { knowledgePoint: true },
      distinct: ['knowledgePoint'],
    });
  }
}