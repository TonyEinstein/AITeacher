import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VisionController } from './vision.controller';
import { VisionService } from './vision.service';

@Module({
  imports: [PrismaModule],
  controllers: [VisionController],
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}
