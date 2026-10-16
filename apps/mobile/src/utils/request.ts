import { ENV } from '@/config/env';
import { getToken, clearToken } from '@/utils/auth';

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  header?: Record<string, string>;
  /** 是否弹出错误提示，默认 true */
  showError?: boolean;
  /** 401 时是否自动跳登录，默认 true */
  redirectLogin?: boolean;
}

/** 后端统一响应格式：{ code, message, data } */
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

function request<T = any>(options: RequestOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: ENV.apiBase + options.url,
      method: (options.method || 'GET') as any,
      data: options.data,
      header: {
        Authorization: 'Bearer ' + getToken(),
        'Content-Type': 'application/json',
        ...(options.header || {}),
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data as ApiResponse<T>;
          if (body && body.code === 0) {
            resolve(body.data);
          } else {
            reject(body || res.data);
          }
        } else if (res.statusCode === 401) {
          clearToken();
          // 一并清 studentId：避免留下「有 studentId 无 token」的混合态
          // （会穿过学生页守卫并在加载时触发多余请求/弹窗）
          uni.removeStorageSync('studentId');
          if (options.redirectLogin !== false) {
            uni.navigateTo({ url: '/pages/login/index' });
          }
          reject(res.data);
        } else {
          const body = res.data as any;
          const msg = body?.message || `请求失败（${res.statusCode}）`;
          if (options.showError !== false) {
            uni.showToast({ title: msg, icon: 'none' });
          }
          reject(body || res.data);
        }
      },
      fail: (err) => {
        if (options.showError !== false) {
          uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        }
        reject(err);
      },
    });
  });
}

export const http = {
  get<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'GET', data, ...options });
  },
  post<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'POST', data, ...options });
  },
  put<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'PUT', data, ...options });
  },
  delete<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'DELETE', data, ...options });
  },
};
