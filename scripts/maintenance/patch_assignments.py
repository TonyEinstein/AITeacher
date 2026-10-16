# -*- coding: utf-8 -*-
"""修改 assignments.service.ts 注入 WechatService 并在 confirmAndPublish 加推送"""
import io
path = r'E:\AITeacher\backend\src\assignments\assignments.service.ts'
with io.open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. 加 import
c = c.replace(
    "import { MinioService } from '../minio/minio.service';",
    "import { MinioService } from '../minio/minio.service';\nimport { WechatService } from '../wechat/wechat.service';"
)

# 2. 加 Logger
c = c.replace(
    "import { Injectable, BadRequestException } from '@nestjs/common';",
    "import { Injectable, BadRequestException, Logger } from '@nestjs/common';"
)

# 3. constructor 注入
c = c.replace(
    "export class AssignmentsService {\n  constructor(\n    private prisma: PrismaService,\n    private llm: LlmService,\n    private minio: MinioService,\n  ) {}",
    "export class AssignmentsService {\n  private readonly logger = new Logger('AssignmentsService');\n  constructor(\n    private prisma: PrismaService,\n    private llm: LlmService,\n    private minio: MinioService,\n    private wechat: WechatService,\n  ) {}"
)

# 4. 修改 confirmAndPublish 加推送
old_method = """  // 老师确认并下发作业
  async confirmAndPublish(id: number) {
    return this.prisma.assignment.update({
      where: { id },
      data: { status: 'published' },
    });
  }"""

new_method = """  // 老师确认并下发作业（同时推送微信订阅消息）
  async confirmAndPublish(id: number) {
    const assignment = await this.prisma.assignment.update({
      where: { id },
      data: { status: 'published' },
      include: { lessonPlan: { include: { subject: true } } },
    });

    // 异步推送订阅消息，不阻塞主流程
    this.wechat.notifyHomework(
      0, // 占位，实际按班级学生推送
      assignment.title,
      assignment.lessonPlan?.subject?.name || '作业',
      assignment.dueDate ? assignment.dueDate.toLocaleDateString('zh-CN') : '尽快',
    ).catch(() => {});

    // 通过 lessonPlan → schedules → class 找到关联班级，逐个学生推送
    if (assignment.lessonPlanId) {
      this.prisma.schedule.findMany({
        where: { lessonPlanId: assignment.lessonPlanId },
        include: { classInfo: { include: { students: true } } },
      }).then(schedules => {
        const studentIds = new Set<number>();
        schedules.forEach(s => s.classInfo?.students?.forEach(st => studentIds.add(st.id)));
        studentIds.forEach(sid => {
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
  }"""

if old_method in c:
    c = c.replace(old_method, new_method)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('assignments.service.ts 已修改：注入 WechatService，confirmAndPublish 加推送')
else:
    print('未找到 confirmAndPublish 方法，可能已修改')
