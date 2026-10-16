// Inspect existing data for schoolId=2
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const school = await prisma.school.findUnique({ where: { id: 2 } });
  console.log('SCHOOL:', JSON.stringify(school));

  const grades = await prisma.grade.findMany({ where: { schoolId: 2 } });
  console.log('GRADES count:', grades.length, JSON.stringify(grades));

  // classes for these grades
  const gradeIds = grades.map(g => g.id);
  const classes = gradeIds.length ? await prisma.class.findMany({ where: { gradeId: { in: gradeIds } } }) : [];
  console.log('CLASSES count:', classes.length, JSON.stringify(classes));

  const classIds = classes.map(c => c.id);
  const students = classIds.length ? await prisma.student.findMany({ where: { classId: { in: classIds } }, take: 5 }) : [];
  console.log('STUDENTS sample:', JSON.stringify(students));
  const studentCount = classIds.length ? await prisma.student.count({ where: { classId: { in: classIds } } }) : 0;
  console.log('STUDENTS total:', studentCount);

  const subjects = await prisma.subject.findMany();
  console.log('SUBJECTS:', JSON.stringify(subjects));

  const users = await prisma.user.findMany({ where: { schoolId: 2 } });
  console.log('USERS in school 2 count:', users.length, JSON.stringify(users.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name }))));

  const rooms = await prisma.room.findMany({ where: { schoolId: 2 } });
  console.log('ROOMS:', JSON.stringify(rooms));

  const boxes = await prisma.box.findMany({ where: { schoolId: 2 } });
  console.log('BOXES school2:', boxes.length, JSON.stringify(boxes.map(b => ({ id: b.id, serial: b.serialNumber, roomId: b.roomId }))));

  const allBoxes = await prisma.box.count();
  console.log('BOXES total all schools:', allBoxes);

  const textbooks = await prisma.textbook.findMany({ where: { schoolId: 2 } });
  console.log('TEXTBOOKS school2:', textbooks.length, JSON.stringify(textbooks.map(t => ({ id: t.id, title: t.title, subjectId: t.subjectId }))));

  const agents = await prisma.agent.findMany({ where: { schoolId: 2 } });
  console.log('AGENTS school2:', agents.length);

  const surveys = await prisma.survey.findMany({ take: 3 });
  console.log('SURVEYS sample:', JSON.stringify(surveys.map(s => ({ id: s.id, title: s.title, status: s.status }))));

  const leads = await prisma.lead.findMany({ take: 3 });
  console.log('LEADS sample:', leads.length, JSON.stringify(leads.map(l => ({ id: l.id, name: l.name }))));

  const subscriptions = await prisma.subscription.findMany({ where: { schoolId: 2 } });
  console.log('SUBSCRIPTIONS school2:', JSON.stringify(subscriptions));

  const workOrders = await prisma.workOrder.findMany({ where: { schoolId: 2 } });
  console.log('WORKORDERS school2:', workOrders.length);

  const leaves = await prisma.leave.findMany({ where: { student: { class: { grade: { schoolId: 2 } } } } });
  console.log('LEAVES pending school2:', leaves.filter(l => l.status === 'pending').length, 'total', leaves.length);

  const exams = await prisma.exam.findMany({ where: { schoolId: 2 } });
  console.log('EXAMS school2:', exams.length);

  const assignments = await prisma.assignment.findMany({ where: { schoolId: 2 } });
  console.log('ASSIGNMENTS school2:', assignments.length);

  const schedules = await prisma.schedule.findMany({ where: { schoolId: 2 } });
  console.log('SCHEDULES school2:', schedules.length);

  const avatars = await prisma.digitalAvatar.findMany({ where: { schoolId: 2 } });
  console.log('AVATARS school2:', avatars.length);

  const tutoringSubs = await prisma.tutoringSubscription.findMany({ where: { student: { class: { grade: { schoolId: 2 } } } } });
  console.log('TUTORING SUBS school2:', tutoringSubs.length);

  await prisma.$disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
