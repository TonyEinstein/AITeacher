import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';

@Module({
  controllers: [SurveysController],
  providers: [SurveysService],
})
export class SurveysModule {}