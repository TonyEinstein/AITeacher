import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { WechatService } from './wechat.service';
import { WechatController } from './wechat.controller';
import { ParentsModule } from '../parents/parents.module';

@Module({
  imports: [
    ParentsModule,
    HttpModule,
    JwtModule.register({
      // JWT_SECRET 已由 main.ts 启动校验强制存在（≥32 位），此处不设弱默认值——
      // 开源后硬编码兜底等于公开伪造 token 的钥匙
      secret: process.env.JWT_SECRET as string,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [WechatController],
  providers: [WechatService],
  exports: [WechatService],
})
export class WechatModule {}
