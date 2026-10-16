<template>
  <view class="pb-track" :style="{ height: height + 'px', borderRadius: radius + 'px' }">
    <view
      class="pb-inner"
      :style="{ width: pct + '%', background: color, borderRadius: radius + 'px' }"
    ></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 百分比，0~100；null/undefined/NaN 一律按 0 处理 */
    value: number | null | undefined
    color?: string
    height?: number
    radius?: number
  }>(),
  { color: '#8b2e2e', height: 12, radius: 6 },
)

// 兜底：非有限数按 0；同时夹取到 0~100，避免出现 NaN% 或溢出条
const pct = computed(() => {
  const n = Number(props.value)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
})
</script>

<style>
.pb-track {
  flex: 1;
  width: 100%;
  background: rgba(43, 43, 43, 0.07);
  overflow: hidden;
}
.pb-inner {
  height: 100%;
}
</style>
