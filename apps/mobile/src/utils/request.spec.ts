import { describe, it, expect, vi, beforeEach } from 'vitest';

// uni.request 桩：按用例注入响应；其余 uni API 记录调用
const uniRequest = vi.fn();
const removeStorageSync = vi.fn();
const navigateTo = vi.fn();
const showToast = vi.fn();
vi.stubGlobal('uni', {
  request: uniRequest,
  removeStorageSync,
  navigateTo,
  showToast,
  getStorageSync: () => null,
  setStorageSync: () => {},
});

vi.mock('@/config/env', () => ({
  ENV: { apiBase: 'http://test.local/api/v1', mode: 'test' },
}));

vi.mock('@/utils/auth', () => ({
  getToken: vi.fn(() => 'tok-abc'),
  clearToken: vi.fn(),
}));

import { http } from '@/utils/request';
import { clearToken } from '@/utils/auth';

function respond(status: number, body: any) {
  // uni.request 的 success 回调被调用
  const call = uniRequest.mock.calls[uniRequest.mock.calls.length - 1][0];
  call.success({ statusCode: status, data: body });
}

beforeEach(() => {
  uniRequest.mockReset();
  removeStorageSync.mockClear();
  navigateTo.mockClear();
  showToast.mockClear();
  vi.mocked(clearToken).mockClear();
});

describe('request 401 处理', () => {
  it('401：清 token、清 studentId、跳登录页、reject', async () => {
    const p = http.get('/some/endpoint');
    respond(401, { code: 2001, message: '未登录' });

    await expect(p).rejects.toBeTruthy();
    expect(clearToken).toHaveBeenCalledTimes(1);
    expect(removeStorageSync).toHaveBeenCalledWith('studentId');
    expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });

  it('redirectLogin: false 时不跳登录页，但仍清理', async () => {
    const p = http.get('/some/endpoint', undefined, { redirectLogin: false });
    respond(401, { code: 2001, message: '未登录' });

    await expect(p).rejects.toBeTruthy();
    expect(clearToken).toHaveBeenCalledTimes(1);
    expect(removeStorageSync).toHaveBeenCalledWith('studentId');
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('2xx code:0 正常 resolve（对照：不影响成功路径）', async () => {
    const p = http.get<{ id: number }>('/some/endpoint');
    respond(200, { code: 0, message: 'success', data: { id: 1 } });

    await expect(p).resolves.toEqual({ id: 1 });
    expect(removeStorageSync).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('非 401 业务错误（showError 默认）弹 toast 且 reject，不清 studentId', async () => {
    const p = http.get('/some/endpoint');
    respond(500, { message: '服务器开小差' });

    await expect(p).rejects.toBeTruthy();
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(removeStorageSync).not.toHaveBeenCalled();
  });
});
