import { Module } from '@nestjs/common';
import { WearableGateway } from './wearable.gateway';
import { TutoringModule } from '../tutoring/tutoring.module';

@Module({
  imports: [TutoringModule],
  providers: [WearableGateway],
})
export class WearableModule {}