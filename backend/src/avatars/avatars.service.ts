import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvatarsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId?: number) {
    return this.prisma.digitalAvatar.findMany({
      where: {
        status: 'active',
        OR: [{ isCustom: false }, ...(schoolId ? [{ schoolId, isCustom: true }] : [])],
      },
    });
  }

  create(data: any) {
    return this.prisma.digitalAvatar.create({ data });
  }

  async update(id: number, data: any) {
    const avatar = await this.prisma.digitalAvatar.findUnique({ where: { id } });
    if (!avatar) throw new NotFoundException('形象不存在');
    return this.prisma.digitalAvatar.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.digitalAvatar.delete({ where: { id } });
  }

  // 学校定制数字人（另收费）
  async createCustom(schoolId: number, data: any) {
    return this.prisma.digitalAvatar.create({
      data: { ...data, schoolId, isCustom: true },
    });
  }
}