const { req } = require('./helper');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SID = 2;
const results = [];
let createdIds = {}; // track created ids for cleanup

function rec(page, op, method, path, r, dbVerify) {
  results.push({
    page, op, method, path,
    status: r.status,
    apiMsg: r.body ? (r.body.message || '') : ('ERR:' + (r.error||'')),
    dbVerify: dbVerify || '',
  });
}

async function getCreatedId(r) {
  if (r.body && r.body.data && r.body.data.id != null) return r.body.data.id;
  if (r.body && r.body.data && Array.isArray(r.body.data) && r.body.data[0] && r.body.data[0].id != null) return r.body.data[0].id;
  return null;
}

(async () => {
  const login = await req('POST', '/auth/login', { username: 'GZ001_admin', password: '123456' });
  const token = login.body.data.access_token;

  // ============ 3. Organization CRUD ============
  let r = await req('POST', '/grades', { schoolId: SID, name: '核对测试年级E2E' }, token);
  let gid = await getCreatedId(r);
  let db = gid ? await prisma.grade.findUnique({ where: { id: gid } }) : null;
  rec('3组织架构', 'POST新建年级', 'POST', '/grades', r, db ? `DB存在 grade.name=${db.name}, schoolId=${db.schoolId}` : 'DB未查到');
  createdIds.grade = gid;

  r = await req('POST', '/classes', { gradeId: gid, name: '核对测试班E2E' }, token);
  let cid = await getCreatedId(r);
  db = cid ? await prisma.class.findUnique({ where: { id: cid } }) : null;
  rec('3组织架构', 'POST新建班级', 'POST', '/classes', r, db ? `DB存在 class.name=${db.name}, gradeId=${db.gradeId}` : 'DB未查到');
  createdIds.class = cid;

  r = await req('POST', '/students', { classId: cid, name: '核对测试学生E2E', studentNo: 'CHK-E2E-S001' }, token);
  let sid = await getCreatedId(r);
  db = sid ? await prisma.student.findUnique({ where: { id: sid } }) : null;
  rec('3组织架构', 'POST新建学生', 'POST', '/students', r, db ? `DB存在 student.name=${db.name}, studentNo=${db.studentNo}` : 'DB未查到');
  createdIds.student = sid;

  r = await req('POST', '/users', { username: 'chke2e_t001', password: '123456', name: '核对测试教师E2E', role: 'teacher', schoolId: SID }, token);
  let uid = await getCreatedId(r);
  db = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
  rec('3组织架构', 'POST新建用户(教师)', 'POST', '/users', r, db ? `DB存在 user.name=${db.name}, role=${db.role}, schoolId=${db.schoolId}` : 'DB未查到');
  createdIds.user = uid;

  // Updates
  r = await req('PUT', `/grades/${gid}`, { name: '核对测试年级E2E改' }, token);
  db = await prisma.grade.findUnique({ where: { id: gid } });
  rec('3组织架构', 'PUT更新年级', 'PUT', `/grades/${gid}`, r, db ? `DB验证 name=${db.name}` : '');

  r = await req('PUT', `/classes/${cid}`, { name: '核对测试班E2E改' }, token);
  db = await prisma.class.findUnique({ where: { id: cid } });
  rec('3组织架构', 'PUT更新班级', 'PUT', `/classes/${cid}`, r, db ? `DB验证 name=${db.name}` : '');

  r = await req('PUT', `/students/${sid}`, { name: '核对测试学生E2E改' }, token);
  db = await prisma.student.findUnique({ where: { id: sid } });
  rec('3组织架构', 'PUT更新学生', 'PUT', `/students/${sid}`, r, db ? `DB验证 name=${db.name}` : '');

  r = await req('PUT', `/users/${uid}`, { phone: '13900001111' }, token);
  db = await prisma.user.findUnique({ where: { id: uid } });
  rec('3组织架构', 'PUT更新用户', 'PUT', `/users/${uid}`, r, db ? `DB验证 phone=${db.phone}` : '');

  // Isolation write: create grade for schoolId=1 (other school)
  r = await req('POST', '/grades', { schoolId: 1, name: '越权年级E2E' }, token);
  rec('数据隔离', 'POST跨校建年级(schoolId=1)', 'POST', '/grades', r, '应被403拦截');

  // ============ 10. Devices: room + box ============
  r = await req('POST', '/rooms', { schoolId: SID, name: '核对测试教室E2E', code: 'CHK-E2E-R1', capacity: 30 }, token);
  let rid = await getCreatedId(r);
  db = rid ? await prisma.room.findUnique({ where: { id: rid } }) : null;
  rec('10设备', 'POST新建教室', 'POST', '/rooms', r, db ? `DB存在 room.name=${db.name}, code=${db.code}` : 'DB未查到');
  createdIds.room = rid;

  r = await req('POST', '/boxes/register', { serialNumber: 'CHK-E2E-B1', schoolId: SID, type: 'classroom' }, token);
  let boxid = await getCreatedId(r);
  db = boxid ? await prisma.box.findUnique({ where: { id: boxid } }) : null;
  rec('10设备', 'POST注册盒子', 'POST', '/boxes/register', r, db ? `DB存在 box.serial=${db.serialNumber}, status=${db.status}, schoolId=${db.schoolId}` : 'DB未查到');
  createdIds.box = boxid;

  r = await req('PUT', `/boxes/${boxid}/assign-room`, { roomId: rid }, token);
  db = await prisma.box.findUnique({ where: { id: boxid } });
  rec('10设备', 'PUT分配盒子到教室', 'PUT', `/boxes/${boxid}/assign-room`, r, db ? `DB验证 roomId=${db.roomId}` : '');

  // ============ 5. Schedule ============
  const st = new Date('2026-10-01T08:00:00Z');
  const et = new Date('2026-10-01T08:45:00Z');
  r = await req('POST', '/schedules', { schoolId: SID, classId: 3, startTime: st.toISOString(), endTime: et.toISOString(), status: 'scheduled' }, token);
  let schid = await getCreatedId(r);
  db = schid ? await prisma.schedule.findUnique({ where: { id: schid } }) : null;
  rec('5课表', 'POST新建课表', 'POST', '/schedules', r, db ? `DB存在 schedule.status=${db.status}, classId=${db.classId}` : 'DB未查到');
  createdIds.schedule = schid;

  r = await req('PUT', `/schedules/${schid}`, { status: 'cancelled' }, token);
  db = await prisma.schedule.findUnique({ where: { id: schid } });
  rec('5课表', 'PUT更新课表', 'PUT', `/schedules/${schid}`, r, db ? `DB验证 status=${db.status}` : '');

  r = await req('POST', '/schedules/auto', { schoolId: SID, classId: 3, lessonPlanIds: [] }, token);
  rec('5课表', 'POST自动排课(空lessonPlanIds)', 'POST', '/schedules/auto', r, '返回数组=' + (Array.isArray(r.body?.data) ? r.body.data.length : '非数组'));

  // ============ 6. Assignment ============
  r = await req('POST', '/assignments', { schoolId: SID, title: '核对测试作业E2E', content: { questions: [] }, type: 'homework' }, token);
  let asid = await getCreatedId(r);
  db = asid ? await prisma.assignment.findUnique({ where: { id: asid } }) : null;
  rec('6作业复核', 'POST新建作业', 'POST', '/assignments', r, db ? `DB存在 assignment.status=${db.status}, title=${db.title}` : 'DB未查到');
  createdIds.assignment = asid;

  r = await req('POST', `/assignments/${asid}/publish`, {}, token);
  db = await prisma.assignment.findUnique({ where: { id: asid } });
  rec('6作业复核', 'POST发布作业', 'POST', `/assignments/${asid}/publish`, r, db ? `DB验证 status=${db.status}` : '');

  r = await req('POST', '/assignments/generate', { lessonPlanId: 99999, classIds: [3] }, token);
  rec('6作业复核', 'POST AI生成作业(LLM)', 'POST', '/assignments/generate', r, '依赖外部LLM服务');

  // ============ 7. Exam ============
  r = await req('POST', '/exams', { schoolId: SID, name: '核对测试考试E2E', type: 'monthly', subjectId: 2, startTime: '2026-11-01T08:00:00Z', endTime: '2026-11-01T10:00:00Z' }, token);
  let exid = await getCreatedId(r);
  db = exid ? await prisma.exam.findUnique({ where: { id: exid } }) : null;
  rec('7考试', 'POST新建考试', 'POST', '/exams', r, db ? `DB存在 exam.status=${db.status}, name=${db.name}` : 'DB未查到');
  createdIds.exam = exid;

  r = await req('POST', `/exams/${exid}/generate-paper`, { subject: '数学', totalScore: 100, questionTypes: [{ type: 'choice', count: 5, score: 5 }] }, token);
  rec('7考试', 'POST AI组卷(LLM)', 'POST', `/exams/${exid}/generate-paper`, r, '依赖外部LLM服务');

  r = await req('POST', '/exams/paper/99999/lock', {}, token);
  rec('7考试', 'POST锁卷(不存在paperId)', 'POST', '/exams/paper/99999/lock', r, '无试卷时行为');

  // ============ 12. Leave ============
  r = await req('POST', '/leaves/apply/6', { type: 'personal', startDate: '2026-10-01T00:00:00Z', reason: '核对测试请假E2E' }, token);
  let leid = await getCreatedId(r);
  db = leid ? await prisma.leave.findUnique({ where: { id: leid } }) : null;
  rec('12请假', 'POST学生请假申请', 'POST', '/leaves/apply/6', r, db ? `DB存在 leave.status=${db.status}, reason=${db.reason}` : 'DB未查到');
  createdIds.leave = leid;

  r = await req('POST', `/leaves/${leid}/review`, { approved: true, reviewerId: 4, comment: '核对测试通过' }, token);
  db = await prisma.leave.findUnique({ where: { id: leid } });
  rec('12请假', 'POST审批请假', 'POST', `/leaves/${leid}/review`, r, db ? `DB验证 status=${db.status}, reviewerId=${db.reviewerId}` : '');

  // ============ 13. QuestionBank ============
  r = await req('POST', '/question-bank', { subjectId: 2, question: '核对测试题E2E', type: 'choice', answer: 'A', difficulty: 2, knowledgePoint: '核对测试KP' }, token);
  let qbid = await getCreatedId(r);
  db = qbid ? await prisma.questionBank.findUnique({ where: { id: qbid } }) : null;
  rec('13题库', 'POST新建题目', 'POST', '/question-bank', r, db ? `DB存在 q.question=${db.question}, answer=${db.answer}` : 'DB未查到');
  createdIds.qbank = qbid;

  r = await req('PUT', `/question-bank/${qbid}`, { answer: 'B' }, token);
  db = await prisma.questionBank.findUnique({ where: { id: qbid } });
  rec('13题库', 'PUT更新题目', 'PUT', `/question-bank/${qbid}`, r, db ? `DB验证 answer=${db.answer}` : '');

  // ============ 14. Agent ============
  r = await req('POST', '/agents', { schoolId: SID, subjectId: 2, name: '核对测试AIE2E', type: 'class_teacher', model: 'deepseek', style: 'gentle' }, token);
  let agid = await getCreatedId(r);
  db = agid ? await prisma.agent.findUnique({ where: { id: agid } }) : null;
  rec('14AI教师', 'POST新建AI教师', 'POST', '/agents', r, db ? `DB存在 agent.name=${db.name}, style=${db.style}` : 'DB未查到');
  createdIds.agent = agid;

  r = await req('PATCH', `/agents/${agid}/style`, { style: 'humorous' }, token);
  db = await prisma.agent.findUnique({ where: { id: agid } });
  rec('14AI教师', 'PATCH更新风格', 'PATCH', `/agents/${agid}/style`, r, db ? `DB验证 style=${db.style}` : '');

  // ============ 15. Avatar ============
  r = await req('POST', '/avatars', { name: '核对测试数字人E2E', gender: 'female', subject: 'math', modelType: '2d' }, token);
  let avaid = await getCreatedId(r);
  db = avaid ? await prisma.digitalAvatar.findUnique({ where: { id: avaid } }) : null;
  rec('15数字人', 'POST新建数字人', 'POST', '/avatars', r, db ? `DB存在 avatar.name=${db.name}, isCustom=${db.isCustom}` : 'DB未查到');
  createdIds.avatar = avaid;

  r = await req('POST', `/avatars/custom/${SID}`, { name: '核对测试定制E2E', gender: 'male', subject: '语文' }, token);
  let avacid = await getCreatedId(r);
  db = avacid ? await prisma.digitalAvatar.findUnique({ where: { id: avacid } }) : null;
  rec('15数字人', 'POST定制数字人', 'POST', `/avatars/custom/${SID}`, r, db ? `DB存在 custom.name=${db.name}, isCustom=${db.isCustom}, schoolId=${db.schoolId}` : 'DB未查到');
  createdIds.avatarCustom = avacid;

  // ============ 16. Survey ============
  r = await req('POST', '/surveys', { title: '核对测试问卷E2E', questions: [{ text: 'q1', type: 'rating' }] }, token);
  let survid = await getCreatedId(r);
  db = survid ? await prisma.survey.findUnique({ where: { id: survid } }) : null;
  rec('16问卷', 'POST新建问卷', 'POST', '/surveys', r, db ? `DB存在 survey.title=${db.title}, status=${db.status}` : 'DB未查到');
  createdIds.survey = survid;

  // ============ 11. Tutoring ============
  r = await req('POST', '/tutoring/subscribe/6', { plan: 'standard', months: 1 }, token);
  db = await prisma.tutoringSubscription.findUnique({ where: { studentId: 6 } });
  rec('11辅导', 'POST订阅辅导(studentId=6)', 'POST', '/tutoring/subscribe/6', r, db ? `DB存在 sub.status=${db.status}, plan=${db.plan}, endDate=${db.endDate?.toISOString()?.slice(0,10)}` : 'DB未查到');

  r = await req('POST', '/tutoring/devices/register', { schoolId: SID, type: 'glasses', serialNumber: 'CHK-E2E-G1', model: 'test-glasses' }, token);
  let tdevid = await getCreatedId(r);
  db = tdevid ? await prisma.device.findUnique({ where: { id: tdevid } }) : null;
  rec('11辅导', 'POST注册穿戴设备', 'POST', '/tutoring/devices/register', r, db ? `DB存在 device.serial=${db.serialNumber}, type=${db.type}, schoolId=${db.schoolId}` : 'DB未查到');
  createdIds.tutDevice = tdevid;

  r = await req('POST', '/tutoring/cancel/6', {}, token);
  db = await prisma.tutoringSubscription.findUnique({ where: { studentId: 6 } });
  rec('11辅导', 'POST取消辅导', 'POST', '/tutoring/cancel/6', r, db ? `DB验证 status=${db.status}` : '');

  // ============ 17/18/19 restricted writes ============
  r = await req('DELETE', '/leads/1', {}, token);
  rec('17留资', 'DELETE删除留资(super_admin)', 'DELETE', '/leads/1', r, '应被403拦截');

  r = await req('PUT', `/subscriptions/school/${SID}/disable`, {}, token);
  rec('18订阅', 'PUT停用订阅(super_admin)', 'PUT', `/subscriptions/school/${SID}/disable`, r, '应被403拦截');

  r = await req('POST', '/work-orders', { schoolId: SID, title: '核对测试工单E2E', type: 'device_repair', description: 'test' }, token);
  rec('19工单', 'POST创建工单(super_admin)', 'POST', '/work-orders', r, '应被403拦截');

  r = await req('POST', `/subscriptions/school/${SID}/renew`, { months: 12 }, token);
  rec('18订阅', 'POST续订订阅(super_admin)', 'POST', `/subscriptions/school/${SID}/renew`, r, '应被403拦截');

  console.log('=== RESULTS ===');
  console.log(JSON.stringify(results, null, 1));
  console.log('=== CREATED IDS ===');
  console.log(JSON.stringify(createdIds));

  await prisma.$disconnect();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
