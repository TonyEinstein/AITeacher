import { Injectable } from '@nestjs/common';

@Injectable()
export class LiveService {
  // SRS 配置
  private srsHost = process.env.SRS_HOST || '127.0.0.1';
  private srsHttpPort = process.env.SRS_HTTP_PORT || '8080';
  private srsRtmpPort = process.env.SRS_RTMP_PORT || '1935';

  // 获取推流地址（教室端用）
  getPushUrl(streamKey: string) {
    return {
      rtmp: `rtmp://${this.srsHost}:${this.srsRtmpPort}/live/${streamKey}`,
      webrtc: `webrtc://${this.srsHost}/live/${streamKey}`,
    };
  }

  // 获取拉流地址（小程序/管理端用）
  getPullUrl(streamKey: string) {
    const host = this.srsHost;
    return {
      flv: `http://${host}:${this.srsHttpPort}/live/${streamKey}.flv`,
      hls: `http://${host}:${this.srsHttpPort}/live/${streamKey}.m3u8`,
      webrtc: `webrtc://${host}/live/${streamKey}`,
      rtmp: `rtmp://${host}:${this.srsRtmpPort}/live/${streamKey}`,
    };
  }

  // 根据教室ID生成流名
  getStreamKeyByRoom(roomId: number) {
    return `room-${roomId}`;
  }

  // 根据排课ID生成流名（一节课一个流）
  getStreamKeyBySchedule(scheduleId: number) {
    return `lesson-${scheduleId}`;
  }
}
