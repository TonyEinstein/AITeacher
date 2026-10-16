// 登录两个角色并输出 token 和用户上下文
const BASE = 'http://localhost:3000/api/v1';

async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const status = res.status;
  const data = await res.json();
  return { status, data };
}

(async () => {
  const g = await login('GZ001_grade1', '123456');
  const s = await login('GZ001_math', '123456');
  console.log('=== grade_admin ===');
  console.log('HTTP', g.status);
  console.log(JSON.stringify(g.data, null, 2));
  console.log('=== subject_admin ===');
  console.log('HTTP', s.status);
  console.log(JSON.stringify(s.data, null, 2));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
