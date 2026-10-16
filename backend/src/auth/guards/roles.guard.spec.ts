import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { SchoolsController } from '../../schools/schools.controller';
import { LeadsController } from '../../leads/leads.controller';
import { SiteConfigController } from '../../site-config/site-config.controller';
import { StudentsController } from '../../students/students.controller';
import { SchedulesController } from '../../schedules/schedules.controller';
import { CampusesController } from '../../campuses/campuses.controller';

const guard = new RolesGuard(new Reflector());

/** 构造最小 ExecutionContext：只提供 RolesGuard 用到的部分 */
function ctx(role: string | null, handler: any, cls: any) {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => (role ? { user: { role } } : {}) }),
  } as any;
}

/** 期望放行 */
function allow(role: string, handler: any, cls: any) {
  return guard.canActivate(ctx(role, handler, cls));
}

/** 期望拒绝，返回错误信息 */
function deny(role: string, handler: any, cls: any) {
  try {
    guard.canActivate(ctx(role, handler, cls));
    return null;
  } catch (e: any) {
    return e;
  }
}

describe('RolesGuard · 平台级接口（仅 super_admin）', () => {
  const cases: Array<[string, any, any]> = [
    ['学校-新建', SchoolsController.prototype.create, SchoolsController],
    ['学校-列表', SchoolsController.prototype.findAll, SchoolsController],
    ['咨询留资-列表', LeadsController.prototype.findAll, LeadsController],
    ['官网设置-读取', SiteConfigController.prototype.get, SiteConfigController],
  ];

  for (const [name, handler, cls] of cases) {
    it(`${name}：super_admin 放行`, () => {
      expect(allow('super_admin', handler, cls)).toBe(true);
    });

    it(`${name}：group_admin 被拒绝（不得越权到平台级）`, () => {
      const err = deny('group_admin', handler, cls);
      expect(err).toBeInstanceOf(ForbiddenException);
    });

    it(`${name}：school_admin 被拒绝`, () => {
      expect(deny('school_admin', handler, cls)).toBeInstanceOf(ForbiddenException);
    });
  }
});

describe('RolesGuard · 校内接口（school_admin 同级）', () => {
  it('group_admin 可访问学生管理', () => {
    expect(allow('group_admin', StudentsController.prototype.findByClass, StudentsController)).toBe(true);
  });

  it('group_admin 可访问调课（整体顺延）', () => {
    expect(allow('group_admin', SchedulesController.prototype.postpone, SchedulesController)).toBe(true);
  });

  it('group_admin 可访问校区汇总', () => {
    expect(allow('group_admin', CampusesController.prototype.groupOverview, CampusesController)).toBe(true);
  });

  it('school_admin 同样可访问', () => {
    expect(allow('school_admin', StudentsController.prototype.findByClass, StudentsController)).toBe(true);
  });

  it('teacher 不可访问学生管理', () => {
    expect(deny('teacher', StudentsController.prototype.findByClass, StudentsController)).toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('grade_admin 不可访问学生管理（校内接口只到 school_admin 级）', () => {
    expect(deny('grade_admin', StudentsController.prototype.findByClass, StudentsController)).toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('RolesGuard · 边界', () => {
  it('未声明 @Roles 的处理器一律放行', () => {
    const bare = { getHandler: () => function bareHandler() {}, getClass: () => class Bare {} } as any;
    expect(guard.canActivate(bare)).toBe(true);
  });

  it('缺少 user 时抛 ForbiddenException 而不是放行', () => {
    const c = ctx(null, StudentsController.prototype.findByClass, StudentsController);
    expect(() => guard.canActivate(c)).toThrow(ForbiddenException);
  });

  it('group_admin 不再被自动提权为 super_admin（回归）', () => {
    // 若恢复旧的自动提权实现，本用例会失败
    expect(deny('group_admin', SchoolsController.prototype.create, SchoolsController)).toBeInstanceOf(
      ForbiddenException,
    );
  });
});
