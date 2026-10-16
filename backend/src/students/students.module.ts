import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentsPublicController } from './students-public.controller';

@Module({
  controllers: [StudentsPublicController, StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}