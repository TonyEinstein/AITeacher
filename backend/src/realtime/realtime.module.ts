import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { MediaStreamModule } from '../media-stream/media-stream.module';

@Module({
  imports: [MediaStreamModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
