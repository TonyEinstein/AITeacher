const TOKEN_KEY = 'at_token';
const USER_KEY = 'at_user';

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || '';
}

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token);
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY);
  uni.removeStorageSync(USER_KEY);
}

export function setUser(user: any) {
  uni.setStorageSync(USER_KEY, user);
}

export function getUser(): any {
  return uni.getStorageSync(USER_KEY) || null;
}

export function isLogin(): boolean {
  return !!getToken();
}

/** 退出登录 */
export function logout() {
  clearToken();
  uni.reLaunch({ url: '/pages/login/index' });
}
