import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { WechatService } from './wechat.service';

@Controller('wechat')
export class WechatController {
  constructor(private wechatService: WechatService) {}

  @Post('miniprogram-login')
  @HttpCode(200)
  login(@Body('code') code: string) {
    return this.wechatService.miniprogramLogin(code);
  }
}