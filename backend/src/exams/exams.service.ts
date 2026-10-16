import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  create(data: any) {
    // 缺时间或时间非法时给合理默认值（一周后，时长 2 小时），避免 Invalid Date 导致 500
    const now = Date.now();
    const parsedStart = new Date(data.startTime);
    const parsedEnd = new Date(data.endTime);
    const startTime = isNaN(parsedStart.getTime()) ? new Date(now + 7 * 86400000) : parsedStart;
    const endTime = isNaN(parsedEnd.getTime()) ? new Date(startTime.getTime() + 2 * 3600000) : parsedEnd;

    return this.prisma.exam.create({
      data: {
        schoolId: Number(data.schoolId),
        name: data.name,
        type: data.type || 'monthly',
        subjectId: data.subjectId ? Number(data.subjectId) : null,
        startTime,
        endTime,
        status: 'scheduled',
      },
    });
  }

  findBySchool(schoolId: number) {
    return this.prisma.exam.findMany({
      where: { schoolId },
      include: { papers: true, scores: true },
      orderBy: { startTime: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.exam.findUnique({
      where: { id },
      include: { papers: true, scores: true },
    });
  }

  // AI 组卷
  async generatePaper(examId: number, params: {
    subject: string;
    totalScore: number;
    questionTypes: { type: string; count: number; score: number }[];
    knowledgePoints?: string[];
    difficulty?: string;
  }) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new BadRequestException('考试不存在');

    const typeDesc = params.questionTypes
      .map((t) => `${t.count}道${this.typeName(t.type)}(每题${t.score}分)`)
      .join('、');

    const prompt = `请生成一份${params.subject}试卷，满分${params.totalScore}分，难度${params.difficulty || '中等'}。
题型分布：${typeDesc}。
${params.knowledgePoints ? `知识点覆盖：${params.knowledgePoints.join('、')}` : ''}
输出JSON：{"title":"试卷标题","questions":[{"type":"choice","question":"题目","options":["A..","B..","C..","D.."],"answer":"A","score":5,"knowledgePoint":"知识点","difficulty":"easy|medium|hard"},...]}`;

    const result = await this.llm.chat([
      { role: 'system', content: '你是专业命题老师，只输出JSON。' },
      { role: 'user', content: prompt },
    ], { maxTokens: 8000 });

    let paperData;
    try {
      paperData = JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
      paperData = { title: 'AI生成试卷', questions: [], raw: result };
    }

    const paper = await this.prisma.paper.create({
      data: {
        examId,
        title: paperData.title || `${params.subject}试卷`,
        content: { ...paperData, totalScore: params.totalScore },
        status: 'draft',
      },
    });

    return paper;
  }

  private typeName(type: string) {
    const map: any = { choice: '选择题', fill: '填空题', essay: '简答题', calculation: '计算题' };
    return map[type] || type;
  }

  // 审卷并锁卷
  async lockPaper(paperId: number, updates?: any) {
    if (updates) {
      await this.prisma.paper.update({
        where: { id: paperId },
        data: { content: updates, status: 'reviewed' },
      });
    }
    return this.prisma.paper.update({
      where: { id: paperId },
      data: { status: 'locked' },
    });
  }

  // 记录作弊
  recordCheat(examId: number, studentId: number, type: string, evidence?: string) {
    return this.prisma.examCheat.create({
      data: { examId, studentId, type, evidence },
    });
  }

  // 录入成绩
  async recordScore(examId: number, studentId: number, score: number, paperId?: number) {
    let level = 'fail';
    if (score >= 85) level = 'excellent';
    else if (score >= 70) level = 'good';
    else if (score >= 60) level = 'pass';

    return this.prisma.score.create({
      data: { examId, studentId, score, paperId: paperId || null, level },
    });
  }

  // 考试分析报告
  async examAnalysis(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { scores: true },
    });
    if (!exam) throw new BadRequestException('考试不存在');

    const scores = exam.scores.map((s) => s.score);
    if (scores.length === 0) {
      return { examName: exam.name, totalStudents: 0, message: '暂无成绩数据' };
    }

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const passCount = scores.filter((s) => s >= 60).length;
    const excellentCount = scores.filter((s) => s >= 85).length;
    const sorted = [...scores].sort((a, b) => b - a);
    const median = sorted[Math.floor(sorted.length / 2)];

    const ranges = {
      '90-100': scores.filter((s) => s >= 90).length,
      '80-89': scores.filter((s) => s >= 80 && s < 90).length,
      '70-79': scores.filter((s) => s >= 70 && s < 80).length,
      '60-69': scores.filter((s) => s >= 60 && s < 70).length,
      '<60': scores.filter((s) => s < 60).length,
    };

    return {
      examName: exam.name,
      examType: exam.type,
      totalStudents: scores.length,
      average: Math.round(avg * 10) / 10,
      max,
      min,
      median,
      passRate: Math.round((passCount / scores.length) * 1000) / 10,
      excellentRate: Math.round((excellentCount / scores.length) * 1000) / 10,
      scoreRanges: ranges,
    };
  }
}
