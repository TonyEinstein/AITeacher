/* 补充一条已发布作业，打通学生端 作业列表→详情→提交 链路（仅新增，不删除任何数据） */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 找一个 subjectId 非 0 的 lessonPlan（学生1 classId=1, schoolId=1）
  const lp = await prisma.lessonPlan.findFirst({
    where: { subjectId: { not: 0 } },
    include: { subject: true },
  });
  console.log('使用 lessonPlan:', lp ? lp.id + ' subject=' + (lp.subject && lp.subject.name) : '无');

  // 已有 published 作业则不重复创建
  const existing = await prisma.assignment.findFirst({ where: { status: 'published' } });
  if (existing) {
    console.log('已存在 published 作业 id=' + existing.id + '，不重复创建');
    return;
  }

  const due = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const a = await prisma.assignment.create({
    data: {
      schoolId: 1,
      lessonPlanId: lp ? lp.id : null,
      title: '课堂练习：知识点巩固（第1课时）',
      content: { questions: ['完成课本第12页练习1-3题', '拍照上传解题过程'] },
      type: 'homework',
      dueDate: due,
      status: 'published',
    },
  });
  console.log('已创建 published 作业 id=' + a.id + ' title=' + a.title);
}
main().finally(() => prisma.$disconnect());
