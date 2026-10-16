import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SiteConfigService {
  constructor(private prisma: PrismaService) {}

  /** 官网公开配置（单行 id=1，不存在时返回默认结构） */
  async getPublic() {
    const row = await this.prisma.siteConfig.findFirst({ orderBy: { id: 'asc' } });
    if (!row) {
      return {
        icpNo: '',
        contactPhone: '400-000-0000（示意，上线前替换）',
        workHours: '周一至周五 9:00–18:00',
        wechatName: 'AI Teacher',
        qrCodeUrl: '',
        schoolsCount: '10+',
        studentsCount: '5,000+',
        costSave: '60%',
      };
    }
    return row;
  }

  /** 管理端读取（super_admin） */
  async get() {
    return this.prisma.siteConfig.findFirst({ orderBy: { id: 'asc' } });
  }

  /** 管理端更新（super_admin），单行 upsert */
  async update(body: any) {
    const data: any = {};
    const fields = ['icpNo', 'contactPhone', 'workHours', 'wechatName', 'qrCodeUrl', 'schoolsCount', 'studentsCount', 'costSave'] as const;
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f] === '' ? null : String(body[f]);
    }
    const existing = await this.prisma.siteConfig.findFirst({ orderBy: { id: 'asc' } });
    if (!existing) {
      return this.prisma.siteConfig.create({ data });
    }
    return this.prisma.siteConfig.update({ where: { id: existing.id }, data });
  }
}
