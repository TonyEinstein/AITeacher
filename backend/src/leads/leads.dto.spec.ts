import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerGuard, ThrottlerStorageService } from '@nestjs/throttler';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

/**
 * @nestjs/throttler 未公开导出元数据键常量，此处按 6.x 的约定字面量读取
 * （decorator 内部写入 'THROTTLER:LIMIT' + name / 'THROTTLER:TTL' + name）。
 */
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';

/**
 * 与 main.ts 中挂载的全局管道保持同参：whitelist 剥离未声明字段，transform 产出 DTO 实例。
 */
const pipe = new ValidationPipe({ whitelist: true, transform: true });

/** 以 controller 方法为元数据来源校验 body（metatype 取 handler 的 @Body 类型） */
const BODY_META = {
  type: 'body' as const,
  metatype: CreateLeadDto,
  data: undefined,
};

function validateBody(body: unknown): Promise<CreateLeadDto> {
  return pipe.transform(body, BODY_META as any);
}

const VALID = {
  company: '示例中学',
  name: '张老师',
  phone: '13800138000',
};

describe('CreateLeadDto · 官网留资校验', () => {
  it('合法提交通过，并返回 DTO 实例', async () => {
    const dto = await validateBody({ ...VALID });
    expect(dto).toBeInstanceOf(CreateLeadDto);
    expect(dto.company).toBe('示例中学');
    expect(dto.name).toBe('张老师');
    expect(dto.phone).toBe('13800138000');
  });

  it('合法提交携带可选 message 时通过', async () => {
    const dto = await validateBody({ ...VALID, message: '想了解毕业班方案' });
    expect(dto.message).toBe('想了解毕业班方案');
  });

  it('空 body（三个必填字段缺失）被拒 400', async () => {
    await expect(validateBody({})).rejects.toThrow(BadRequestException);
  });

  it('超长 company（121 字）被拒 400', async () => {
    await expect(validateBody({ ...VALID, company: '长'.repeat(121) })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('超长 name（41 字）被拒 400', async () => {
    await expect(validateBody({ ...VALID, name: '名'.repeat(41) })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('超长 message（501 字）被拒 400', async () => {
    await expect(validateBody({ ...VALID, message: 'x'.repeat(501) })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('非法 phone（含字母）被拒 400', async () => {
    await expect(validateBody({ ...VALID, phone: 'abc12345' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('电话过短（5 位）被拒 400', async () => {
    await expect(validateBody({ ...VALID, phone: '12345' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('电话支持 空格/-/+ 格式', async () => {
    const dto = await validateBody({ ...VALID, phone: '+86 138-0013-8000' });
    expect(dto.phone).toBe('+86 138-0013-8000');
  });

  it('纯符号电话（数字不足 5 位）被拒 400', async () => {
    // 长度 6 但只有 1 位数字：旧正则 /^[\d\-+ ]{6,25}$/ 会误放行
    await expect(validateBody({ ...VALID, phone: ' - + 1' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('纯空格电话被拒 400', async () => {
    await expect(validateBody({ ...VALID, phone: '      ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('数字位数足够但被符号分隔时通过（保持既有合法输入兼容）', async () => {
    const dto = await validateBody({ ...VALID, phone: '  12345  ' });
    expect(dto.phone).toBe('  12345  ');
  });

  it('name 为非字符串（数字）被拒 400（@IsString 与 company 对称）', async () => {
    await expect(validateBody({ ...VALID, name: 123 })).rejects.toThrow(BadRequestException);
  });

  it('whitelist 剥离未声明的 shareSnapshotId 字段（防止表单接口越权写入快照关联）', async () => {
    const dto = await validateBody({ ...VALID, shareSnapshotId: 1 });
    expect(dto).not.toHaveProperty('shareSnapshotId');
  });

  it('空字符串 message 通过（可选字段）', async () => {
    const dto = await validateBody({ ...VALID, message: '' });
    expect(dto.message).toBe('');
  });
});

describe('LeadsController · 公开留资落库', () => {
  function makeController() {
    const captured: any[] = [];
    const prisma = {
      lead: {
        create: async (args: any) => {
          captured.push(args);
          return { id: 1, ...args.data };
        },
      },
    };
    const service = new LeadsService(prisma as any);
    return { controller: new LeadsController(service), captured };
  }

  it('合法 DTO 落库：message 缺省时写 null，且不写入 shareSnapshotId', async () => {
    const { controller, captured } = makeController();
    await controller.createPublic({ ...VALID } as CreateLeadDto);
    expect(captured).toHaveLength(1);
    expect(captured[0].data).toEqual({
      name: '张老师',
      phone: '13800138000',
      company: '示例中学',
      message: null,
    });
    expect(captured[0].data).not.toHaveProperty('shareSnapshotId');
  });
});

describe('LeadsController · 公开接口限流声明', () => {
  it('@Post(public) 声明每 IP 每分钟 5 次（覆盖全局 60 次兜底）', () => {
    const handler = LeadsController.prototype.createPublic;
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBe(5);
    expect(Reflect.getMetadata(THROTTLER_TTL + 'default', handler)).toBe(60_000);
  });

  it('第 6 次连发触发 429（路由 @Throttle 覆盖全局 60 次兜底）', async () => {
    const storage = new ThrottlerStorageService();
    // 模块级配置刻意用全局兜底值 60：若路由装饰器失效，前 6 次都应放行
    const guard = new ThrottlerGuard(
      [{ name: 'default', ttl: 60_000, limit: 60 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();

    const ctx = {
      getHandler: () => LeadsController.prototype.createPublic,
      getClass: () => LeadsController,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '10.0.0.9', headers: {} }),
        getResponse: () => ({ header: () => undefined }),
      }),
    } as any;

    for (let i = 0; i < 5; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ThrottlerException);
    storage.onApplicationShutdown();
  });

  it('两个不同 IP 各自独立计数（第二个 IP 不受第一个 IP 用尽额度影响）', async () => {
    const storage = new ThrottlerStorageService();
    const guard = new ThrottlerGuard(
      [{ name: 'default', ttl: 60_000, limit: 5 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();

    const ctxFor = (ip: string) =>
      ({
        getHandler: () => LeadsController.prototype.createPublic,
        getClass: () => LeadsController,
        switchToHttp: () => ({
          getRequest: () => ({ ip, headers: {} }),
          getResponse: () => ({ header: () => undefined }),
        }),
      }) as any;

    // 访客 A 用尽 5 次
    for (let i = 0; i < 5; i++) {
      await expect(guard.canActivate(ctxFor('198.51.100.1'))).resolves.toBe(true);
    }
    // 访客 B 仍有完整额度——若 tracker 退化为同一桶，此处会抛 429
    await expect(guard.canActivate(ctxFor('198.51.100.2'))).resolves.toBe(true);
    storage.onApplicationShutdown();
  });
});
