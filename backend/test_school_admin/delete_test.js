const { req } = require('./helper');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SID = 2;
(async () => {
  const login = await req('POST', '/auth/login', { username: 'GZ001_admin', password: '123456' });
  const token = login.body.data.access_token;
  const results = [];
  function rec(page, op, method, path, r, dbVerify) {
    results.push({ page, op, method, path, status: r.status, apiMsg: r.body ? (r.body.message||'') : ('ERR:'+(r.error||'')), dbVerify: dbVerify||'' });
  }

  // DELETE tests
  let r = await req('DELETE', '/students/370', {}, token);
  let gone = await prisma.student.findUnique({ where: { id: 370 } });
  rec('3组织架构', 'DELETE删除学生', 'DELETE', '/students/370', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/classes/46', {}, token);
  gone = await prisma.class.findUnique({ where: { id: 46 } });
  rec('3组织架构', 'DELETE删除班级', 'DELETE', '/classes/46', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/grades/21', {}, token);
  gone = await prisma.grade.findUnique({ where: { id: 21 } });
  rec('3组织架构', 'DELETE删除年级', 'DELETE', '/grades/21', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/users/33', {}, token);
  gone = await prisma.user.findUnique({ where: { id: 33 } });
  rec('3组织架构', 'DELETE删除用户', 'DELETE', '/users/33', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/boxes/17', {}, token);
  gone = await prisma.box.findUnique({ where: { id: 17 } });
  rec('10设备', 'DELETE删除盒子', 'DELETE', '/boxes/17', r, gone ? 'DB仍存在!' : 'DB已删除✓');
  r = await req('DELETE', '/rooms/20', {}, token);
  gone = await prisma.room.findUnique({ where: { id: 20 } });
  rec('10设备', 'DELETE删除教室', 'DELETE', '/rooms/20', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/schedules/2', {}, token);
  gone = await prisma.schedule.findUnique({ where: { id: 2 } });
  rec('5课表', 'DELETE删除课表', 'DELETE', '/schedules/2', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/assignments/2', {}, token);
  gone = await prisma.assignment.findUnique({ where: { id: 2 } });
  rec('6作业复核', 'DELETE删除作业', 'DELETE', '/assignments/2', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/question-bank/2', {}, token);
  gone = await prisma.questionBank.findUnique({ where: { id: 2 } });
  rec('13题库', 'DELETE删除题目', 'DELETE', '/question-bank/2', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  r = await req('DELETE', '/agents/2', {}, token);
  gone = await prisma.agent.findUnique({ where: { id: 2 } });
  rec('14AI教师', 'DELETE删除AI教师', 'DELETE', '/agents/2', r, gone ? 'DB仍存在!' : 'DB已删除✓');

  console.log('=== DELETE RESULTS ===');
  console.log(JSON.stringify(results, null, 1));

  // Cleanup: delete child first
  await prisma.paper.deleteMany({ where: { exam: { schoolId: SID, name: { contains: '核对测试' } } } });
  await prisma.exam.deleteMany({ where: { name: { contains: '核对测试' } } });
  await prisma.digitalAvatar.deleteMany({ where: { name: { contains: '核对测试' } } });
  await prisma.survey.deleteMany({ where: { title: { contains: '核对测试' } } });
  await prisma.device.deleteMany({ where: { serialNumber: { startsWith: 'CHK-E2E' } } });
  await prisma.tutoringSubscription.deleteMany({ where: { studentId: 6 } });
  await prisma.leave.deleteMany({ where: { reason: { contains: '核对测试' } } });

  const remaining = {
    avatars: await prisma.digitalAvatar.count({ where: { name: { contains: '核对测试' } } }),
    surveys: await prisma.survey.count({ where: { title: { contains: '核对测试' } } }),
    exams: await prisma.exam.count({ where: { name: { contains: '核对测试' } } }),
    leaves: await prisma.leave.count({ where: { reason: { contains: '核对测试' } } }),
  };
  console.log('REMAINING CHECK DATA:', JSON.stringify(remaining));
  await prisma.$disconnect();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
