import { Module } from '@nestjs/common';
import { ParentMessagesService } from './parent-messages.service';
import { ParentMessagesController } from './parent-messages.controller';

@Module({
  controllers: [ParentMessagesController],
  providers: [ParentMessagesService],
})
export class ParentMessagesModule {}
