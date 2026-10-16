const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const schools = await prisma.school.findMany({ select: { id: true, name: true, code: true } });
  console.log('SCHOOLS:', JSON.stringify(schools));
  const otherUsers = await prisma.user.count({ where: { schoolId: 1 } });
  console.log('USERS school1:', otherUsers);
  const otherGrades = await prisma.grade.count({ where: { schoolId: 1 } });
  console.log('GRADES school1:', otherGrades);
  const otherBoxes = await prisma.box.count({ where: { schoolId: { not: 2 } } });
  console.log('BOXES not school2:', otherBoxes);
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
