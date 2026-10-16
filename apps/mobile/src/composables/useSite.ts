import { ref } from 'vue';
import { getPublicSiteConfig, trackEvent } from '@/api/site';

interface SiteConfig {
  icpNo: string;
  contactPhone: string;
  workHours: string;
  wechatName: string;
  qrCodeUrl: string;
  schoolsCount: string;
  studentsCount: string;
  costSave: string;
}

const DEFAULT_CONFIG: SiteConfig = {
  icpNo: '',
  contactPhone: '400-000-0000（示意，上线前替换）',
  workHours: '周一至周五 9:00–18:00',
  wechatName: 'AI Teacher',
  qrCodeUrl: '',
  schoolsCount: '10+',
  studentsCount: '5,000+',
  costSave: '60%',
};

const config = ref<SiteConfig>({ ...DEFAULT_CONFIG });
let loaded = false;
let loadingPromise: Promise<void> | null = null;

/** 拉取官网公开配置，失败用默认值兜底，不阻塞渲染。
 *  后端字段可能为 null（管理端尚未填写），merge 时剔除 null，
 *  避免 null 覆盖默认值导致「咨询电话：」后面空白 */
export function loadSiteConfig(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = getPublicSiteConfig()
    .then((data: any) => {
      if (data && typeof data === 'object') {
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          if (v !== null && v !== undefined && v !== '') clean[k] = String(v);
        }
        config.value = { ...DEFAULT_CONFIG, ...clean };
      }
      loaded = true;
    })
    .catch(() => {
      loaded = true;
    });
  return loadingPromise;
}

function readQuery(name: string): string {
  // #ifdef H5
  try {
    return new URLSearchParams(window.location.search).get(name) || '';
  } catch (e) {
    return '';
  }
  // #endif
  // #ifndef H5
  return '';
  // #endif
}

function referrer(): string {
  // #ifdef H5
  return document.referrer || '';
  // #endif
  // #ifndef H5
  return '';
  // #endif
}

/** 转化埋点：pageview + lead_submit */
export function useTracking() {
  function pageview(page: string) {
    trackEvent({
      event: 'pageview',
      page,
      referrer: referrer(),
      utmSource: readQuery('utm_source'),
      utmMedium: readQuery('utm_medium'),
      utmCampaign: readQuery('utm_campaign'),
    });
  }
  function leadSubmit(page: string, extra: Record<string, unknown> = {}) {
    trackEvent({
      event: 'lead_submit',
      page,
      referrer: referrer(),
      utmSource: readQuery('utm_source'),
      utmMedium: readQuery('utm_medium'),
      utmCampaign: readQuery('utm_campaign'),
      meta: extra,
    });
  }
  return { pageview, leadSubmit };
}

export function useSiteConfig() {
  return { config, loadSiteConfig };
}
