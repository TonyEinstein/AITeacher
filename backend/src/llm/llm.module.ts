import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LlmService } from './llm.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
