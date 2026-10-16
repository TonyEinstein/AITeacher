import { Module } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { RankingsController } from './rankings.controller';

@Module({
  controllers: [RankingsController],
  providers: [RankingsService],
})
export class RankingsModule {}