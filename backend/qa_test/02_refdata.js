// 查询参考数据：班级、教室、学科、学生等
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // 学校
  const school = await prisma.school.findUnique({ where: { id: 2 } });
  console.log('SCHOOL:', school?.id, school?.name, school?.code);

  // gradeId=3 的班级
  const classes = await prisma.class.findMany({ where: { gradeId: 3 }, select: { id: true, name: true, gradeId: true } });
  console.log('CLASSES under gradeId=3:', JSON.stringify(classes));

  // schoolId=2 的教室
  const rooms = await prisma.room.findMany({ where: { schoolId: 2 }, select: { id: true, code: true, name: true } });
  console.log('ROOMS schoolId=2:', JSON.stringify(rooms));

  // 学科
  const subjects = await prisma.subject.findMany({ select: { id: true, name: true, code: true } });
  console.log('SUBJECTS:', JSON.stringify(subjects));

  // GZ001 学校下的年级
  const grades = await prisma.grade.findMany({ where: { schoolId: 2 }, select: { id: true, name: true } });
  console.log('GRADES schoolId=2:', JSON.stringify(grades));

  // 任意一个学生（GZ001 grade1）
  const student = await prisma.student.findFirst({
    where: { class: { gradeId: 3 } },
    select: { id: true, name: true, studentNo: true, classId: true }
  });
  console.log('STUDENT in grade3:', JSON.stringify(student));

  // agents for schoolId=2
  const agents = await prisma.agent.findMany({ where: { schoolId: 2 }, select: { id: true, name: true, subjectId: true } });
  console.log('AGENTS schoolId=2 count:', agents.length, JSON.stringify(agents.slice(0,3)));

  // question bank count
  const qbCount = await prisma.questionBank.count();
  console.log('QuestionBank total count:', qbCount);

  // schedules count
  const schedCount = await prisma.schedule.count();
  console.log('Schedule total count:', schedCount);

  await prisma.$disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
