import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WechatService {
  private readonly logger = new Logger('WechatService');
  private accessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private httpService: HttpService,
  ) {}

  // 微信小程序登录：code 换 openid
  async miniprogramLogin(code: string) {
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;

    if (!appid || !secret) {
      // 开发环境：直接返回测试 token
      const testParent = await this.prisma.parent.findFirst();
      if (testParent) {
        const payload = { sub: testParent.id, role: 'parent', openid: testParent.openId };
        return {
          access_token: this.jwtService.sign(payload),
          isBound: true,
          parent: testParent,
        };
      }
      return { access_token: 'dev_token', isBound: false };
    }

    const url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + appid + '&secret=' + secret + '&js_code=' + code + '&grant_type=authorization_code';
    const res = await firstValueFrom(this.httpService.get(url));
    const { openid, session_key } = res.data;

    if (!openid) {
      throw new UnauthorizedException('微信登录失败');
    }

    // 查找或创建家长
    let parent = await this.prisma.parent.findUnique({ where: { openId: openid } });
    const isBound = !!parent;

    if (!parent) {
      parent = await this.prisma.parent.create({
        data: { openId: openid, studentId: 0 },
      });
    }

    const payload = { sub: parent.id, role: 'parent', openid };
    return {
      access_token: this.jwtService.sign(payload),
      isBound,
      parent,
    };
  }

  /**
   * 获取微信 access_token（带缓存，提前5分钟刷新）
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > now) {
      return this.accessTokenCache.token;
    }
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) {
      throw new Error('未配置 WX_APPID / WX_SECRET，无法发送订阅消息');
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
    const res = await firstValueFrom(this.httpService.get(url));
    const { access_token, expires_in } = res.data;
    if (!access_token) {
      throw new Error(`获取 access_token 失败: ${JSON.stringify(res.data)}`);
    }
    this.accessTokenCache = {
      token: access_token,
      expiresAt: now + (expires_in - 300) * 1000, // 提前5分钟过期
    };
    return access_token;
  }

  /**
   * 发送微信订阅消息
   * @param openid 接收者 openid
   * @param templateId 模板ID
   * @param data 模板数据 { key1: { value: 'xxx' }, ... }
   * @param page 点击跳转的小程序页面
   */
  async sendSubscribeMessage(
    openid: string,
    templateId: string,
    data: Record<string, { value: string }>,
    page?: string,
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
      const body = {
        touser: openid,
        template_id: templateId,
        page: page || 'pages/index/index',
        miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'trial',
        lang: 'zh_CN',
        data,
      };
      const res = await firstValueFrom(this.httpService.post(url, body));
      if (res.data.errcode === 0) {
        this.logger.log(`订阅消息发送成功 -> ${openid}`);
        return true;
      }
      this.logger.warn(`订阅消息发送失败: ${JSON.stringify(res.data)} -> ${openid}`);
      return false;
    } catch (e: any) {
      this.logger.error(`订阅消息异常: ${e?.message}`);
      return false;
    }
  }

  /**
   * 作业下发通知（推送给学生/家长）
   */
  async notifyHomework(studentId: number, title: string, subject: string, deadline: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { parents: true },
    });
    if (!student || student.parents.length === 0) return false;
    const templateId = process.env.WX_TEMPLATE_HOMEWORK;
    if (!templateId) {
      this.logger.warn('未配置 WX_TEMPLATE_HOMEWORK，跳过作业通知');
      return false;
    }
    const results = await Promise.all(
      student.parents.map(p =>
        this.sendSubscribeMessage(
          p.openId,
          templateId,
          {
            thing1: { value: title.slice(0, 20) },
            thing2: { value: subject },
            date3: { value: deadline },
            thing4: { value: student.name },
          },
          'pages/homework/homework',
        ),
      ),
    );
    return results.some(r => r);
  }
}