import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class LessonPlansService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  // AI 生成大纲
  async generateOutline(textbookId: number) {
    const textbook = await this.prisma.textbook.findUnique({
      where: { id: textbookId },
      include: { subject: true },
    });
    if (!textbook) throw new BadRequestException('教材不存在');

    const outline = await this.llm.generateOutline(textbook.title, textbook.subject.name, '');
    return { outline };
  }

  // AI 生成教案
  async generateLessonPlan(textbookId: number, chapter: string) {
    const textbook = await this.prisma.textbook.findUnique({
      where: { id: textbookId },
      include: { subject: true },
    });
    if (!textbook) throw new BadRequestException('教材不存在');

    const content = await this.llm.generateLessonPlan(textbook.subject.name, chapter, '');

    return this.prisma.lessonPlan.create({
      data: {
        textbookId,
        subjectId: textbook.subjectId,
        title: chapter,
        chapter,
        content: { generated: content },
        status: 'draft',
      },
    });
  }

  findByTextbook(textbookId: number) {
    return this.prisma.lessonPlan.findMany({
      where: { textbookId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.lessonPlan.findUnique({ where: { id } });
  }

  update(id: number, data: any) {
    return this.prisma.lessonPlan.update({ where: { id }, data });
  }

  // 确认并锁版
  confirm(id: number) {
    return this.prisma.lessonPlan.update({
      where: { id },
      data: { status: 'locked' },
    });
  }

  remove(id: number) {
    return this.prisma.lessonPlan.delete({ where: { id } });
  }
}