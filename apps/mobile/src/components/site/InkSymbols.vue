<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/**
 * 水墨符号粒子层——移植自归档原版官网 archive/website/src/components/InkCanvasBg.vue：
 * 学科符号（π ∑ √ 诗書春秋 李白 杜甫…）在纸面上漂浮，
 * 鼠标靠近 250px 内轻轻聚拢，滚动每 0.9 视口随机换一批符号。
 * uni-app H5 会把 <canvas> 包成 uni-canvas 并占用 2d context，
 * 因此沿用 ink-hero 的做法：宿主容器内自建原生 canvas。
 * reduced-motion 或非 H5 端：整个层不渲染，页面退回静态纸面。
 */
const props = withDefaults(defineProps<{ color?: string }>(), {
  color: '139, 46, 46', // 朱砂（官网纸白底）；登录页夜色传暖墨
});
const host = ref<HTMLElement | null>(null);
let dispose: (() => void) | null = null;

/** 取宿主真 DOM：uni-app H5 的 <view ref> 是自定义元素包装对象，非真 DOM（无 appendChild） */
function resolveHost(): HTMLElement | null {
  // #ifdef H5
  if (host.value && typeof (host.value as any).appendChild === 'function') return host.value;
  return document.querySelector('.ink-symbols');
  // #endif
}

function createScene(el: HTMLElement) {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  el.appendChild(c);
  const ctx = c.getContext('2d');
  if (!ctx) return () => {};
  const g = ctx as CanvasRenderingContext2D;

  let W = 0;
  let H = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    W = el.clientWidth;
    H = el.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  // 学科符号库（与原版一致：数理化文史，纸面学气）
  const symbols = [
    'π', '∑', '√', '∞', '∫', 'Δ', 'λ', 'θ', 'Σ', 'Ω', 'α', 'β', 'γ', 'φ',
    'sin', 'cos', 'tan', 'log', 'ln', 'x²', 'y=kx', 'f(x)', 'dx', 'dy', 'a²+b²=c²',
    'F=ma', 'E=mc²', 'V=IR', 'U=IR', 'W=Fs', 'P=UI', 'v=at', 'h=½gt²', 'E=hν',
    'H₂O', 'CO₂', 'NaCl', 'O₂', 'CH₄', 'CaCO₃', 'H₂SO₄', 'Fe', 'Cu', 'Au',
    'DNA', 'RNA', 'ATP', '細胞', '基因',
    '△', '◇', '○', '□', '∠', '⊥', '∥', '≌', '∽',
    'Aa', 'Ee', 'Bb', 'Cc', 'Tt',
    '诗', '書', '禮', '易', '春秋', '仁', '義', '智', '信', '孝',
    '唐', '宋', '漢', '明', '長城', '絲路', '科举',
    '地球', '经纬', '洋流', '季风', '山地', '河流', '大洲', '赤道',
    '孔子', '屈原', '司马迁', '王羲之', '李白', '杜甫', '张骞', '郑和',
  ];

  const items: {
    text: string; x: number; y: number; size: number;
    dx: number; dy: number; rot: number; dr: number; o: number;
  }[] = [];
  const COUNT = 60;
  for (let i = 0; i < COUNT; i++) {
    items.push({
      text: symbols[Math.floor(Math.random() * symbols.length)],
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 28 + 16,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      rot: Math.random() * 0.2 - 0.1,
      dr: (Math.random() - 0.5) * 0.002,
      o: Math.random() * 0.18 + 0.1,
    });
  }

  let mx = W / 2;
  let my = H / 2;
  const onMouse = (e: MouseEvent) => {
    // canvas 是 fixed 容器内的绝对层，符号坐标即视口坐标
    mx = e.clientX;
    my = e.clientY;
  };
  window.addEventListener('mousemove', onMouse, { passive: true });

  let lastReplace = 0;
  const onScroll = () => {
    const sy = window.scrollY;
    if (sy - lastReplace > window.innerHeight * 0.9) {
      lastReplace = sy;
      for (const it of items) {
        if (Math.random() < 0.4) {
          it.text = symbols[Math.floor(Math.random() * symbols.length)];
        }
      }
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  let raf = 0;
  let idleTicks = 0; // 鼠标静止计数：静止久了轻轻放走聚拢的符号，避免结团
  let lastMx = W / 2;
  let lastMy = H / 2;
  function loop() {
    g.clearRect(0, 0, W, H);
    if (mx === lastMx && my === lastMy) idleTicks++;
    else idleTicks = 0;
    lastMx = mx;
    lastMy = my;
    const attracted = idleTicks < 90; // ~1.5s 无移动视为离开
    const sy = window.scrollY || 0;
    for (const it of items) {
      it.x += it.dx;
      it.y += it.dy;
      it.rot += it.dr;
      const vy = it.y - sy * 0.1;
      const ax = mx - it.x;
      const ay = my - vy;
      const dist = Math.sqrt(ax * ax + ay * ay);
      if (dist < 250 && attracted) {
        it.x += ax * 0.003;
        it.y += ay * 0.003;
      } else if (!attracted && dist < 200) {
        // 鼠标离开后：近距离温和斥力，让结团的符号散回纸面
        it.x -= ax * 0.0015;
        it.y -= ay * 0.0015;
      }
      if (it.x < -100) it.x = W + 100;
      if (it.x > W + 100) it.x = -100;
      if (vy < -120) it.y += H + 240;
      if (vy > H + 120) it.y -= H + 240;
      g.save();
      g.translate(it.x, vy);
      g.rotate(it.rot);
      g.font = `${it.size}px 'Noto Serif SC', serif`;
      g.fillStyle = `rgba(${props.color}, ${it.o})`;
      g.textAlign = 'center';
      g.fillText(it.text, 0, 0);
      g.restore();
    }
    raf = requestAnimationFrame(loop);
  }
  loop();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouse);
    window.removeEventListener('scroll', onScroll);
    c.remove();
  };
}

onMounted(() => {
  // #ifdef H5
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = resolveHost();
  if (!reduced && el) dispose = createScene(el);
  // #endif
});
onUnmounted(() => {
  dispose?.();
  dispose = null;
});
</script>

<template>
  <view ref="host" class="ink-symbols" aria-hidden="true"></view>
</template>

<style lang="scss" scoped>
/* 画布宿主基础样式：尺寸与定位由使用方通过 class 决定
   （页面级背景传 fixed 类，hero 内传 .ink-canvas 绝对铺满类） */
.ink-symbols {
  pointer-events: none;
  overflow: hidden;
}
</style>
