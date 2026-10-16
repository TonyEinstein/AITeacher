import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SurveysService {
  constructor(private prisma: PrismaService) {}

  create(title: string, questions: any[]) {
    return this.prisma.survey.create({ data: { title, questions } });
  }

  listActive() {
    return this.prisma.survey.findMany({ where: { status: 'active' } });
  }

  // 管理端：全量分页列表
  async findAll(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.survey.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { surveyResponses: true } } },
      }),
      this.prisma.survey.count(),
    ]);
    return { list, total, page, pageSize };
  }

  async submit(surveyId: number, answers: any, parentId?: number) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('问卷不存在');
    return this.prisma.surveyResponse.create({
      data: { surveyId, answers, parentId },
    });
  }

  async stats(surveyId: number) {
    const responses = await this.prisma.surveyResponse.findMany({ where: { surveyId } });
    return {
      totalResponses: responses.length,
      responses: responses.map((r) => r.answers),
    };
  }
}