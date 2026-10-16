const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const checks = {
    grades_test: await prisma.grade.count({ where: { name: { contains: '核对测试' } } }),
    classes_test: await prisma.class.count({ where: { name: { contains: '核对测试' } } }),
    students_test: await prisma.student.count({ where: { name: { contains: '核对测试' } } }),
    users_test: await prisma.user.count({ where: { name: { contains: '核对测试' } } }),
    rooms_test: await prisma.room.count({ where: { code: { startsWith: 'CHK' } } }),
    boxes_test: await prisma.box.count({ where: { serialNumber: { startsWith: 'CHK' } } }),
    schedules_test: await prisma.schedule.count({ where: { startTime: new Date('2026-10-01T08:00:00Z') } }),
    assignments_test: await prisma.assignment.count({ where: { title: { contains: '核对测试' } } }),
    qbank_test: await prisma.questionBank.count({ where: { question: { contains: '核对测试' } } }),
    agents_test: await prisma.agent.count({ where: { name: { contains: '核对测试' } } }),
    devices_test: await prisma.device.count({ where: { serialNumber: { startsWith: 'CHK' } } }),
    anyGradeLeftover: await prisma.grade.findMany({ where: { name: { contains: 'E2E' } } }),
  };
  console.log(JSON.stringify(checks, null, 1));
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
