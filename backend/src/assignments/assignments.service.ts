import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { MinioService } from '../minio/minio.service';
import { WechatService } from '../wechat/wechat.service';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger('AssignmentsService');
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private minio: MinioService,
    private wechat: WechatService,
  ) {}

  // AI 生成作业
  async generateByLesson(lessonPlanId: number, classIds: number[], options?: any) {
    const lessonPlan = await this.prisma.lessonPlan.findUnique({
      where: { id: lessonPlanId },
      include: { subject: true, textbook: true },
    });
    if (!lessonPlan) throw new BadRequestException('教案不存在');

    const questionCount = options?.questionCount || 10;
    const prompt = `请根据以下课程内容生成${questionCount}道课后作业题，包含选择题、填空题、简答题。输出JSON格式：{"questions":[{"type":"choice","question":"题目","options":["A","B","C","D"],"answer":"A","score":5,"knowledgePoint":"知识点"},...]}\n课程：${lessonPlan.title}\n科目：${lessonPlan.subject?.name}`;

    const result = await this.llm.chat([
      { role: 'system', content: '你是专业的出题老师，只输出JSON。' },
      { role: 'user', content: prompt },
    ]);

    let content;
    try {
      content = JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
      content = { raw: result, questions: [] };
    }

    const assignments = [];
    for (const classId of classIds) {
      const assignment = await this.prisma.assignment.create({
        data: {
          schoolId: lessonPlan.textbook?.schoolId || 1,
          lessonPlanId,
          title: `${lessonPlan.title} - 课后作业`,
          content,
          type: 'homework',
          dueDate: options?.dueDate ? new Date(options.dueDate) : null,
          status: 'draft',
        },
      });
      assignments.push(assignment);
    }

    return assignments;
  }

  // 老师确认并下发作业（同时推送微信订阅消息）
  async confirmAndPublish(id: number) {
    const assignment = await this.prisma.assignment.update({
      where: { id },
      data: { status: 'published' },
      include: { lessonPlan: { include: { subject: true } } },
    });

    // 异步推送订阅消息，不阻塞主流程；按 lessonPlan → schedules → classId 逐个学生推送
    if (assignment.lessonPlanId) {
      this.prisma.schedule.findMany({
        where: { lessonPlanId: assignment.lessonPlanId },
        select: { classId: true },
      }).then(async schedules => {
        const classIds = [...new Set(schedules.map(s => s.classId))];
        const students = await this.prisma.student.findMany({
          where: { classId: { in: classIds } },
          select: { id: true },
        });
        students.forEach(st => {
          const sid = st.id;
          this.wechat.notifyHomework(
            sid,
            assignment.title,
            assignment.lessonPlan?.subject?.name || '作业',
            assignment.dueDate ? assignment.dueDate.toLocaleDateString('zh-CN') : '尽快',
          ).catch(() => {});
        });
      }).catch(e => this.logger.warn(`作业推送查询失败: ${e?.message}`));
    }

    return assignment;
  }

  // 手动创建作业
  create(data: any) {
    return this.prisma.assignment.create({
      data: {
        schoolId: Number(data.schoolId),
        lessonPlanId: data.lessonPlanId ? Number(data.lessonPlanId) : null,
        title: data.title,
        content: data.content || { questions: [] },
        type: data.type || 'homework',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status || 'draft',
      },
    });
  }

  // 学生查询作业列表
  findByStudent(studentId: number) {
    return this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          include: {
            grade: true,
          },
        },
      },
    }).then(async (student) => {
      if (!student) return [];
      return this.prisma.assignment.findMany({
        where: {
          status: 'published',
          lessonPlan: {
            subjectId: { not: 0 },
          },
        },
        include: {
          submissions: { where: { studentId } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  }

  // 按班级查作业
  findByClass(classId: number) {
    return this.prisma.assignment.findMany({
      where: {
        status: { in: ['published', 'closed'] },
      },
      include: {
        submissions: true,
        lessonPlan: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  findOne(id: number) {
    return this.prisma.assignment.findUnique({
      where: { id },
      include: {
        submissions: { include: { student: true } },
        lessonPlan: { include: { subject: true } },
      },
    });
  }

  update(id: number, data: any) {
    return this.prisma.assignment.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.assignment.delete({ where: { id } });
  }

  // 学生提交作业（拍照上传）
  async submit(assignmentId: number, studentId: number, data: { content?: any; file?: any }) {
    let fileUrl = null;
    if (data.file) {
      const ext = data.file.originalname?.split('.').pop() || 'jpg';
      const fileName = `submissions/${assignmentId}/${studentId}-${Date.now()}.${ext}`;
      fileUrl = await this.minio.uploadFile(fileName, data.file.buffer, data.file.mimetype);
    }

    return this.prisma.submission.create({
      data: {
        assignmentId,
        studentId,
        content: data.content || null,
        fileUrl,
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
  }
}
