const BASE_URL = 'http://localhost:3000/api/v1';

export async function request(url: string, options: any = {}) {
  const token = localStorage.getItem('box_token');
  const res = await fetch(BASE_URL + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message || '请求失败');
  }
  return json.data;
}

export const api = {
  heartbeat: (serial: string) => request('/boxes/heartbeat/' + serial, { method: 'POST' }),
  getTodaySchedule: (boxId: number) => request('/schedules/today/' + boxId),
  getLesson: (id: number) => request('/lesson-plans/' + id),
};
