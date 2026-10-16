import { Module } from '@nestjs/common';
import { FaceLibraryService } from './face-library.service';
import { FaceLibraryController } from './face-library.controller';

@Module({
  controllers: [FaceLibraryController],
  providers: [FaceLibraryService],
  exports: [FaceLibraryService],
})
export class FaceLibraryModule {}
