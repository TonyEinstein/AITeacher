import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PreferencesService {
  constructor(private prisma: PrismaService) {}

  async get(studentId: number) {
    let pref = await this.prisma.studentPreference.findUnique({ where: { id: studentId } });
    if (!pref) {
      pref = await this.prisma.studentPreference.create({
        data: { studentId, style: 'gentle', speed: 'normal', myopiaReminder: true },
      });
    }
    return pref;
  }

  async update(studentId: number, data: { style?: string; speed?: string; myopiaReminder?: boolean }) {
    const existing = await this.prisma.studentPreference.findFirst({ where: { studentId } });
    if (existing) {
      return this.prisma.studentPreference.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.studentPreference.create({
      data: { studentId, ...data },
    });
  }
}
