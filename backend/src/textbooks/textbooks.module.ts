import { Module } from '@nestjs/common';
import { TextbooksService } from './textbooks.service';
import { TextbooksController } from './textbooks.controller';

@Module({
  controllers: [TextbooksController],
  providers: [TextbooksService],
})
export class TextbooksModule {}