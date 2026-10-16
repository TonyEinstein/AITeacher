<template>
  <div class="classroom-app">
    <!-- 待机/启动页 -->
    <div v-if="status === 'idle' || status === 'offline'" class="boot-screen">
      <div class="boot-content">
        <h1 class="title">AI Teacher 智能教学系统</h1>
        <p v-if="status === 'idle'" class="subtitle">正在连接服务器...</p>
        <p v-else class="subtitle error">网络连接失败，正在尝试切换备用网络...</p>
        <div class="network-status">
          <span :class="['dot', networkPrimary ? 'on' : 'off']"></span> 有线网络
          <span :class="['dot', networkBackup ? 'on' : 'off']" style="margin-left:20px"></span> 4G备用
        </div>
      </div>
    </div>

    <!-- 课表待机页 -->
    <div v-else-if="!isTeaching" class="schedule-screen">
      <div class="schedule-header">
        <h2>今日课程</h2>
        <div class="device-info">{{ boxInfo?.room?.name || '未分配教室' }}</div>
      </div>
      <div class="schedule-list">
        <div
          v-for="item in todaySchedule"
          :key="item.id"
          class="schedule-item"
          @click="startLessonWrap(item)"
        >
          <span class="time">{{ formatTime(item.startTime) }} - {{ formatTime(item.endTime) }}</span>
          <span class="lesson-name">{{ item.lessonPlan?.title || '课程' }}</span>
          <span class="class-name">{{ item.class?.name }}</span>
          <span class="start-btn">开始上课</span>
        </div>
        <p v-if="todaySchedule.length === 0" class="no-lesson">今日暂无课程</p>
      </div>
    </div>

    <!-- 上课界面 -->
    <div v-else class="teaching-screen">
      <!-- 左侧：PPT/板书区 -->
      <div class="ppt-area">
        <div class="ppt-header">
          <h2>{{ currentLesson?.lessonPlan?.title }}</h2>
          <div class="lesson-timer">{{ lessonTimeText }}</div>
        </div>
        <div class="ppt-content">
          <div class="ppt-placeholder">
            <p>教学课件 / PPT 展示区</p>
            <p class="sub">课前自动预热缓存，断网可继续讲完本节课</p>
          </div>
          <!-- 摄像头预览（直播推流源） -->
          <div class="camera-preview" :class="{ active: cameraOn }">
            <video ref="cameraVideo" autoplay muted playsinline></video>
            <div class="camera-overlay">
              <span :class="['live-dot', streaming ? 'on' : '']"></span>
              {{ streaming ? '直播中' : '预览' }}
            </div>
          </div>
        </div>
        <!-- 课中提问区 -->
        <div v-if="currentQuestion" class="question-overlay">
          <div class="question-card">
            <h3>课堂提问</h3>
            <p>{{ currentQuestion.text }}</p>
            <div class="options">
              <button v-for="(opt, i) in currentQuestion.options" :key="i" class="opt-btn">{{ opt }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：数字人 + 课堂状态 -->
      <div class="side-panel">
        <div class="teacher-area">
          <DigitalAvatar :isSpeaking="isSpeaking" :name="teacherName" :style="teacherStyle" />
          <div class="tts-status">
            <span :class="['tts-dot', isSpeaking ? 'speaking' : '']"></span>
            {{ isSpeaking ? '正在讲课...' : '待机' }}
            <button v-if="isSpeaking" class="tts-stop-btn" @click="stopSpeaking">停止</button>
          </div>
        </div>

        <!-- 举手提示 -->
        <div v-if="handRaiseStudent" class="alert hand-alert">
          <div class="alert-title">学生举手</div>
          <div class="alert-name">{{ handRaiseStudent }}</div>
          <button class="alert-btn" @click="answerStudent">叫起回答</button>
        </div>

        <!-- 纪律警告 -->
        <div v-if="disciplineAlert" class="alert discipline-alert">
          <div class="alert-title">纪律提醒</div>
          <div class="alert-name">{{ disciplineAlert.name }} - {{ disciplineAlert.typeText }}</div>
        </div>

        <!-- 桌位求助键（PRD §3.37） -->
        <div v-if="helpKeyAlert" class="alert help-alert">
          <div class="alert-title">桌位求助</div>
          <div class="alert-name">
            {{ helpKeyAlert.seatNo || '未标桌位' }} -
            {{ helpKeyAlert.studentId ? ('学生' + helpKeyAlert.studentId) : '匿名桌位键' }}
          </div>
        </div>

        <!-- 考勤异常（迟到/早退/睡觉） -->
        <div v-if="noticeAlert" class="alert notice-alert">
          <div class="alert-title">
            {{ noticeAlert.kind === 'late' ? '迟到提醒' : noticeAlert.kind === 'early_leave' ? '早退提醒' : '课堂状态提醒' }}
          </div>
          <div class="alert-name">
            {{ noticeAlert.name || ('学生' + (noticeAlert.studentId || '')) }}
            <span v-if="noticeAlert.kind === 'late'"> 迟到{{ noticeAlert.minutesLate || '' }}分钟</span>
            <span v-else-if="noticeAlert.kind === 'sleep'"> 趴桌/睡觉，可能身体不适</span>
          </div>
        </div>

        <!-- 旁听老师实时纠正 -->
        <div v-if="correctionAlert" class="alert correction-alert">
          <div class="alert-title">老师实时指导</div>
          <div class="alert-name correction-text">{{ correctionAlert.instruction }}</div>
        </div>

        <!-- WS 连接状态 -->
        <div :class="['ws-status', wsConnected ? 'on' : 'off']">
          {{ wsConnected ? '实时连接正常' : '实时连接断开' }}
        </div>

        <!-- 在线学生 -->
        <div class="attendance-panel">
          <h4>课堂出勤 ({{ presentCount }}/{{ totalCount }})</h4>
          <div class="student-grid">
            <div v-for="s in studentList" :key="s.id" :class="['student-chip', s.status]">
              {{ s.name }}
            </div>
          </div>
        </div>
      </div>

      <!-- 底部控制栏 -->
      <div class="control-bar">
        <button class="ctrl-btn" @click="askQuestion">随机提问</button>
        <button class="ctrl-btn warning" @click="showWarning">纪律警告</button>
        <button :class="['ctrl-btn', streaming ? 'streaming' : '']" @click="toggleStreaming">
          {{ streaming ? '停止直播' : '开始直播' }}
        </button>
        <button class="ctrl-btn end" @click="endLesson">下课</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useClassroomStore } from './stores/classroom';
