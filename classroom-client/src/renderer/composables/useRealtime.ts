import { ref } from 'vue';
import { io, Socket } from 'socket.io-client';

/**
 * 教室端实时连接
 * 连接后端 /ws 命名空间，接收：
 * - student_hand_raise 学生举手
 * - discipline_warning 纪律警告
 * - late_notice / early_leave_notice / sleep_notice 考勤异常
 * - help_key_notice 桌位求助键（PRD §3.37）
 * - teacher_correction 旁听老师实时纠正
 * - control_* 课堂控制指令
 */
export function useRealtime() {
  const connected = ref(false);
  const handRaiseEvent = ref<any>(null);
  const disciplineEvent = ref<any>(null);
  const noticeEvent = ref<any>(null);
  const helpKeyEvent = ref<any>(null);
  const correctionEvent = ref<any>(null);
  let socket: Socket | null = null;
  let serial = '';

  function connect(deviceSerial: string) {
    serial = deviceSerial;
    const url = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    socket = io(url + '/ws', {
      query: { serial },
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 20,
    });

    socket.on('connect', () => {
      connected.value = true;
      console.log('[WS] 已连接实时网关');
      startHeartbeat();
    });

    socket.on('disconnect', () => {
      connected.value = false;
      console.warn('[WS] 连接断开，将自动重连');
    });

    // 学生举手
    socket.on('student_hand_raise', (data: any) => {
      console.log('[WS] 学生举手', data);
      handRaiseEvent.value = { ...data, at: Date.now() };
    });

    // 纪律警告
    socket.on('discipline_warning', (data: any) => {
      console.log('[WS] 纪律警告', data);
      disciplineEvent.value = { ...data, at: Date.now() };
    });

    // 迟到/早退/睡觉通知
    socket.on('late_notice', (data: any) => { noticeEvent.value = { kind: 'late', ...data }; });
    socket.on('early_leave_notice', (data: any) => { noticeEvent.value = { kind: 'early_leave', ...data }; });
    socket.on('sleep_notice', (data: any) => { noticeEvent.value = { kind: 'sleep', ...data }; });

    // 桌位求助键（PRD §3.37）：后端 handleHelpKey 处理后回执本教室
    socket.on('help_key_notice', (data: any) => {
      console.log('[WS] 桌位求助', data);
      helpKeyEvent.value = { ...data, at: Date.now() };
    });

    // 旁听老师实时纠正 AI
    socket.on('teacher_correction', (data: any) => {
      console.log('[WS] 老师纠正指令', data);
      correctionEvent.value = { ...data, at: Date.now() };
    });

    // 课堂控制
    socket.on('control_question', () => { /* 触发提问 */ });
    socket.on('control_warning', () => { /* 触发警告 */ });
  }

  let heartbeatTimer: any = null;
  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (socket?.connected) {
        socket.emit('event', { event: 'heartbeat', data: { serial }, timestamp: Date.now() });
      }
    }, 15000);
  }

  // 教室端上报视觉事件（人脸/举手/纪律由视觉服务上报，也可经此通道）
  function report(event: string, data: any) {
    socket?.emit('event', { event, data, timestamp: Date.now() });
  }

  function disconnect() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    socket?.disconnect();
    socket = null;
  }

  return {
    connected,
    handRaiseEvent,
    disciplineEvent,
    noticeEvent,
    helpKeyEvent,
    correctionEvent,
    connect,
    disconnect,
    report,
    getSocket: () => socket,
  };
}