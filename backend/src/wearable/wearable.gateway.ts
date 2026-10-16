import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TutoringService } from '../tutoring/tutoring.service';

/**
 * 穿戴设备接入网关（/wearable 命名空间）
 *
 * 对接：
 * - Rokid Glass3 智能眼镜：第一视角摄像头 + 麦克风，通过其 Android SDK 采集后经 WebSocket 上报
 * - W377E 智能手表（紫光展锐）：麦克风拾音 + 侧边按键求助
 *
 * 设备端协议（JSON over Socket.IO）：
 *   连接握手：{ serialNumber, token }
 *   语音提问（二进制音频或已 ASR 文本）：
 *     - 若设备端已做 ASR：{ event: 'voice_text', text }
 *     - 若上传原始音频：{ event: 'voice_audio' } + binary chunk（服务端转 ASR）
 *   按键求助：{ event: 'sos' }
 *   心跳：{ event: 'ping' }
 *
 * 服务端返回：
 *   { event: 'reply', text }       → 设备端 TTS 播报
 *   { event: 'sos_ack' }           → 求助已受理
 */
@WebSocketGateway({ namespace: '/wearable', cors: { origin: '*' } })
export class WearableGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WearableGateway.name);
  // 设备序列号 → socket
  private deviceConnections = new Map<string, Socket>();
  // socket → 设备信息
  private socketDevices = new Map<string, { serial: string; studentId?: number; sessionId?: number }>();

  constructor(
    private prisma: PrismaService,
    private tutoring: TutoringService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`穿戴设备连接: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const info = this.socketDevices.get(client.id);
    if (info) {
      this.deviceConnections.delete(info.serial);
      // 设备下线
      await this.prisma.device.updateMany({
        where: { serialNumber: info.serial },
        data: { status: 'offline' },
      }).catch(() => {});
      // 结束辅导会话
      if (info.sessionId) {
        await this.tutoring.endSession(info.sessionId).catch(() => {});
      }
    }
    this.socketDevices.delete(client.id);
    this.logger.log(`穿戴设备断开: ${client.id}`);
  }

  // 设备握手注册
  @SubscribeMessage('register')
  async onRegister(@MessageBody() data: { serialNumber: string }, @ConnectedSocket() client: Socket) {
    const device = await this.prisma.device.findUnique({
      where: { serialNumber: data.serialNumber },
    });
    if (!device) {
      client.emit('error', { message: '设备未注册' });
      client.disconnect();
      return;
    }

    await this.prisma.device.update({
      where: { serialNumber: data.serialNumber },
      data: { status: 'online' },
    });

    this.deviceConnections.set(data.serialNumber, client);
    this.socketDevices.set(client.id, {
      serial: data.serialNumber,
      studentId: device.studentId || undefined,
    });

    // 自动开始辅导会话
    if (device.studentId) {
      try {
        const session = await this.tutoring.startSession(device.studentId);
        const info = this.socketDevices.get(client.id);
        if (info) info.sessionId = session.id;
      } catch (e) {
        client.emit('error', { message: '辅导服务未开通或已过期' });
      }
    }

    client.emit('registered', { serialNumber: data.serialNumber, type: device.type });
    this.logger.log(`设备注册成功: ${data.serialNumber} (${device.type})`);
  }

  // 设备端已完成 ASR，直接发文本
  @SubscribeMessage('voice_text')
  async onVoiceText(@MessageBody() data: { text: string }, @ConnectedSocket() client: Socket) {
    const info = this.socketDevices.get(client.id);
    if (!info?.sessionId) {
      client.emit('error', { message: '会话未建立' });
      return;
    }
    const result = await this.tutoring.chat(info.sessionId, data.text);
    client.emit('reply', { text: result.ttsText, messageId: result.messageId });
  }

  // 按键求助（手表 SOS / 眼镜触控）
  @SubscribeMessage('sos')
  async onSos(@ConnectedSocket() client: Socket) {
    const info = this.socketDevices.get(client.id);
    this.logger.warn(`收到求助按键: ${info?.serial}`);

    if (info?.studentId) {
      // 通知家长/老师
      await this.prisma.notification.create({
        data: {
          studentId: info.studentId,
          type: 'sos',
          title: '学生发起求助',
          content: `学生通过穿戴设备发起了求助，请及时关注`,
        },
      });
    }
    client.emit('sos_ack', { message: '求助已受理，老师/家长将尽快联系你' });
    client.emit('reply', { text: '同学你好，我已经收到你的求助，请不要着急，老师和家长马上就会知道。' });
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { time: Date.now() });
  }
}