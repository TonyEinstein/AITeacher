import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GradingService } from './grading.service';

const mockLlm = {
  chat: vi.fn().mockResolvedValue('{"score":0,"comment":"未作答"}'),
};

function buildMockPrisma() {
  return {
    submission: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        studentId: 100,
        content: {
          answers: {
            q1: 'A',
            q2: 'C',
            q3: '',
          },
        },
        assignment: {
          id: 10,
          lessonPlan: { subjectId: 1 },
          content: {
            questions: [
              { question: 'q1', type: 'choice', answer: 'A', score: 5, knowledgePoint: 'kp1' },
              { question: 'q2', type: 'choice', answer: 'B', score: 5, knowledgePoint: 'kp2' },
              { question: 'q3', type: 'essay', answer: '略', score: 5, knowledgePoint: 'kp3' },
            ],
          },
        },
        student: { id: 100 },
      }),
      update: vi.fn().mockResolvedValue({ id: 1, status: 'graded' }),
    },
    wrongQuestion: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  };
}

describe('GradingService.gradeSubmission idempotency', () => {
  it('首次批改后生成错题记录', async () => {
    const prisma = buildMockPrisma() as any;
    const service = new GradingService(prisma, mockLlm as any);

    await service.gradeSubmission(1);

    expect(prisma.wrongQuestion.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.wrongQuestion.create).toHaveBeenCalledTimes(2);
    expect(prisma.wrongQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 100,
          subjectId: 1,
          question: 'q2',
          knowledgePoint: 'kp2',
        }),
      }),
    );
  });

  it('重复批改同一 submission 不会使错题记录翻倍', async () => {
    const prisma = buildMockPrisma() as any;
    const service = new GradingService(prisma, mockLlm as any);

    await service.gradeSubmission(1);
    const firstCreateCount = prisma.wrongQuestion.create.mock.calls.length;

    // 模拟第二次调用：即使数据库里已存在旧错题，也应在创建前清理
    await service.gradeSubmission(1);
    const secondCreateCount =
      prisma.wrongQuestion.create.mock.calls.length - firstCreateCount;

    expect(secondCreateCount).toBe(2);
    expect(prisma.wrongQuestion.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('清理条件限定为学生+学科+错题题干', async () => {
    const prisma = buildMockPrisma() as any;
    const service = new GradingService(prisma, mockLlm as any);

    await service.gradeSubmission(1);

    expect(prisma.wrongQuestion.deleteMany).toHaveBeenCalledWith({
      where: {
        studentId: 100,
        subjectId: 1,
        question: { in: expect.arrayContaining(['q2', 'q3']) },
      },
    });
  });
});
