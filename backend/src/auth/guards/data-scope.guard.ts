import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 数据边界守卫（按文档 8.7 权限模型 / 实施方案 1.2.05）
 * 规则：
 *  - super_admin 不受限（全量数据）
 *  - 其他角色只能访问自己学校（schoolId）范围内的数据；
 *    请求中的 schoolId / classId / gradeId / studentId / roomId / boxId / serial 只要带学校归属，
 *    一律解析校验，归属其他学校 → 403。
 *  - 无登录态（公开接口）直接放行；无学校归属的角色暂不校验。
 */
@Injectable()
export class DataScopeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // 公开接口
    if (user.role === 'super_admin') return true;
    if (!user.schoolId) return true;

    const { params = {}, query = {}, body = {} } = req;
    const mine = Number(user.schoolId);

    const forbid = () => {
      throw new ForbiddenException('数据越权：无权访问其他学校的数据');
    };

    const schoolId = params.schoolId ?? query.schoolId ?? body.schoolId;
    if (schoolId !== undefined && Number(schoolId) !== mine) forbid();

    const classId = params.classId ?? query.classId ?? body.classId;
    if (classId !== undefined) {
      const cls = await this.prisma.class.findUnique({
        where: { id: Number(classId) },
        select: { grade: { select: { schoolId: true } } },
      });
      if (cls && cls.grade.schoolId !== mine) forbid();
    }

    const gradeId = params.gradeId ?? query.gradeId ?? body.gradeId;
    if (gradeId !== undefined) {
      const g = await this.prisma.grade.findUnique({
        where: { id: Number(gradeId) },
        select: { schoolId: true },
      });
      if (g && g.schoolId !== mine) forbid();
    }

    const studentId = params.studentId ?? query.studentId ?? body.studentId;
    if (studentId !== undefined) {
      const st = await this.prisma.student.findUnique({
        where: { id: Number(studentId) },
        select: { class: { select: { grade: { select: { schoolId: true } } } } },
      });
      if (st && st.class?.grade?.schoolId !== mine) forbid();
    }

    const roomId = params.roomId ?? query.roomId ?? body.roomId;
    if (roomId !== undefined) {
      const room = await this.prisma.room.findUnique({
        where: { id: Number(roomId) },
        select: { schoolId: true },
      });
      if (room && room.schoolId !== mine) forbid();
    }

    const boxId = params.boxId ?? query.boxId ?? body.boxId;
    if (boxId !== undefined) {
      const box = await this.prisma.box.findUnique({
        where: { id: Number(boxId) },
        select: { schoolId: true },
      });
      if (box && box.schoolId !== mine) forbid();
    }

    // 设备序列号（GET /boxes/:serial 等）
    const serial = params.serial;
    if (serial !== undefined) {
      const box = await this.prisma.box.findUnique({
        where: { serialNumber: String(serial) },
        select: { schoolId: true },
      });
      if (box && box.schoolId !== mine) forbid();
    }

    return true;
  }
}
