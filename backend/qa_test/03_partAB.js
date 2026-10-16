// Part A: 访问控制 + Part B: 数据加载 综合测试
const BASE = 'http://localhost:3000/api/v1';

async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json();
  return json.data.access_token;
}

// 发请求并记录结果
async function req(label, role, method, path, token, body) {
  const headers = { 'Authorization': `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }
    // 数据条数：解包 {code,data}
    let payload = (data && typeof data === 'object' && 'data' in data) ? data.data : data;
    let count = '-';
    if (Array.isArray(payload)) count = payload.length;
    else if (payload && typeof payload === 'object') {
      if (Array.isArray(payload.items)) count = payload.items.length;
      else if (Array.isArray(payload.list)) count = payload.list.length;
      else if (typeof payload === 'object') count = `obj{${Object.keys(payload).slice(0,5).join(',')}}`;
    }
    const errMsg = (data && typeof data === 'object' && data.message) ? data.message : '';
    return { label, role, method, path, status: res.status, count, errMsg,
             sample: typeof payload === 'object' ? JSON.stringify(payload).slice(0,150) : String(payload).slice(0,150) };
  } catch (e) {
    return { label, role, method, path, status: 'ERR', count: '-', errMsg: e.message };
  }
}

(async () => {
  const gToken = await login('GZ001_grade1', '123456');
  const sToken = await login('GZ001_math', '123456');
  const G = 'grade_admin', S = 'subject_admin';
  const results = { accessControl: [], dataLoad: [] };

  // ===== Part A: schoolOnly 访问控制 =====
  // 用本校 ID（schoolId=2, classId=3, roomId=1）
  const aTests = [
    ['组织架构-学生列表', 'GET', '/students?classId=3'],
    ['设备管理-盒子列表', 'GET', '/boxes?schoolId=2'],
    ['辅导管理-订阅列表', 'GET', '/tutoring/subscriptions/school/2'],
    ['辅导管理-穿戴设备', 'GET', '/tutoring/devices/2'],
    ['请假审批-待批列表', 'GET', '/leaves/pending/2'],
    ['设备监控-全公司设备', 'GET', '/boxes/all'],
  ];
  for (const [label, method, path] of aTests) {
    results.accessControl.push(await req(label, G, method, path, gToken));
    results.accessControl.push(await req(label, S, method, path, sToken));
  }
  // 跨校边界测试：用 schoolId=3 (SZ001) 访问请假审批，应 403
  results.accessControl.push(await req('跨校越界-请假(SZ001)', G, 'GET', '/leaves/pending/3', gToken));
  results.accessControl.push(await req('跨校越界-请假(SZ001)', S, 'GET', '/leaves/pending/3', sToken));

  // ===== Part B: 可用页面数据加载 =====
  const bTests = [
    ['首页概览-dashboard', 'GET', '/dashboard/grade/3'],
    ['教材教案-textbooks', 'GET', '/textbooks?schoolId=2'],
    ['课表管理-schedules', 'GET', '/schedules?classId=3'],
    ['作业复核-assignments', 'GET', '/assignments?classId=3'],
    ['考试管理-exams', 'GET', '/exams?schoolId=2'],
    ['巡课旁听-live', 'GET', '/live/pull/room/1'],
    ['报表驾驶舱-rankings', 'GET', '/rankings/grade-performance/3'],
    ['学科题库-question-bank', 'GET', '/question-bank?subjectId=2'],
    ['AI教师管理-agents', 'GET', '/agents?schoolId=2'],
    ['数字人形象-avatars', 'GET', '/avatars'],
    ['满意度问卷-surveys', 'GET', '/surveys/active'],
    ['咨询留资-leads', 'GET', '/leads'],
    ['订阅管理-subscriptions', 'GET', '/subscriptions'],
    ['售后工单-work-orders', 'GET', '/work-orders'],
    ['学校健康-health', 'GET', '/dashboard/health'],
  ];
  for (const [label, method, path] of bTests) {
    results.dataLoad.push(await req(label, G, method, path, gToken));
    results.dataLoad.push(await req(label, S, method, path, sToken));
  }

  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
