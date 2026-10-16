import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

interface StreamSession {
  process: ChildProcessWithoutNullStreams;
  streamKey: string;
  startedAt: Date;
  chunkCount: number;
}

/**
 * 媒体流接收与转推服务
 * 教室端通过 WebSocket 发送 stream_chunk（WebM 格式），
 * 本服务用 ffmpeg 从 stdin 读取并转推到 SRS RTMP，
 * 家长端通过 HTTP-FLV/HLS 播放。
 */
@Injectable()
export class MediaStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(MediaStreamService.name);
  private sessions = new Map<string, StreamSession>();

  private readonly ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  private readonly rtmpHost = process.env.SRS_RTMP_HOST || '127.0.0.1';
  private readonly rtmpPort = process.env.SRS_RTMP_PORT || '1935';
  private readonly httpPort = process.env.SRS_HTTP_PORT || '8080';

  /**
   * 启动某个教室的转推会话
   */
  startStream(serial: string): string | null {
    if (this.sessions.has(serial)) {
      this.logger.warn(`教室 ${serial} 已存在转推会话，先停止旧会话`);
      this.stopStream(serial);
    }

    const streamKey = `classroom_${serial}_${Date.now()}`;
    const rtmpUrl = `rtmp://${this.rtmpHost}:${this.rtmpPort}/live/${streamKey}`;

    // ffmpeg 从 stdin 读取 WebM，转码为 H.264 + AAC，输出 FLV 到 SRS
    const args = [
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-f', 'flv',
      rtmpUrl,
    ];

    try {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      proc.stderr.on('data', (data) => {
        // ffmpeg 日志输出到 stderr，只记录关键信息
        const msg = data.toString().slice(0, 200);
        if (msg.includes('error') || msg.includes('Error')) {
          this.logger.error(`ffmpeg [${serial}]: ${msg}`);
        }
      });

      proc.on('error', (err) => {
        this.logger.error(`ffmpeg 进程启动失败 [${serial}]: ${err.message}`);
        this.sessions.delete(serial);
      });

      proc.on('close', (code) => {
        this.logger.log(`ffmpeg 进程退出 [${serial}], code=${code}`);
        this.sessions.delete(serial);
      });

      this.sessions.set(serial, {
        process: proc,
        streamKey,
        startedAt: new Date(),
        chunkCount: 0,
      });

      this.logger.log(`教室 ${serial} 转推已启动，streamKey=${streamKey}`);
      return streamKey;
    } catch (e: any) {
      this.logger.error(`启动 ffmpeg 失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 接收视频流数据块并写入 ffmpeg stdin
   */
  pushChunk(serial: string, chunk: Buffer | string): boolean {
    const session = this.sessions.get(serial);
    if (!session) {
      // 自动启动会话
      this.startStream(serial);
      return false;
    }

    try {
      const data = typeof chunk === 'string' ? Buffer.from(chunk, 'base64') : chunk;
      session.process.stdin.write(data);
      session.chunkCount++;
      return true;
    } catch (e: any) {
      this.logger.error(`写入 ffmpeg stdin 失败 [${serial}]: ${e.message}`);
      return false;
    }
  }

  /**
   * 停止某个教室的转推会话
   */
  stopStream(serial: string): void {
    const session = this.sessions.get(serial);
    if (session) {
      try {
        session.process.stdin.end();
        session.process.kill('SIGTERM');
      } catch (e) {}
      this.sessions.delete(serial);
      this.logger.log(`教室 ${serial} 转推已停止，共接收 ${session.chunkCount} 个数据块`);
    }
  }

  /**
   * 获取教室的播放地址（HTTP-FLV，低延迟）
   */
  getPlayUrl(serial: string): string | null {
    const session = this.sessions.get(serial);
    if (!session) return null;
    return `http://${this.rtmpHost}:${this.httpPort}/live/${session.streamKey}.flv`;
  }

  /**
   * 模块销毁时停止所有会话
   */
  onModuleDestroy() {
    this.sessions.forEach((_, serial) => this.stopStream(serial));
  }
}
