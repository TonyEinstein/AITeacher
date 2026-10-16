import { describe, it, expect, vi, beforeEach } from 'vitest';

// uni-app 生命周期与全局 uni API 全部桩化
const onShowCallbacks: Array<() => void> = [];
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (cb: () => void) => onShowCallbacks.push(cb),
}));

const storage: Record<string, string> = {};
const reLaunch = vi.fn();
vi.stubGlobal('uni', {
  getStorageSync: (k: string) => storage[k],
  setStorageSync: (k: string, v: string) => { storage[k] = v; },
  removeStorageSync: (k: string) => { delete storage[k]; },
  reLaunch,
});

// auth.isLogin 读 getToken → localStorage（经 utils/auth 实现），直接桩化隔离
vi.mock('@/utils/auth', () => ({
  isLogin: vi.fn(),
}));

import { isLogin } from '@/utils/auth';
import { useStudentAuth } from '@/composables/useStudentAuth';

const mockIsLogin = vi.mocked(isLogin);

function triggerShow() {
  onShowCallbacks.forEach((cb) => cb());
}

beforeEach(() => {
  onShowCallbacks.length = 0;
  reLaunch.mockClear();
  mockIsLogin.mockReset();
  delete storage.studentId;
});

describe('useStudentAuth 登录守卫', () => {
  it('未登录（无 token）：reLaunch 登录页且 load 不执行（短路）', () => {
    mockIsLogin.mockReturnValue(false);
    const load = vi.fn();
    useStudentAuth(load);

    triggerShow();

    expect(reLaunch).toHaveBeenCalledTimes(1);
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
    expect(load).not.toHaveBeenCalled();
  });

  it('有 token 无 studentId（微信未绑定家长态）：reLaunch 且 load 不执行', () => {
    mockIsLogin.mockReturnValue(true);
    // storage.studentId 不存在
    const load = vi.fn();
    useStudentAuth(load);

    triggerShow();

    expect(reLaunch).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
  });

  it('登录 + studentId 齐全：放行，load 恰好一次，零 reLaunch', () => {
    mockIsLogin.mockReturnValue(true);
    storage.studentId = '5';
    const load = vi.fn();
    useStudentAuth(load);

    triggerShow();

    expect(reLaunch).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('未传 load（纯守卫用法）：守卫通过时零异常零跳转', () => {
    mockIsLogin.mockReturnValue(true);
    storage.studentId = '5';
    expect(() => {
      useStudentAuth();
      triggerShow();
    }).not.toThrow();
    expect(reLaunch).not.toHaveBeenCalled();
  });
});
