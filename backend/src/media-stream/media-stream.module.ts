import { Module } from '@nestjs/common';
import { MediaStreamService } from './media-stream.service';

@Module({
  providers: [MediaStreamService],
  exports: [MediaStreamService],
})
export class MediaStreamModule {}
