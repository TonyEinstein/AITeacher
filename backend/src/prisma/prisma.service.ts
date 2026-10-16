import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 启用软删除的模型（PRD §21.2）
 *
 * 约定：这些表带 deletedAt 字段；findMany/findFirst/count 聚合查询自动过滤
 * 已删除行；delete 调用转为「写 deletedAt」。需要查已删除数据时用
 * prisma.<model>.findFirst({ where: { deletedAt: { not: null } } }) 绕不过——
 * 如确需物理删除/查回收站，用 $queryRaw 或显式 unsetSoftDelete 中间件键。
 */
const SOFT_DELETE_MODELS = [
  'student',
  'class',
  'schedule',
  'assignment',
  'box',
  'lessonPlan',
] as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ 数据库连接成功');
  }

  constructor() {
    super();

    // 软删除查询过滤 + delete 改写为 update deletedAt
    // （用 $extends 无法在实例自身上替换，这里用 $use 旧式中间件，行为等价）
    this.$use(async (params, next) => {
      const model = params.model ? (params.model.charAt(0).toLowerCase() + params.model.slice(1)) : null;
      if (model && (SOFT_DELETE_MODELS as readonly string[]).includes(model)) {
        if (params.action === 'delete') {
          // 物理删除 → 软删除（保留原 where，只替换 data 与 action）
          params.action = 'update';
          params.args = { ...(params.args ?? {}), data: { deletedAt: new Date() } };
          return next(params);
        }
        if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          params.args = { ...(params.args ?? {}), data: { deletedAt: new Date() } };
          return next(params);
        }
        if (['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
          // 查询自动过滤已删除行；调用方显式传了 deletedAt 条件则以调用方为准
          const where = params.args?.where ?? {};
          if (!('deletedAt' in where)) {
            params.args = { ...params.args, where: { ...where, deletedAt: null } };
          }
        }
        // update/updateMany 不拦截：允许显式把 deletedAt 置回 null（恢复）
      }
      return next(params);
    });
  }
}
