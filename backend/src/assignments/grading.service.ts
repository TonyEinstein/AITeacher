import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  // AI 自动批改
  async gradeSubmission(submissionId: number) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: { include: { lessonPlan: { select: { subjectId: true } } } },
        student: true,
      },
    });
    if (!submission) return null;

    const assignment = submission.assignment;
    // 错题需要归属学科，用于按学科/知识点统计薄弱点
    const subjectId = assignment.lessonPlan?.subjectId ?? null;
    const content = assignment.content as any;
    const questions = content?.questions || [];
    const answers = submission.content as any;
    const studentAnswers = answers?.answers || {};

    let totalScore = 0;
    let maxScore = 0;
    const details = [];
    const wrongQuestions = [];
    let hasSubjective = false;

    for (const [qi, rawQ] of questions.entries()) {
      // 兼容纯文本题目（questions 为字符串数组）：统一规范化为题目对象
      const q: any = typeof rawQ === 'string'
        ? { question: rawQ, type: 'essay', answer: '', score: 5 }
        : rawQ;
      if (q.type === 'essay' || q.type === 'calculation') hasSubjective = true;
      maxScore += q.score || 5;
      const studentAnswer = studentAnswers[q.question] || studentAnswers[String(qi)];
      let earned = 0;
      let isCorrect = false;
      let comment = '';

      if (q.type === 'choice' || q.type === 'fill') {
        // 客观题：精确比对
        isCorrect = String(studentAnswer || '').trim() === String(q.answer).trim();
        earned = isCorrect ? (q.score || 5) : 0;
        comment = isCorrect ? '回答正确' : `正确答案：${q.answer}`;
      } else {
        // 主观题/计算题：AI 评分
        const gradeResult = await this.gradeSubjective(q, studentAnswer);
        earned = gradeResult.score;
        comment = gradeResult.comment;
        isCorrect = earned >= (q.score || 5) * 0.6;
      }

      totalScore += earned;
      details.push({
        question: q.question,
        type: q.type,
        studentAnswer,
        correctAnswer: q.answer,
        score: earned,
        maxScore: q.score || 5,
        isCorrect,
        comment,
      });

      if (!isCorrect) {
        wrongQuestions.push({
          question: q.question,
          userAnswer: String(studentAnswer || ''),
          correctAnswer: String(q.answer),
          // 题目自带的知识点/题库 id 必须带过来，否则错题本无法按知识点聚合薄弱画像
          questionBankId: q.questionBankId ?? null,
          knowledgePoint: q.knowledgePoint ?? null,
        });
      }
    }

    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // 更新提交记录
    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: finalScore,
        comment: JSON.stringify(details),
        status: hasSubjective ? 'graded' : 'reviewed',
      },
    });

    // 错题本归集：先清理该生当次涉及的旧错题，再写入新结果，保证重复调用幂等
    if (wrongQuestions.length) {
      const questionsToClean = [...new Set(wrongQuestions.map((wq) => wq.question))];
      const where: any = {
        studentId: submission.studentId,
        question: { in: questionsToClean },
      };
      if (subjectId != null) {
        where.subjectId = subjectId;
      }
      await this.prisma.wrongQuestion.deleteMany({ where });
    }

    for (const wq of wrongQuestions) {
      await this.prisma.wrongQuestion.create({
        data: {
          studentId: submission.studentId,
          questionBankId: wq.questionBankId,
          subjectId,
          knowledgePoint: wq.knowledgePoint,
          question: wq.question,
          userAnswer: wq.userAnswer,
          correctAnswer: wq.correctAnswer,
        },
      });
    }

    this.logger.log(`作业批改完成: 学生${submission.studentId} 得分${finalScore}`);
    return updated;
  }

  // 主观题 AI 评分
  private async gradeSubjective(question: any, studentAnswer: string) {
    if (!studentAnswer) return { score: 0, comment: '未作答' };

    const prompt = `请批改以下主观题，满分${question.score || 10}分。
题目：${question.question}
参考答案：${question.answer || question.referenceAnswer || '略'}
学生答案：${studentAnswer}
请只输出JSON：{"score":分数,"comment":"评语"}`;

    const result = await this.llm.chat([
      { role: 'system', content: '你是严格的阅卷老师，只输出JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3 });

    try {
      const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
      return {
        score: Math.min(question.score || 10, Math.max(0, parsed.score)),
        comment: parsed.comment || '',
      };
    } catch {
      return { score: Math.floor((question.score || 10) * 0.6), comment: 'AI 初评，请老师复核' };
    }
  }

  // 老师复核
  async review(submissionId: number, score: number, comment: string, reviewerId?: number) {
    return this.prisma.submission.update({
      where: { id: submissionId },
      data: { score, comment, status: 'reviewed', reviewerId: reviewerId ?? null, reviewedAt: new Date() },
    });
  }

  // 待复核列表
  findPendingReview(schoolId: number) {
    return this.prisma.submission.findMany({
      where: {
        status: 'graded',
        assignment: { schoolId },
      },
      include: { student: true, assignment: true },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    });
  }
}