import { useRealtime } from './composables/useRealtime';
import { tts } from './utils/tts';
import DigitalAvatar from './components/DigitalAvatar.vue';

const store = useClassroomStore();
const { status, todaySchedule, currentLesson, isTeaching, boxInfo, init, startLesson, endLesson } = store;

const networkPrimary = ref(true);
const networkBackup = ref(false);
const isSpeaking = ref(false);
const teacherName = ref('AI 教师');
const teacherStyle = ref<'serious' | 'gentle' | 'humorous'>('gentle');
const handRaiseStudent = ref('');
const disciplineAlert = ref<any>(null);
const noticeAlert = ref<any>(null);
const helpKeyAlert = ref<any>(null);
const correctionAlert = ref<any>(null);
const wsConnected = ref(false);
const currentQuestion = ref<any>(null);
const lessonSeconds = ref(0);
const studentList = ref<any[]>([]);
const presentCount = ref(0);
const totalCount = ref(0);
const cameraVideo = ref<HTMLVideoElement | null>(null);
const cameraOn = ref(false);
const streaming = ref(false);
let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let timer: any = null;

const realtime = useRealtime();

const lessonTimeText = computed(() => {
  const m = Math.floor(lessonSeconds.value / 60);
  const s = lessonSeconds.value % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

onMounted(async () => {
  let serial = 'DEV-BOX-001';
  if ((window as any).electronAPI?.getDeviceSerial) {
    serial = await (window as any).electronAPI.getDeviceSerial();
  }
  await init(serial);
  startHeartbeat();

  // 连接实时网关
  realtime.connect(serial);
  wsConnected.value = realtime.connected.value;

  // 启动摄像头（上课推流源）
  startCamera();

  // 学生举手（视觉服务识别后经后端转发）
  watch(realtime.handRaiseEvent, (d: any) => {
    if (!d) return;
    handRaiseStudent.value = d.name || ('学生' + (d.studentId || ''));
  });
  // 纪律警告
  watch(realtime.disciplineEvent, (d: any) => {
    if (!d) return;
    const typeMap: Record<string, string> = { talking: '课堂讲话', walking: '随意走动', sleeping: '趴桌睡觉' };
    disciplineAlert.value = { name: d.name || ('学生' + (d.studentId || '')), typeText: typeMap[d.type] || d.type };
    setTimeout(() => { disciplineAlert.value = null; }, 5000);
  });
  // 考勤异常通知（迟到/早退/睡觉）
  watch(realtime.noticeEvent, (d: any) => {
    if (!d) return;
    noticeAlert.value = d;
    setTimeout(() => { noticeAlert.value = null; }, 5000);
  });
  // 桌位求助键（PRD §3.37）：新事件覆盖旧弹窗，10 秒自动消失
  watch(realtime.helpKeyEvent, (d: any) => {
    if (!d) return;
    helpKeyAlert.value = d;
    setTimeout(() => { helpKeyAlert.value = null; }, 10000);
  });
  // 旁听老师实时纠正 AI
  watch(realtime.correctionEvent, (d: any) => {
    if (!d) return;
    correctionAlert.value = d;
    isSpeaking.value = true;
    // 实际场景：用 d.instruction 重新请求 LLM 生成讲课内容
    setTimeout(() => { isSpeaking.value = false; }, 5000);
    setTimeout(() => { correctionAlert.value = null; }, 8000);
  });
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  realtime.disconnect();
  stopStreaming();
  stopCamera();
  tts.stop();
});

function startHeartbeat() {
  timer = setInterval(async () => {
    if (store.isTeaching) lessonSeconds.value++;
  }, 1000);
}

function formatTime(d: string) {
  const date = new Date(d);
  return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
}

function startLessonWrap(item: any) {
  startLesson(item);
  lessonSeconds.value = 0;
  // 模拟学生名单
  totalCount.value = 45;
  presentCount.value = 44;
  studentList.value = Array.from({ length: 45 }, (_, i) => ({
    id: i + 1,
    name: '学生' + (i + 1),
    status: i === 44 ? 'absent' : 'present',
  }));
  // 设置教师名称和风格
  teacherName.value = item.lessonPlan?.subject?.name + '老师' || 'AI 教师';
  const agentStyle = item.agent?.style;
  if (agentStyle === 'serious' || agentStyle === 'gentle' || agentStyle === 'humorous') {
    teacherStyle.value = agentStyle;
  }
  // 开始讲课：TTS 朗读开场白
  const lessonTitle = item.lessonPlan?.title || '今天的课程';
  const opening = `同学们好，现在开始上课。我是你们的${teacherName.value}。今天我们来学习${lessonTitle}。请大家保持安静，专心听讲。`;
  speakText(opening);
}

/** TTS 朗读文本（带口型同步） */
function speakText(text: string) {
  if (!tts.isSupported()) {
    console.warn('当前环境不支持 TTS');
    isSpeaking.value = true;
    setTimeout(() => { isSpeaking.value = false; }, 5000);
    return;
  }
  const styleOptions = tts.setStyle(teacherStyle.value);
  tts.speakLong(text, {
    ...styleOptions,
    onStart: () => { isSpeaking.value = true; },
    onEnd: () => { isSpeaking.value = false; },
  });
}

/** 停止讲课 */
function stopSpeaking() {
  tts.stop();
  isSpeaking.value = false;
}

function askQuestion() {
  const questions = [
    { text: '请回答：这道题的解题思路是什么？', options: ['A. 思路一', 'B. 思路二', 'C. 思路三', 'D. 思路四'] },
  ];
  currentQuestion.value = questions[0];
  const randomStudent = studentList.value[Math.floor(Math.random() * studentList.value.length)];
  if (randomStudent) handRaiseStudent.value = randomStudent.name;
  speakText(`${randomStudent?.name || '这位同学'}，请回答：${questions[0].text}`);
}

function showWarning() {
  disciplineAlert.value = { name: '某位同学', typeText: '课堂讲话' };
  setTimeout(() => { disciplineAlert.value = null; }, 4000);
}

function answerStudent() {
  handRaiseStudent.value = '';
  currentQuestion.value = null;
}

/** 启动摄像头 */
async function startCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: true,
    });
    if (cameraVideo.value) {
      cameraVideo.value.srcObject = mediaStream;
    }
    cameraOn.value = true;
    console.log('摄像头已启动');
  } catch (e: any) {
    console.warn('摄像头启动失败:', e?.message);
    cameraOn.value = false;
  }
}

