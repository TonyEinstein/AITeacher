<template>
  <scroll-view scroll-x class="st" :show-scrollbar="false">
    <view class="table">
      <view class="tr head">
        <view v-for="c in columns" :key="c.key" class="td" :style="{ width: c.width || 'auto', minWidth: c.minWidth || '80px' }">
          {{ c.title }}
        </view>
      </view>
      <view v-for="(r, i) in rows" :key="i" class="tr" :class="{ stripe: i % 2 === 1 }">
        <view v-for="c in columns" :key="c.key" class="td" :style="{ width: c.width || 'auto', minWidth: c.minWidth || '80px' }">
          <slot :name="'cell-' + c.key" :row="r" :value="r[c.key]">{{ r[c.key] }}</slot>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
export interface TableColumn {
  key: string
  title: string
  width?: string
  minWidth?: string
}
defineProps<{ columns: TableColumn[]; rows: any[] }>()
</script>

<style>
.st {
  width: 100%;
}

.table {
  display: inline-flex;
  flex-direction: column;
  min-width: 100%;
}

.tr {
  display: flex;
  border-bottom: 1px solid #eef0f2;
}

.tr.stripe {
  background: #fafbfc;
}

.tr.head {
  background: #f5f7f9;
  font-weight: 600;
  color: #4a4a4a;
  font-size: 13px;
}

.td {
  padding: 10px 14px;
  font-size: 13px;
  color: #2b2b2b;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  flex-shrink: 0;
}
</style>
