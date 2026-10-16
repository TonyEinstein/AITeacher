import { beforeEach, describe, expect, it, vi } from 'vitest';

/** api/site 的桩：工厂里复用同一组 vi.fn，resetModules 后身份仍稳定 */
const apiMocks = vi.hoisted(() => ({
  getPublicSiteConfig: vi.fn(),
  submitLead: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('@/api/site', () => ({
  getPublicSiteConfig: apiMocks.getPublicSiteConfig,
  submitLead: apiMocks.submitLead,
  trackEvent: apiMocks.trackEvent,
}));

const DEFAULT_CONTACT_PHONE = '400-000-0000（示意，上线前替换）';
const DEFAULT_WORK_HOURS = '周一至周五 9:00–18:00';
const DEFAULT_WECHAT_NAME = 'AI Teacher';
const DEFAULT_STUDENTS_COUNT = '5,000+';
const DEFAULT_SCHOOLS_COUNT = '10+';

/**
 * useSite.ts 有模块级单例（config ref / loaded 标志），
 * 每个用例重置模块注册表后动态 import，拿到干净的初始状态。
 */
async function loadFreshSite() {
  const site = await import('@/composables/useSite');
  const { config } = site.useSiteConfig();
  return { ...site, config };
}

describe('useSiteConfig / loadSiteConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    apiMocks.getPublicSiteConfig.mockReset();
  });

  it('接口返回 null / 空字符串字段时，默认值不被覆盖（回归：咨询电话空白 bug）', async () => {
    apiMocks.getPublicSiteConfig.mockResolvedValue({
      icpNo: null,
      contactPhone: null,
      workHours: '',
      wechatName: null,
      qrCodeUrl: null,
      schoolsCount: '300+',
      studentsCount: null,
      costSave: null,
    });

    const { loadSiteConfig, config } = await loadFreshSite();
    await loadSiteConfig();

    expect(config.value.contactPhone).toBe(DEFAULT_CONTACT_PHONE);
    expect(config.value.workHours).toBe(DEFAULT_WORK_HOURS);
    expect(config.value.wechatName).toBe(DEFAULT_WECHAT_NAME);
    expect(config.value.studentsCount).toBe(DEFAULT_STUDENTS_COUNT);
    // 正常值照常生效
    expect(config.value.schoolsCount).toBe('300+');
  });

  it('接口全 null 时全部回落到默认值', async () => {
    apiMocks.getPublicSiteConfig.mockResolvedValue({
      icpNo: null,
      contactPhone: null,
      workHours: null,
      wechatName: null,
      qrCodeUrl: null,
      schoolsCount: null,
      studentsCount: null,
      costSave: null,
    });

    const { loadSiteConfig, config } = await loadFreshSite();
    await loadSiteConfig();

    expect(config.value.contactPhone).toBe(DEFAULT_CONTACT_PHONE);
    expect(config.value.workHours).toBe(DEFAULT_WORK_HOURS);
    expect(config.value.wechatName).toBe(DEFAULT_WECHAT_NAME);
    expect(config.value.schoolsCount).toBe(DEFAULT_SCHOOLS_COUNT);
    expect(config.value.studentsCount).toBe(DEFAULT_STUDENTS_COUNT);
  });

  it('接口返回正常值时覆盖默认值', async () => {
    apiMocks.getPublicSiteConfig.mockResolvedValue({
      contactPhone: '010-8888-6666',
      schoolsCount: '300+',
      icpNo: '京ICP备00000000号',
    });

    const { loadSiteConfig, config } = await loadFreshSite();
    await loadSiteConfig();

    expect(config.value.contactPhone).toBe('010-8888-6666');
    expect(config.value.schoolsCount).toBe('300+');
    expect(config.value.icpNo).toBe('京ICP备00000000号');
    // 未返回的字段保持默认
    expect(config.value.wechatName).toBe(DEFAULT_WECHAT_NAME);
  });
});
