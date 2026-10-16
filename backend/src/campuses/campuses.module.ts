import { Module } from '@nestjs/common';
import { CampusesService } from './campuses.service';
import { CampusesController } from './campuses.controller';

@Module({
  controllers: [CampusesController],
  providers: [CampusesService],
})
export class CampusesModule {}