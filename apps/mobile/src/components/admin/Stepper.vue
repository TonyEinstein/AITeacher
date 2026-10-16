<template>
  <view class="stepper">
    <view class="s-btn" @click="dec">−</view>
    <input class="s-input" type="number" :value="modelValue" @input="onInput" @blur="onBlur" />
    <view class="s-btn" @click="inc">+</view>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
  }>(),
  { min: 0, max: 9999, step: 1 },
)
const emit = defineEmits<{ 'update:modelValue': [number] }>()

function clamp(v: number) {
  return Math.min(props.max, Math.max(props.min, v))
}
function set(v: number) {
  emit('update:modelValue', clamp(v))
}
function dec() {
  set(props.modelValue - props.step)
}
function inc() {
  set(props.modelValue + props.step)
}
function onInput(e: any) {
  const v = Number(e.detail.value)
  if (!Number.isNaN(v)) emit('update:modelValue', v)
}
function onBlur(e: any) {
  const v = Number(e.detail.value)
  set(Number.isNaN(v) ? props.min : v)
}
</script>

<style>
.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
}
.s-btn {
  width: 40px;
  height: 38px;
  line-height: 36px;
  text-align: center;
  font-size: 20px;
  color: #4a4a4a;
  background: #fafbfc;
}
.s-input {
  min-width: 56px;
  width: 64px;
  text-align: center;
  font-size: 15px;
  color: #2b2b2b;
  font-weight: 600;
  height: 38px;
}
</style>
