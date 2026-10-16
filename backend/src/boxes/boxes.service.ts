import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BoxesService {
  constructor(private prisma: PrismaService) {}

  // school_admin 只能注册本校设备
  async register(data: { serialNumber: string; schoolId: number; type?: string }, requester?: any) {
    let schoolId = data.schoolId;
    if (requester && requester.role !== 'super_admin') {
      if (!requester.schoolId) throw new UnauthorizedException('无权注册设备');
      schoolId = Number(requester.schoolId);
    }
    const deviceToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const box = await this.prisma.box.create({
      data: {
        serialNumber: data.serialNumber,
        schoolId,
        type: data.type || 'classroom',
        status: 'offline',
        deviceToken,
      },
    });
    // 返回 deviceToken 给设备端保存，后续心跳使用
    return { ...box, deviceToken };
  }

  // 心跳上报（可携带故障信息：设备端检测到异常时上报 faultCode / faultMessage）
  async heartbeat(serialNumber: string, deviceToken: string | undefined, faultCode?: string, faultMessage?: string) {
    const box = await this.prisma.box.findUnique({ where: { serialNumber } });
    if (!box) throw new UnauthorizedException('设备未注册');
    // 校验设备 token（设备端无 JWT，用注册时下发的 deviceToken 鉴权）
    if (!box.deviceToken || deviceToken !== box.deviceToken) {
      throw new UnauthorizedException('设备令牌无效');
    }
    if (faultCode) {
      // 上报故障：设备进入 error 状态
      return this.prisma.box.update({
        where: { id: box.id },
        data: { status: 'error', lastHeartbeat: new Date(), faultCode, faultMessage: faultMessage || null, lastErrorAt: new Date() },
      });
    }
    // 正常心跳：恢复在线并清除故障状态
    return this.prisma.box.update({
      where: { id: box.id },
      data: { status: 'online', lastHeartbeat: new Date(), faultCode: null, faultMessage: null, lastErrorAt: null },
    });
  }

  // 公司级设备总览（超级管理员）：跨学校查看所有设备及故障信息
  async findAll(filter: { page?: number; pageSize?: number; schoolId?: number; status?: string; faultOnly?: boolean } = {}) {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 50;
    const where: any = {};
    if (filter.schoolId) where.schoolId = Number(filter.schoolId);
    if (filter.status) where.status = filter.status;
    if (filter.faultOnly) where.status = 'error';

    const [list, total] = await Promise.all([
      this.prisma.box.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          room: true,
          school: { select: { id: true, name: true, code: true, status: true } },
          devices: true,
        },
      }),
      this.prisma.box.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  // 本校设备列表（分页）
  async findBySchool(schoolId: number, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.box.findMany({
        where: { schoolId },
        skip,
        take: pageSize,
        include: {
          room: true,
          school: { select: { id: true, name: true, code: true, status: true } },
          devices: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.box.count({ where: { schoolId } }),
    ]);
    return { list, total, page, pageSize };
  }

  findBySerial(serialNumber: string) {
    return this.prisma.box.findUnique({
      where: { serialNumber },
      include: { room: true, school: true, devices: true },
    });
  }

  assignRoom(id: number, roomId: number) {
    return this.prisma.box.update({ where: { id }, data: { roomId } });
  }

  update(id: number, data: any) {
    return this.prisma.box.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.box.delete({ where: { id } });
  }

  /**
   * OTA：盒子查询最新版本
   *
   * 版本来源（按优先级）：
   * 1. OtaRelease 表最新记录（管理端发布/回滚产生，可按灰度分组区分 canary/stable）
   * 2. 环境变量 OTA_VERSION / OTA_PACKAGE_URL / OTA_CHECKSUM（兜底，老部署方式）
   *
   * 若盒子已是最新版本则返回空（packageUrl 为空，脚本不升级）。
   */
  async getLatestOta(serial: string) {
    const box = await this.prisma.box.findUnique({ where: { serialNumber: serial } });
    const current = box?.firmwareVersion || '';
    // 灰度分组：canary 的盒子拿 canary 通道版本，其余拿 stable
    const channel = box?.otaGroup === 'canary' ? 'canary' : 'stable';

    const release = await this.prisma.otaRelease.findFirst({
      where: { channel, action: { in: ['release', 'rollback'] } },
      orderBy: { createdAt: 'desc' },
    });

    let latestVersion = release?.version || process.env.OTA_VERSION || '';
    let packageUrl = release?.packageUrl || process.env.OTA_PACKAGE_URL || '';
    const checksum = release?.checksum || process.env.OTA_CHECKSUM || '';

    // 回滚记录：目标是「回到某旧版本」——packageUrl 必须用被回滚版本的包；
    // 简化处理：回滚记录创建时要求填 packageUrl（即旧版本包地址）
    if (release?.action === 'rollback') {
      latestVersion = release.rollbackToVersion || release.version;
      packageUrl = release.packageUrl;
    }

    if (!latestVersion || !packageUrl || current === latestVersion) {
      return { version: latestVersion, packageUrl: '', checksum: '', current, upToDate: true, channel };
    }
    return { version: latestVersion, packageUrl, checksum, current, upToDate: false, channel };
  }

  // OTA：盒子上报升级结果
  async reportOta(serial: string, version: string, status: string) {
    if (status === 'success') {
      await this.prisma.box.updateMany({
        where: { serialNumber: serial },
        data: { firmwareVersion: version },
      });
    }
    return { received: true, serial, version, status };
  }

  // ============ OTA 灰度发布与回滚（PRD §4.4.1）============

  /** 发布新版本到指定通道（canary 灰度 / stable 正式） */
  async publishRelease(input: {
    version: string;
    packageUrl: string;
    checksum?: string;
    channel: 'canary' | 'stable';
    note?: string;
    createdBy?: number;
  }) {
    const release = await this.prisma.otaRelease.create({
      data: {
        version: input.version,
        packageUrl: input.packageUrl,
        checksum: input.checksum,
        channel: input.channel,
        action: 'release',
        note: input.note,
        createdBy: input.createdBy,
      },
    });
    return { release, message: `版本 ${input.version} 已发布到 ${input.channel} 通道` };
  }

  /** 回滚指定通道到旧版本（创建 rollback 记录，盒子下次拉取即回退） */
  async rollbackRelease(input: {
    channel: 'canary' | 'stable';
    rollbackToVersion: string;
    packageUrl: string;
    checksum?: string;
    note?: string;
    createdBy?: number;
  }) {
    const release = await this.prisma.otaRelease.create({
      data: {
        version: input.rollbackToVersion,
        packageUrl: input.packageUrl,
        checksum: input.checksum,
        channel: input.channel,
        action: 'rollback',
        rollbackToVersion: input.rollbackToVersion,
        note: input.note,
        createdBy: input.createdBy,
      },
    });
    return { release, message: `${input.channel} 通道已回滚到 ${input.rollbackToVersion}` };
  }

  /** 设置盒子灰度分组 */
  async setOtaGroup(boxId: number, group: 'canary' | 'stable') {
    return this.prisma.box.update({
      where: { id: boxId },
      data: { otaGroup: group },
      select: { id: true, serialNumber: true, otaGroup: true },
    });
  }

  /** 发布历史（回滚溯源） */
  listReleases(channel?: 'canary' | 'stable') {
    return this.prisma.otaRelease.findMany({
      where: channel ? { channel } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
