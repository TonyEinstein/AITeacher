<template>
  <view class="cb">
    <canvas
      class="cb-canvas"
      :canvas-id="cid"
      :id="cid"
      :style="{ width: '100%', height: height + 'px' }"
    />
    <view v-if="!hasData" class="cb-empty">暂无数据</view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, watch } from 'vue'
import uCharts from '@qiun/ucharts'

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: { name: string; data: number[] }[]
    height?: number
    unit?: string
    type?: 'column' | 'line'
  }>(),
  { height: 240, unit: '', type: 'column' },
)

const instance = getCurrentInstance()
// canvas-id 必须全局唯一，否则同页多图会串图（Review Focus #3）
const cid = `cb-${Math.random().toString(36).slice(2, 9)}`
let chart: any = null

const hasData = computed(
  () => props.categories.length > 0 && props.series.some((s) => s.data.some((v) => Number(v) > 0)),
)

function render() {
  if (!hasData.value) return
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select(`#${cid}`)
    .boundingClientRect((rect: any) => {
      if (!rect || !rect.width) return
      const context = uni.createCanvasContext(cid, instance?.proxy)
      const cfg: any = {
        type: props.type,
        context,
        canvasId: cid,
        width: rect.width,
        height: props.height,
        // uCharts v2 依 opts.pixelRatio 决定绘制缩放（opts.pix = opts.pixelRatio || 1），
        // 缺失会在高分屏上模糊
        pixelRatio: uni.getSystemInfoSync().pixelRatio || 1,
        categories: props.categories,
        series: props.series.map((s) => ({ ...s, data: s.data.map((v) => Number(v) || 0) })),
        padding: [15, 15, 0, 8],
        legend: { show: props.series.length > 1, position: 'bottom', fontSize: 11 },
        yAxis: { gridType: 'dash', dashLength: 2, data: [{ title: props.unit, min: 0 }] },
        xAxis: { disableGrid: true, itemCount: props.categories.length > 8 ? 6 : props.categories.length },
        extra: { column: { width: props.series.length > 2 ? 8 : 20 } },
      }
      if (!chart) {
        chart = new uCharts(cfg)
      } else {
        chart.updateData(cfg)
      }
    })
    .exec()
}

// 页面数据经 onShow 异步加载，挂载时通常尚无数据；必须随 props 变化重绘，
// 否则图只会画一次空数据、之后永远不更新
watch(
  () => [props.categories, props.series],
  () => nextTick(() => render()),
  { deep: true },
)

onMounted(() => {
  // 等 canvas 完成布局后再绘制
  setTimeout(render, 50)
})
</script>

<style>
.cb {
  position: relative;
  width: 100%;
}
.cb-canvas {
  display: block;
}
.cb-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #999;
}
</style>