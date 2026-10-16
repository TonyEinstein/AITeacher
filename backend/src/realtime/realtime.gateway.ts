import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStreamService } from '../media-stream/media-stream.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  // 教室盒子序列号 → socket
  private boxConnections = new Map<string, Socket>();
  // 旁听者（管理员/老师/家长）socket → 旁听的盒子序列号
  private observers = new Map<string, string>();

  constructor(
    private prisma: PrismaService,
    private mediaStream: MediaStreamService,
  ) {}

  async handleConnection(client: Socket) {
    const serial = client.handshake.query.serial as string;
    const role = client.handshake.query.role as string; // observer 时为旁听者
    const watchSerial = client.handshake.query.watchSerial as string; // 旁听的教室

    if (role === 'observer' && watchSerial) {
      // 旁听者加入指定教室房间
      client.join('room:' + watchSerial);
      this.observers.set(client.id, watchSerial);
      this.logger.log(`旁听者加入教室 ${watchSerial}: ${client.id}`);
      return;
    }

    if (serial) {
      this.boxConnections.set(serial, client);
      client.data.serial = serial;
      client.join('room:' + serial);
      this.logger.log(`教室盒子已连接: ${serial}`);

      try {
        await this.prisma.box.updateMany({
          where: { serialNumber: serial },
          data: { status: 'online', lastHeartbeat: new Date() },
        });
      } catch (e) {
        this.logger.error('更新设备状态失败');
      }
    }
  }

  async handleDisconnect(client: Socket) {
    const serial = client.data.serial;
    if (serial) {
      this.boxConnections.delete(serial);
      this.logger.log(`教室盒子断开: ${serial}`);
      try {
        await this.prisma.box.updateMany({
          where: { serialNumber: serial },
          data: { status: 'offline' },
        });
      } catch (e) {}
    }
    if (this.observers.has(client.id)) {
      this.observers.delete(client.id);
    }
  }

  // 教室盒子上报事件
  @SubscribeMessage('event')
  async handleEvent(
    @MessageBody() payload: { event: string; data: any; timestamp: number },
    @ConnectedSocket() client: Socket,
  ) {
    const serial = client.data.serial;
    this.logger.debug(`收到事件 [${serial}] ${payload.event}`);

    switch (payload.event) {
      case 'attendance':
        await this.handleAttendance(serial, payload.data);
        break;
      case 'hand_raise':
        await this.handleHandRaise(serial, payload.data);
        break;
      case 'discipline':
        await this.handleDiscipline(serial, payload.data);
        break;
      case 'noise':
        await this.handleNoise(serial, payload.data);
        break;
      case 'late': // 迟到
        await this.handleLate(serial, payload.data);
        break;
      case 'early_leave': // 早退
        await this.handleEarlyLeave(serial, payload.data);
        break;
      case 'sleep': // 上课睡觉/趴桌
        await this.handleSleep(serial, payload.data);
        break;
      case 'heartbeat': // 盒子定时心跳
        await this.prisma.box.updateMany({
          where: { serialNumber: serial },
          data: { lastHeartbeat: new Date() },
        }).catch(() => {});
        break;
      case 'help_key': // 桌位求助键（PRD §3.37）
        await this.handleHelpKey(serial, payload.data);
        break;
    }

    // 所有课堂事件同步广播给该教室的旁听者
    if (serial) {
      this.server.to('room:' + serial).emit('classroom_event', {
        event: payload.event,
        data: payload.data,
        timestamp: payload.timestamp || Date.now(),
      });
    }
  }

  private async handleAttendance(serial: string, data: any) {
    this.logger.log(`考勤上报: ${JSON.stringify(data.students?.length || 0)} 人`);
  }

  private async handleHandRaise(serial: string, data: any) {
    this.logger.log(`举手: 学生ID ${data.studentId}`);
    this.sendToBox(serial, 'student_hand_raise', data);
  }

  private async handleDiscipline(serial: string, data: any) {
    this.logger.warn(`纪律事件: ${data.type} - 学生ID ${data.studentId}`);
    this.sendToBox(serial, 'discipline_warning', data);
  }

  private async handleNoise(serial: string, data: any) {
    this.logger.debug(`噪声水平: ${data.level}`);
  }

  // 3.3.07 迟到识别
  private async handleLate(serial: string, data: { studentId: number; name?: string; minutesLate?: number }) {
    this.logger.warn(`迟到: 学生 ${data.studentId} 迟到 ${data.minutesLate || 0} 分钟`);
    this.sendToBox(serial, 'late_notice', data);
    // 记录行为事件
    try {
      const box = await this.prisma.box.findFirst({ where: { serialNumber: serial } });
      if (box?.roomId) {
        // LessonRecord 无 boxId 字段，需按 status='ongoing' + schedule.roomId 反查进行中的课（同 handleHelpKey）
        const record = await this.prisma.lessonRecord.findFirst({
          where: { status: 'ongoing', schedule: { roomId: box.roomId } },
          orderBy: { startedAt: 'desc' },
        });
        if (record) {
          await this.prisma.behaviorEvent.create({
            data: {
              lessonRecordId: record.id,
              studentId: data.studentId,
              type: 'late',
              startTime: new Date(),
              note: `迟到 ${data.minutesLate || 0} 分钟`,
            },
          });
        }
      }
    } catch (e) {}
  }

  // 早退识别
  private async handleEarlyLeave(serial: string, data: { studentId: number; name?: string }) {
    this.logger.warn(`早退: 学生 ${data.studentId}`);
    this.sendToBox(serial, 'early_leave_notice', data);
  }

  /**
   * 桌位求助键事件（PRD §3.37）
   *
   * 学生按下桌位求助键 → 教室盒子收到无线信号 → 上报 help_key 事件。
   * 处理：落 BehaviorEvent（type=help_request）+ 通知教室端弹提醒（教师屏幕）。
   * data 可带 { studentId?, seatNo?, deviceSerial? }——桌位键可能绑定学生也可能匿名。
   */
  private async handleHelpKey(serial: string, data: { studentId?: number; seatNo?: string; deviceSerial?: string }) {
    this.logger.warn(`桌位求助 [${serial}]: ${JSON.stringify(data)}`);
    // 回执教室端：屏幕弹求助提醒（含桌位号/学生名）
    this.sendToBox(serial, 'help_key_notice', data);
    try {
      const box = await this.prisma.box.findFirst({ where: { serialNumber: serial } });
      if (!box) return;
      const record = await this.prisma.lessonRecord.findFirst({
        where: { status: 'ongoing', schedule: { roomId: box.roomId } },
        orderBy: { startedAt: 'desc' },
      });
      if (record) {
        await this.prisma.behaviorEvent.create({
          data: {
            lessonRecordId: record.id,
            studentId: data.studentId ?? null,
            type: 'help_request',
            startTime: new Date(),
            note: data.seatNo ? `桌位 ${data.seatNo} 求助` : '桌位求助键触发',
          },
        });
      }
    } catch (e) {
      this.logger.error('求助事件落库失败');
    }
  }

  // 上课睡觉/趴桌（可能是熬夜或身体不适）
  private async handleSleep(serial: string, data: { studentId: number; duration?: number }) {    this.logger.warn(`趴桌/睡觉: 学生 ${data.studentId}，持续 ${data.duration || 0} 秒`);
    this.sendToBox(serial, 'sleep_notice', data);
    try {
      const box = await this.prisma.box.findFirst({ where: { serialNumber: serial } });
      if (box?.roomId) {
        // LessonRecord 无 boxId 字段，需按 status='ongoing' + schedule.roomId 反查进行中的课（同 handleHelpKey）
        const record = await this.prisma.lessonRecord.findFirst({
          where: { status: 'ongoing', schedule: { roomId: box.roomId } },
          orderBy: { startedAt: 'desc' },
        });
        if (record) {
          await this.prisma.behaviorEvent.create({
            data: {
              lessonRecordId: record.id,
              studentId: data.studentId,
              type: 'sleeping',
              startTime: new Date(),
              note: `趴桌/睡觉持续 ${data.duration || 0} 秒，可能熬夜或身体不适`,
            },
          });
          // 通知家长关注
          await this.prisma.notification.create({
            data: {
              studentId: data.studentId,
              type: 'warning',
              title: '课堂状态提醒',
              content: `您的孩子在课堂上出现趴桌/睡觉情况，持续约${Math.round((data.duration || 0) / 60)}分钟，可能是熬夜或身体不适，请关注。`,
            },
          });
        }
      }
    } catch (e) {}
  }

  /**
   * 媒体流：教室端开始推流
   */
  @SubscribeMessage('stream_start')
  async handleStreamStart(@ConnectedSocket() client: Socket) {
    const serial = client.data.serial;
    if (!serial) return { success: false, message: '未授权的盒子' };
    const streamKey = this.mediaStream.startStream(serial);
    const playUrl = this.mediaStream.getPlayUrl(serial);
    this.logger.log(`教室 ${serial} 开始推流，streamKey=${streamKey}`);
    return { success: !!streamKey, streamKey, playUrl };
  }

  /**
   * 媒体流：接收视频数据块并转推 SRS
   */
  @SubscribeMessage('stream_chunk')
  async handleStreamChunk(
    @MessageBody() payload: { chunk: string },
    @ConnectedSocket() client: Socket,
  ) {
    const serial = client.data.serial;
    if (!serial) return;
    this.mediaStream.pushChunk(serial, payload.chunk);
  }

  /**
   * 媒体流：教室端停止推流
   */
  @SubscribeMessage('stream_stop')
  async handleStreamStop(@ConnectedSocket() client: Socket) {
    const serial = client.data.serial;
    if (!serial) return;
    this.mediaStream.stopStream(serial);
    this.logger.log(`教室 ${serial} 停止推流`);
  }

  /**
   * 3.3.12 旁听老师实时纠正 AI
   * 旁听者发送纠正指令，转发给教室盒子，数字人按新内容讲
   */
  @SubscribeMessage('correction')
  async handleCorrection(
    @MessageBody() payload: { serial: string; instruction: string; action?: 'override' | 'skip' | 'pause' | 'resume' },
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.observers.has(client.id)) {
      client.emit('error', { message: '仅旁听者可发送纠正指令' });
      return;
    }
    this.logger.log(`旁听纠正 [${payload.serial}]: ${payload.instruction}`);
    // 转发给教室端，教室端收到后重新请求 LLM 生成内容
    this.sendToBox(payload.serial, 'teacher_correction', {
      instruction: payload.instruction,
      action: payload.action || 'override',
      at: Date.now(),
    });
    client.emit('correction_ack', { received: true });
  }

  // 旁听者请求控制课堂（点名、警告等）
  @SubscribeMessage('classroom_control')
  async handleControl(
    @MessageBody() payload: { serial: string; control: string; params?: any },
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.observers.has(client.id)) return;
    this.sendToBox(payload.serial, 'control_' + payload.control, payload.params || {});
  }

  // 向指定教室盒子发消息
  sendToBox(serial: string, event: string, data: any) {
    const client = this.boxConnections.get(serial);
    if (client) {
      client.emit(event, data);
    }
  }

  // 向所有在线盒子广播
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
}
