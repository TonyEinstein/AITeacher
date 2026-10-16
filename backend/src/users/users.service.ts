import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

// 允许写入用户表的白名单字段，避免直接 spread body 引入越权字段
const ALLOWED_FIELDS = ['name', 'username', 'role', 'schoolId', 'gradeId', 'subjectId', 'password', 'email', 'phone', 'status'];

function pickAllowed(data: any): any {
  const out: any = {};
  for (const k of ALLOWED_FIELDS) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: any, requester?: any) {
    const payload = pickAllowed(data);

    // school_admin 创建用户时强制归属本校，不能跨校建号
    if (requester && requester.role !== 'super_admin') {
      if (!requester.schoolId) throw new ForbiddenException('当前角色无法创建用户');
      payload.schoolId = Number(requester.schoolId);
      // school_admin 不能授予高于自己的角色（仅允许 teacher 及以下）
      if (payload.role && !['teacher', 'subject_admin', 'grade_admin', 'school_admin'].includes(payload.role)) {
        delete payload.role;
      }
    }

    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    } else {
      payload.password = await bcrypt.hash('123456', 10);
    }
    return this.prisma.user.create({ data: payload });
  }

  findBySchool(schoolId: number) {
    return this.prisma.user.findMany({
      where: { schoolId },
      select: { id: true, username: true, name: true, role: true, email: true, phone: true, status: true, schoolId: true },
    });
  }

  // super_admin 查看全部用户
  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, email: true, phone: true, status: true, schoolId: true, gradeId: true, subjectId: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, requester?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, name: true, role: true, email: true, phone: true, schoolId: true, status: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    // school_admin 只能查本校用户
    if (requester && requester.role !== 'super_admin') {
      if (!requester.schoolId || user.schoolId !== Number(requester.schoolId)) {
        throw new ForbiddenException('无权查看其他学校用户');
      }
    }
    return user;
  }

  async update(id: number, data: any, requester?: any) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');

    const payload = pickAllowed(data);

    // school_admin 不能改其他学校用户
    if (requester && requester.role !== 'super_admin') {
      if (!requester.schoolId || existing.schoolId !== Number(requester.schoolId)) {
        throw new ForbiddenException('无权修改其他学校用户');
      }
      // 不能跨校调整用户归属
      if (payload.schoolId !== undefined) delete payload.schoolId;
      // 不能提权（修改 role）
      if (payload.role !== undefined) delete payload.role;
    }

    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }

    return this.prisma.user.update({ where: { id }, data: payload });
  }

  async remove(id: number, requester?: any) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');
    if (requester && requester.role !== 'super_admin') {
      if (!requester.schoolId || existing.schoolId !== Number(requester.schoolId)) {
        throw new ForbiddenException('无权删除其他学校用户');
      }
    }
    return this.prisma.user.delete({ where: { id } });
  }
}
