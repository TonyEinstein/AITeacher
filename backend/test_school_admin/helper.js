// Shared HTTP helper
const http = require('http');
function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = http.request({ hostname: '127.0.0.1', port: 3000, path: '/api/v1' + path, method, headers, timeout: 15000 }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(b); } catch {}
        resolve({ status: res.statusCode, body: parsed, raw: b.slice(0, 800) });
      });
    });
    r.on('error', e => resolve({ status: 0, body: null, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: null, error: 'timeout' }); });
    if (data) r.write(data);
    r.end();
  });
}
module.exports = { req };
