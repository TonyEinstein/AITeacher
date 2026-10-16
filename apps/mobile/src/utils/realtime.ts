/**
 * 实时站内信 / 课堂旁听适配（H5 / 桌面 WebView）
 * ---------------------------------------------------------------
 * 后端为 socket.io，namespace `/ws`（见 backend/realtime/realtime.gateway.ts）。
 * （离线推送适配层已下线清理，本文件只管站内信与旁听。）
 */
import { ENV } from '@/config/env';

// #ifdef H5
// @ts-ignore - 仅 H5 构建引入 socket.io-client
import { io } from 'socket.io-client';
// #endif

/** WS 根地址：由 apiBase（.../api/v1）推导站点 origin */
function wsOrigin(): string {
  return ENV.apiBase.replace(/\/api\/v\d+\/?$/, '');
}

export interface ClassroomEvent {
  event: string;
  data: any;
  timestamp: number;
}

/** 桌位求助事件数据（PRD §3.37）：桌位键可能绑定学生，也可能匿名 */
export interface HelpKeyData {
  studentId?: number;
  seatNo?: string;
  deviceSerial?: string;
}

/**
 * 求助键监听（B6 桌位求助提醒）
 * ---------------------------------------------------------------
 * 后端 realtime.gateway.ts 收到盒子上报的 help_key 事件后会：
 *  1) 向教室盒子本体下发 help_key_notice（sendToBox，仅盒子连接收到）；
 *  2) 向该教室房间的旁听者广播 classroom_event { event: 'help_key', data }。
 * 本端以旁听者（role=observer）连接，实际走 2) 路径；
 * 同时防御性监听 1) 的 help_key_notice，兼容后续网关直接下发给旁听者的情形。
 */
export function watchHelpKey(
  watchSerial: string,
  onHelpKey: (data: HelpKeyData) => void,
): { disconnect: () => void } {
  // #ifdef H5
  const socket = io(wsOrigin() + '/ws', {
    query: { role: 'observer', watchSerial },
    transports: ['websocket', 'polling'],
  });
  socket.on('help_key_notice', (d: HelpKeyData) => onHelpKey(d || {}));
  socket.on('classroom_event', (payload: ClassroomEvent) => {
    if (payload && payload.event === 'help_key') onHelpKey(payload.data || {});
  });
  return {
    disconnect() {
      socket.disconnect();
    },
  };
  // #endif

  // #ifndef H5
  void onHelpKey;
  return { disconnect() {} };
  // #endif
}
