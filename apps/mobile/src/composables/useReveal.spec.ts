import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReveal } from '@/composables/useReveal';

type IOCallback = (
  entries: Array<{ target: Element; isIntersecting: boolean }>,
) => void;

let ioInstances: MockIntersectionObserver[] = [];
let observeCalls: Element[] = [];
let unobserveCalls: Element[] = [];
let disconnectCalls = 0;

class MockIntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly thresholds: number[] = [];
  private readonly callback: IOCallback;

  constructor(callback: IOCallback) {
    this.callback = callback;
    ioInstances.push(this);
  }

  observe(el: Element) {
    observeCalls.push(el);
  }

  unobserve(el: Element) {
    unobserveCalls.push(el);
  }

  disconnect() {
    disconnectCalls += 1;
  }

  takeRecords() {
    return [];
  }

  /** 测试辅助：手动触发 IO 回调 */
  trigger(entries: Array<{ target: Element; isIntersecting: boolean }>) {
    this.callback(entries);
  }
}

/** 哑组件：仅提供一个 [data-reveal] 元素并触发 useReveal 的生命周期注册 */
const RevealHost = defineComponent({
  setup() {
    useReveal();
    return () => h('div', { 'data-reveal': '' });
  },
});

function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('useReveal', () => {
  beforeEach(() => {
    ioInstances = [];
    observeCalls = [];
    unobserveCalls = [];
    disconnectCalls = 0;
    // rAF 兜底（元素已在视口内直接判定可见）与 IO 回调路径独立，
    // 这里 stub 成不执行，保证断言只来自被测分支
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal(
      'IntersectionObserver',
      MockIntersectionObserver as unknown as typeof IntersectionObserver,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('prefers-reduced-motion: reduce 时元素直接可见，且不创建/observing IO', async () => {
    stubMatchMedia(true);
    const wrapper = mount(RevealHost, { attachTo: document.body });
    const el = wrapper.element as HTMLElement;

    await nextTick();

    expect(el.classList.contains('reveal-visible')).toBe(true);
    expect(el.classList.contains('reveal')).toBe(false);
    expect(ioInstances).toHaveLength(0);
    expect(observeCalls).toHaveLength(0);

    wrapper.unmount();
  });

  it('IO 回调 isIntersecting=true 时加 reveal-visible 并 unobserve', async () => {
    stubMatchMedia(false);
    const wrapper = mount(RevealHost, { attachTo: document.body });
    const el = wrapper.element as HTMLElement;

    await nextTick();

    // 已进入 IO 观察流程：先加 reveal（初始隐藏态），还未可见
    expect(el.classList.contains('reveal')).toBe(true);
    expect(el.classList.contains('reveal-visible')).toBe(false);
    expect(ioInstances).toHaveLength(1);
    expect(observeCalls).toEqual([el]);

    ioInstances[0].trigger([{ target: el, isIntersecting: true }]);

    expect(el.classList.contains('reveal-visible')).toBe(true);
    expect(unobserveCalls).toEqual([el]);

    wrapper.unmount();
    expect(disconnectCalls).toBe(1);
  });
});
