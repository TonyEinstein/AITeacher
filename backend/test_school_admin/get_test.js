const { req } = require('./helper');

(async () => {
  const SID = 2;
  const login = await req('POST', '/auth/login', { username: 'GZ001_admin', password: '123456' });
  const token = login.body.data.access_token;
  const results = [];
  function rec(page, op, method, path, r) {
    let count = '';
    if (r.body && r.body.data != null) {
      const d = r.body.data;
      if (Array.isArray(d)) count = '数组长度=' + d.length;
      else if (typeof d === 'object') count = '对象字段=' + Object.keys(d).join(',');
      else count = String(d);
    }
    const note = (r.body && r.body.message && r.body.message !== 'success') ? r.body.message : '';
    results.push({ page, op, method, path, status: r.status, count, note, error: r.error || '', raw: r.error ? '' : r.raw.slice(0, 300) });
  }

  // 1 dashboard
  rec('1首页', 'GET校级总览', 'GET', `/dashboard/school/${SID}`, await req('GET', `/dashboard/school/${SID}`, null, token));
  // 2 schools
  rec('2学校管理', 'GET学校列表', 'GET', '/schools', await req('GET', '/schools', null, token));
  rec('2学校管理', 'GET本校详情', 'GET', `/schools/${SID}`, await req('GET', `/schools/${SID}`, null, token));
  // 3 organization
  rec('3组织架构', 'GET年级', 'GET', `/grades?schoolId=${SID}`, await req('GET', `/grades?schoolId=${SID}`, null, token));
  rec('3组织架构', 'GET班级(gradeId=3)', 'GET', '/classes?gradeId=3', await req('GET', '/classes?gradeId=3', null, token));
  rec('3组织架构', 'GET学生(classId=3)', 'GET', '/students?classId=3', await req('GET', '/students?classId=3', null, token));
  rec('3组织架构', 'GET用户(schoolId=2)', 'GET', `/users?schoolId=${SID}`, await req('GET', `/users?schoolId=${SID}`, null, token));
  // 4 textbooks
  rec('4教材教案', 'GET教材', 'GET', `/textbooks?schoolId=${SID}`, await req('GET', `/textbooks?schoolId=${SID}`, null, token));
  rec('4教材教案', 'GET教案(textbookId=999不存在)', 'GET', '/lesson-plans?textbookId=999', await req('GET', '/lesson-plans?textbookId=999', null, token));
  // 5 schedules
  rec('5课表', 'GET课表(classId=3)', 'GET', '/schedules?classId=3', await req('GET', '/schedules?classId=3', null, token));
  // 6 assignments
  rec('6作业复核', 'GET作业(classId=3)', 'GET', '/assignments?classId=3', await req('GET', '/assignments?classId=3', null, token));
  rec('6作业复核', 'GET待复核', 'GET', `/assignments/review/pending?schoolId=${SID}`, await req('GET', `/assignments/review/pending?schoolId=${SID}`, null, token));
  // 7 exams
  rec('7考试', 'GET考试', 'GET', `/exams?schoolId=${SID}`, await req('GET', `/exams?schoolId=${SID}`, null, token));
  // 8 live
  rec('8巡课', 'GET巡课拉流(roomId=1)', 'GET', '/live/pull/room/1', await req('GET', '/live/pull/room/1', null, token));
  // 9 reports
  rec('9报表', 'GET年级排名(gradeId=3)', 'GET', '/rankings/grade/3', await req('GET', '/rankings/grade/3', null, token));
  rec('9报表', 'GET预警', 'GET', `/evaluations/warnings?schoolId=${SID}`, await req('GET', `/evaluations/warnings?schoolId=${SID}`, null, token));
  // 10 devices
  rec('10设备', 'GET本校盒子', 'GET', `/boxes?schoolId=${SID}`, await req('GET', `/boxes?schoolId=${SID}`, null, token));
  rec('10设备', 'GET教室', 'GET', `/rooms?schoolId=${SID}`, await req('GET', `/rooms?schoolId=${SID}`, null, token));
  // 11 tutoring
  rec('11辅导', 'GET辅导订阅', 'GET', `/tutoring/subscriptions/school/${SID}`, await req('GET', `/tutoring/subscriptions/school/${SID}`, null, token));
  // 12 leave
  rec('12请假', 'GET待审批', 'GET', `/leaves/pending/${SID}`, await req('GET', `/leaves/pending/${SID}`, null, token));
  // 13 question-bank
  rec('13题库', 'GET题库', 'GET', '/question-bank', await req('GET', '/question-bank', null, token));
  // 14 agents
  rec('14AI教师', 'GETAI教师', 'GET', `/agents?schoolId=${SID}`, await req('GET', `/agents?schoolId=${SID}`, null, token));
  // 15 avatars
  rec('15数字人', 'GET数字人', 'GET', `/avatars?schoolId=${SID}`, await req('GET', `/avatars?schoolId=${SID}`, null, token));
  // 16 surveys
  rec('16问卷', 'GET活动问卷', 'GET', '/surveys/active', await req('GET', '/surveys/active', null, token));
  // 17 leads
  rec('17留资', 'GET留资列表', 'GET', '/leads', await req('GET', '/leads', null, token));
  // 18 subscription
  rec('18订阅', 'GET本校订阅', 'GET', `/subscriptions/school/${SID}`, await req('GET', `/subscriptions/school/${SID}`, null, token));
  // 19 work-orders
  rec('19工单', 'GET工单列表', 'GET', '/work-orders', await req('GET', '/work-orders', null, token));
  rec('19工单', 'GET工单统计', 'GET', '/work-orders/stats', await req('GET', '/work-orders/stats', null, token));
  // 20 device-monitor
  rec('20设备监控', 'GET全部盒子(all)', 'GET', '/boxes/all', await req('GET', '/boxes/all', null, token));
  // 21 health
  rec('21学校健康', 'GET学校健康', 'GET', '/dashboard/health', await req('GET', '/dashboard/health', null, token));

  // Data isolation checks
  rec('数据隔离', 'GET其他校用户(schoolId=1)', 'GET', '/users?schoolId=1', await req('GET', '/users?schoolId=1', null, token));
  rec('数据隔离', 'GET其他校年级(schoolId=1)', 'GET', '/grades?schoolId=1', await req('GET', '/grades?schoolId=1', null, token));
  rec('数据隔离', 'GET其他校盒子(schoolId=1)', 'GET', '/boxes?schoolId=1', await req('GET', '/boxes?schoolId=1', null, token));

  console.log(JSON.stringify(results, null, 1));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