/** 停止摄像头 */
function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (cameraVideo.value) {
    cameraVideo.value.srcObject = null;
  }
  cameraOn.value = false;
}

/** 开始直播推流（MediaRecorder + WebSocket 发后端，后端转推 SRS） */
async function startStreaming() {
  if (!mediaStream) {
    console.warn('无摄像头流，无法推流');
    return;
  }
  try {
    // 优先用 H.264，降级用 VP8
    const mimeTypes = ['video/webm;codecs=h264', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType, videoBitsPerSecond: 1500000 });

    // 通过 WebSocket 发送媒体数据到后端
    const ws = realtime.getSocket?.();
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws?.connected) {
        ws.emit('stream_chunk', { data: e.data });
      }
    };
    mediaRecorder.onstart = () => { streaming.value = true; };
    mediaRecorder.onstop = () => { streaming.value = false; };
    mediaRecorder.start(1000); // 每秒发一个 chunk
    console.log('直播推流已启动');
  } catch (e: any) {
    console.warn('推流失败:', e?.message);
    streaming.value = false;
  }
}

/** 停止推流 */
function stopStreaming() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  streaming.value = false;
}

/** 切换推流 */
function toggleStreaming() {
  if (streaming.value) {
    stopStreaming();
  } else {
    startStreaming();
  }
}
</script>

