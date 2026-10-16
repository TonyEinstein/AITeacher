const { req } = require('./helper');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const login = await req('POST', '/auth/login', { username: 'GZ001_admin', password: '123456' });
  const token = login.body.data.access_token;

  // create a grade
  let r = await req('POST', '/grades', { schoolId: 2, name: 'DELETE调试年级' }, token);
  const gid = r.body.data.id;
  console.log('CREATED grade id=', gid, 'status=', r.status);

  // delete it
  r = await req('DELETE', '/grades/' + gid, {}, token);
  console.log('DELETE status=', r.status);
  console.log('DELETE body=', JSON.stringify(r.body));
  console.log('DELETE raw=', r.raw);

  const gone = await prisma.grade.findUnique({ where: { id: gid } });
  console.log('DB exists after delete:', gone);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
