// Part C: 写操作落库验证（subject_admin 的 question-bank/agents + grade_admin 的 schedules）
const BASE = 'http://localhost:3000/api/v1';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json();
  return json.data.access_token;
}

async function api(method, path, token, body) {
  const headers = { 'Authorization': `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  const payload = (data && typeof data === 'object' && 'data' in data) ? data.data : data;
  return { status: res.status, payload };
}

const results = [];
function rec(role, action, httpStatus, dbCheck) {
  results.push({ role, action, httpStatus, dbCheck });
  console.log(`[${role}] ${action} -> HTTP ${httpStatus} | DB: ${dbCheck}`);
}

(async () => {
  const sToken = await login('GZ001_math', '123456');
  const gToken = await login('GZ001_grade1', '123456');

  // ===== subject_admin: question-bank CRUD =====
  // 1. CREATE
  const qBody = { subjectId: 2, question: '核对测试-1+1等于几？', type: 'choice', answer: 'B', difficulty: 2, knowledgePoint: '核对测试-基础运算' };
  const c = await api('POST', '/question-bank', sToken, qBody);
  const qId = c.payload?.id;
  let dbAfterCreate = '未返回id';
  if (qId) {
    const row = await prisma.questionBank.findUnique({ where: { id: qId } });
    dbAfterCreate = row ? `落库成功(id=${row.id}, q="${row.question}", diff=${row.difficulty})` : '落库失败-查无此行';
  }
  rec('subject_admin', 'POST /question-bank 创建题目', c.status, dbAfterCreate);

  // 2. UPDATE
  if (qId) {
    const u = await api('PUT', `/question-bank/${qId}`, sToken, { question: '核对测试-编辑后:2+2等于几？', difficulty: 4 });
    const row = await prisma.questionBank.findUnique({ where: { id: qId } });
    const dbUpd = row ? `更新后 q="${row.question}", diff=${row.difficulty}` : '查无此行';
    rec('subject_admin', `PUT /question-bank/${qId} 编辑题目`, u.status, dbUpd);
  }

  // 3. DELETE
  if (qId) {
    const d = await api('DELETE', `/question-bank/${qId}`, sToken);
    const row = await prisma.questionBank.findUnique({ where: { id: qId } });
    const dbDel = row ? '删除失败-仍存在' : '删除成功-已不存在';
    rec('subject_admin', `DELETE /question-bank/${qId} 删除题目`, d.status, dbDel);
  }

  // ===== subject_admin: agents CRUD =====
  // 4. CREATE agent
  const aBody = { schoolId: 2, subjectId: 2, name: '核对测试AI数学教师', type: 'class_teacher', model: 'doubao', style: 'serious' };
  const ac = await api('POST', '/agents', sToken, aBody);
  const aId = ac.payload?.id;
  let dbAc = '未返回id';
  if (aId) {
    const row = await prisma.agent.findUnique({ where: { id: aId } });
    dbAc = row ? `落库成功(id=${row.id}, name="${row.name}", style=${row.style})` : '落库失败-查无此行';
  }
  rec('subject_admin', 'POST /agents 创建AI教师', ac.status, dbAc);

  // 5. PATCH style
  if (aId) {
    const au = await api('PATCH', `/agents/${aId}/style`, sToken, { style: 'humorous' });
    const row = await prisma.agent.findUnique({ where: { id: aId } });
    const dbAu = row ? `更新后 style=${row.style}` : '查无此行';
    rec('subject_admin', `PATCH /agents/${aId}/style 修改风格`, au.status, dbAu);
  }

  // 6. DELETE agent
  if (aId) {
    const ad = await api('DELETE', `/agents/${aId}`, sToken);
    const row = await prisma.agent.findUnique({ where: { id: aId } });
    const dbAd = row ? '删除失败-仍存在' : '删除成功-已不存在';
    rec('subject_admin', `DELETE /agents/${aId} 删除AI教师`, ad.status, dbAd);
  }

  // ===== grade_admin: schedules CRUD =====
  // 7. CREATE schedule
  const sBody = { schoolId: 2, classId: 3, startTime: '2026-09-25T08:00:00.000Z', endTime: '2026-09-25T08:45:00.000Z', status: 'scheduled' };
  const sc = await api('POST', '/schedules', gToken, sBody);
  const sId = sc.payload?.id;
  let dbSc = '未返回id';
  if (sId) {
    const row = await prisma.schedule.findUnique({ where: { id: sId } });
    dbSc = row ? `落库成功(id=${row.id}, classId=${row.classId}, status=${row.status}, start=${row.startTime.toISOString()})` : '落库失败-查无此行';
  }
  rec('grade_admin', 'POST /schedules 创建课表', sc.status, dbSc);

  // 8. UPDATE schedule
  if (sId) {
    const su = await api('PUT', `/schedules/${sId}`, gToken, { status: 'completed', roomId: 2 });
    const row = await prisma.schedule.findUnique({ where: { id: sId } });
    const dbSu = row ? `更新后 status=${row.status}, roomId=${row.roomId}` : '查无此行';
    rec('grade_admin', `PUT /schedules/${sId} 编辑课表`, su.status, dbSu);
  }

  // 9. DELETE schedule
  if (sId) {
    const sd = await api('DELETE', `/schedules/${sId}`, gToken);
    const row = await prisma.schedule.findUnique({ where: { id: sId } });
    const dbSd = row ? '删除失败-仍存在' : '删除成功-已不存在';
    rec('grade_admin', `DELETE /schedules/${sId} 删除课表`, sd.status, dbSd);
  }

  console.log('\n=== JSON RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
