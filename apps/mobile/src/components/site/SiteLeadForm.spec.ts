import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SiteLeadForm from '@/components/site/SiteLeadForm.vue';

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

async function fillRequiredFields(wrapper: ReturnType<typeof mount>) {
  const inputs = wrapper.findAll('input');
  await inputs[0].setValue('示范中学');
  await inputs[1].setValue('张老师');
  await inputs[2].setValue('13800000000');
}

describe('SiteLeadForm', () => {
  beforeEach(() => {
    apiMocks.submitLead.mockReset();
  });

  it('必填缺失时点击提交：显示错误提示且不调用 submitLead', async () => {
    const wrapper = mount(SiteLeadForm);

    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(apiMocks.submitLead).not.toHaveBeenCalled();
    expect(wrapper.find('.form-tip.err').exists()).toBe(true);
    expect(wrapper.text()).toContain('请填写学校名称、姓名和联系电话');
    expect(wrapper.find('.form-tip.ok').exists()).toBe(false);
  });

  it('填写完整后提交：调用 submitLead 且成功提示，表单清空', async () => {
    apiMocks.submitLead.mockResolvedValue({ ok: true });
    const wrapper = mount(SiteLeadForm);

    await fillRequiredFields(wrapper);
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(apiMocks.submitLead).toHaveBeenCalledTimes(1);
    expect(apiMocks.submitLead).toHaveBeenCalledWith({
      company: '示范中学',
      name: '张老师',
      phone: '13800000000',
      message: undefined,
    });

    expect(wrapper.find('.form-tip.ok').exists()).toBe(true);
    expect(wrapper.text()).toContain('感谢！我们会尽快联系您。');
    expect(wrapper.find('.form-tip.err').exists()).toBe(false);
    // 成功后清空三个必填输入
    const values = wrapper.findAll('input').map((i) => (i.element as HTMLInputElement).value);
    expect(values).toEqual(['', '', '', '']);
  });
});
