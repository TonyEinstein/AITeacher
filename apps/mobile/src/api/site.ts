import { http } from '@/utils/request';

/** 官网公开配置（GET /site-config/public），失败由默认值兜底 */
export function getPublicSiteConfig(): Promise<any> {
  return http.get('/site-config/public', undefined, { showError: false, redirectLogin: false });
}

/** 官网留资（POST /leads/public） */
export function submitLead(data: {
  company: string;
  name: string;
  phone: string;
  message?: string;
}): Promise<any> {
  return http.post('/leads/public', data, { showError: false, redirectLogin: false });
}

/** 转化埋点（POST /tracking/events），静默，不影响页面 */
export function trackEvent(data: {
  event: string;
  page?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  meta?: Record<string, unknown>;
}): void {
  http
    .post('/tracking/events', data, { showError: false, redirectLogin: false })
    .catch(() => null);
}
