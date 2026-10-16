import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../utils/api';

export const useClassroomStore = defineStore('classroom', () => {
  const boxInfo = ref<any>(null);
  const todaySchedule = ref<any[]>([]);
  const currentLesson = ref<any>(null);
  const isTeaching = ref(false);
  const status = ref('idle');

  async function init(serial: string) {
    try {
      boxInfo.value = await api.heartbeat(serial);
      status.value = 'ready';
      await loadTodaySchedule();
    } catch (e) {
      console.error('鉴权失败:', e);
      status.value = 'offline';
    }
  }

  async function loadTodaySchedule() {
    if (!boxInfo.value?.id) return;
    todaySchedule.value = await api.getTodaySchedule(boxInfo.value.id);
  }

  function startLesson(lesson: any) {
    currentLesson.value = lesson;
    isTeaching.value = true;
    status.value = 'teaching';
  }

  function endLesson() {
    isTeaching.value = false;
    currentLesson.value = null;
    status.value = 'ready';
  }

  return { boxInfo, todaySchedule, currentLesson, isTeaching, status, init, loadTodaySchedule, startLesson, endLesson };
});
