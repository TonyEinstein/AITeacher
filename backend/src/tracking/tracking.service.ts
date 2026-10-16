import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  async create(body: any) {
    const meta: any = {};
    // 只收容白名单字段，避免任意写库
    const allowedMeta = ['company'];
    for (const k of allowedMeta) {
      if (body.meta && body.meta[k] !== undefined) meta[k] = String(body.meta[k]);
    }
    return this.prisma.trackingEvent.create({
      data: {
        event: String(body.event || 'pageview').slice(0, 50),
        page: body.page ? String(body.page).slice(0, 200) : null,
        referrer: body.referrer ? String(body.referrer).slice(0, 500) : null,
        utmSource: body.utmSource ? String(body.utmSource).slice(0, 100) : null,
        utmMedium: body.utmMedium ? String(body.utmMedium).slice(0, 100) : null,
        utmCampaign: body.utmCampaign ? String(body.utmCampaign).slice(0, 100) : null,
        meta: Object.keys(meta).length ? meta : undefined,
      },
    });
  }
}