<style scoped>
* { box-sizing: border-box; }
.classroom-app { width: 100vw; height: 100vh; background: #f0f2f5; overflow: hidden; font-family: 'Microsoft YaHei', sans-serif; }
.boot-screen, .schedule-screen { display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; }
.title { font-size: 48px; color: #1e3a5f; }
.subtitle { font-size: 20px; color: #666; margin-top: 20px; }
.subtitle.error { color: #e53e3e; }
.network-status { margin-top: 30px; font-size: 18px; color: #666; }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
.dot.on { background: #48bb78; }
.dot.off { background: #cbd5e0; }
.schedule-header { width: 800px; display: flex; justify-content: space-between; align-items: center; }
.schedule-header h2 { font-size: 32px; color: #1e3a5f; }
.device-info { color: #666; }
.schedule-list { width: 800px; margin-top: 20px; }
.schedule-item { display: flex; align-items: center; gap: 24px; padding: 24px; background: #fff; border-radius: 12px; margin-bottom: 12px; cursor: pointer; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.schedule-item:hover { background: #ebf4ff; }
.time { color: #3182ce; font-weight: bold; width: 220px; }
.lesson-name { flex: 1; }
.start-btn { color: #3182ce; font-size: 16px; }
.no-lesson { text-align: center; color: #999; padding: 60px; font-size: 20px; }
.teaching-screen { display: flex; height: calc(100% - 80px); }
.ppt-area { flex: 1; padding: 30px; display: flex; flex-direction: column; }
.ppt-header { display: flex; justify-content: space-between; align-items: center; }
.ppt-header h2 { color: #1e3a5f; font-size: 28px; }
.lesson-timer { font-size: 24px; color: #e6a23c; font-weight: bold; font-family: monospace; }
.ppt-content { flex: 1; margin-top: 20px; }
.ppt-placeholder { height: 100%; background: #fff; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; }
.ppt-placeholder p { font-size: 24px; }
.ppt-placeholder .sub { font-size: 16px; margin-top: 12px; }
.side-panel { width: 340px; background: #fff; margin: 20px 20px 20px 0; border-radius: 12px; padding: 20px; overflow-y: auto; }
.avatar-box { text-align: center; }
.avatar-circle { width: 160px; height: 160px; border-radius: 50%; background: linear-gradient(135deg, #4299e1, #2b6cb0); margin: 0 auto; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
.avatar-placeholder p { color: #666; margin-top: 16px; }
.tts-status { text-align: center; color: #666; margin: 16px 0; }
.tts-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #cbd5e0; margin-right: 6px; }
.tts-dot.speaking { background: #48bb78; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.alert { border-radius: 10px; padding: 16px; margin: 12px 0; text-align: center; }
.hand-alert { background: #ebf8ff; border: 1px solid #4299e1; }
.discipline-alert { background: #fff5f5; border: 1px solid #fc8181; }
.notice-alert { background: #fffff0; border: 1px solid #ecc94b; }
.help-alert { background: #fffaf0; border: 2px solid #ed8936; }
.correction-alert { background: #f0fff4; border: 2px solid #48bb78; }
.correction-text { font-size: 16px; font-weight: normal; text-align: left; }
.ws-status { position: fixed; top: 12px; right: 16px; font-size: 12px; padding: 4px 12px; border-radius: 12px; z-index: 100; }
.ws-status.on { background: #f0fff4; color: #2f855a; }
.ws-status.off { background: #fff5f5; color: #c53030; }
.alert-title { font-size: 14px; color: #666; }
.alert-name { font-size: 20px; font-weight: bold; margin: 8px 0; color: #1e3a5f; }
.alert-btn { background: #3182ce; color: #fff; border: none; padding: 8px 24px; border-radius: 6px; cursor: pointer; }
.attendance-panel { margin-top: 20px; }
.attendance-panel h4 { color: #1e3a5f; margin-bottom: 12px; }
.student-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.student-chip { font-size: 12px; padding: 4px 8px; border-radius: 4px; background: #f0fff4; color: #2f855a; }
.student-chip.absent { background: #fff5f5; color: #c53030; }
.control-bar { position: fixed; bottom: 0; left: 0; right: 340px; height: 80px; background: #fff; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 20px; }
.ctrl-btn { padding: 12px 32px; font-size: 18px; border: none; border-radius: 8px; cursor: pointer; background: #edf2f7; color: #2d3748; }
.ctrl-btn.warning { background: #fef3c7; color: #92400e; }
.ctrl-btn.end { background: #e53e3e; color: #fff; }
.question-overlay { position: absolute; top: 50%; left: 35%; transform: translate(-50%, -50%); }
.question-card { background: #fff; padding: 30px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 500px; }
.question-card h3 { color: #1e3a5f; }
.question-card p { font-size: 20px; margin: 16px 0; }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.opt-btn { padding: 14px; border: 1px solid #cbd5e0; background: #f7fafc; border-radius: 8px; cursor: pointer; font-size: 16px; }
.ppt-area { position: relative; }
.camera-preview {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 240px;
  height: 135px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.3);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  background: #000;
  opacity: 0.9;
  transition: all 0.3s;
}
.camera-preview.active { opacity: 1; }
.camera-preview video { width: 100%; height: 100%; object-fit: cover; }
.camera-overlay {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 12px;
  color: #fff;
  background: rgba(0,0,0,0.5);
  padding: 2px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
}
.live-dot.on {
  background: #e53e3e;
  animation: blink 1s infinite;
}
.ctrl-btn.streaming {
  background: #fed7d7;
  color: #c53030;
  animation: pulse-btn 1.5s infinite;
}
@keyframes pulse-btn {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.tts-stop-btn {
  margin-left: 8px;
  padding: 2px 10px;
  font-size: 12px;
  border: 1px solid #cbd5e0;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}
</style>
