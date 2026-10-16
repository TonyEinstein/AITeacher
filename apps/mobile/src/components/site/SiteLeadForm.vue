<script setup lang="ts">
import { reactive, ref } from 'vue';
import { submitLead } from '@/api/site';
import { useTracking } from '@/composables/useSite';

withDefaults(defineProps<{ page?: string; compact?: boolean }>(), {
  page: '/contact',
  compact: false,
});
const emit = defineEmits<{ (e: 'submitted'): void }>();

const form = reactive({ company: '', name: '', phone: '', message: '' });
const submitting = ref(false);
const ok = ref(false);
const errorMsg = ref('');

const { leadSubmit } = useTracking();

async function onSubmit() {
  if (!form.company.trim() || !form.name.trim() || !form.phone.trim()) {
    ok.value = false;
    errorMsg.value = '请填写学校名称、姓名和联系电话';
    return;
  }
  submitting.value = true;
  errorMsg.value = '';
  try {
    await submitLead({
      company: form.company.trim(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      message: form.message.trim() || undefined,
    });
    leadSubmit(form.company ? '/contact' : '/contact', { company: form.company.trim() });
    ok.value = true;
    form.company = '';
    form.name = '';
    form.phone = '';
    form.message = '';
    emit('submitted');
  } catch (e: any) {
    ok.value = false;
    errorMsg.value = e?.message || '提交失败，请稍后再试';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <view class="lead-form">
    <input class="lf-input" v-model="form.company" placeholder="学校名称" :placeholder-style="'color:#7a8a96'" />
    <input class="lf-input" v-model="form.name" placeholder="您的姓名" :placeholder-style="'color:#7a8a96'" />
    <input class="lf-input" v-model="form.phone" type="tel" placeholder="联系电话" :placeholder-style="'color:#7a8a96'" />
    <input class="lf-input" v-model="form.message" placeholder="想了解的需求（可选）" :placeholder-style="'color:#7a8a96'" />
    <view class="btn btn-primary" @click="onSubmit">
      {{ submitting ? '提交中…' : '预约演示' }}
    </view>
    <text v-if="ok" class="form-tip ok">感谢！我们会尽快联系您。</text>
    <text v-else-if="errorMsg" class="form-tip err">{{ errorMsg }}</text>
  </view>
</template>
