import { nextTick, onMounted, onUnmounted } from 'vue';

/**
 * 滚动浮现——移植自原版官网 directives/reveal.ts（原为 v-reveal 指令）。
 * uni-app 的模板编译对自定义指令支持不稳，改为组合式函数：
 * 页面 onMounted 后调用 useReveal()，它扫描本页 [data-reveal] 元素，
 * 进入视口（threshold 0.12，底部 -60px 提前量）加 .reveal-visible。
 * CSS 侧由 site.scss 的 .reveal / .reveal-visible 定义动画。
 * reduced-motion / 无 IO：全部元素直接可见，不动画。
 */
export function useReveal() {
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    // #ifdef H5
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // uni-app 页面 onMounted 时 slot 内容可能尚未挂全，nextTick 后再扫，
    // 仍扫不到（异步组件/条件渲染）则退化为全可见，绝不让内容消失
    nextTick(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
      if (reduced || !('IntersectionObserver' in window) || els.length === 0) {
        els.forEach((el) => el.classList.add('reveal-visible'));
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              (e.target as HTMLElement).classList.add('reveal-visible');
              observer?.unobserve(e.target);
            }
          }
        },
        // threshold 0.05 + 正向 rootMargin：稍微露头就浮现，快速滚动不显空白
        { threshold: 0.05, rootMargin: '0px 0px 10% 0px' },
      );
      els.forEach((el) => {
        el.classList.add('reveal');
        observer!.observe(el);
      });
      // 兜底：初始已在视口内或以上的元素（页面从锚点深链进入、浏览器恢复滚动位置）
      // IO 首帧未必报告，直接判定显示，绝不让内容滞留在隐藏态
      requestAnimationFrame(() => {
        els.forEach((el) => {
          if (!el.classList.contains('reveal-visible') && el.getBoundingClientRect().top < window.innerHeight) {
            el.classList.add('reveal-visible');
            observer?.unobserve(el);
          }
        });
      });
    });
    // #endif
  });

  onUnmounted(() => {
    // #ifdef H5
    observer?.disconnect();
    observer = null;
    // #endif
  });
}
