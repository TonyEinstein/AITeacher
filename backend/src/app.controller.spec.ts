import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        // AppController 依赖 PrismaService（健康检查用），此处用桩替代，避免测试连库
        {
          provide: PrismaService,
          useValue: { $queryRaw: async () => [{ ok: 1 }] },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('返回服务标识文案', () => {
      expect(appController.getHello()).toBe('Hello AI Teacher!');
    });
  });

  describe('health', () => {
    it('数据库可用时返回 healthy', async () => {
      const res = await appController.health();
      expect(res.status).toBe('healthy');
      expect(res.checks.database).toBe('ok');
    });

    it('数据库不可用时返回 degraded 而不是抛错', async () => {
      const app: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: PrismaService,
            useValue: {
              $queryRaw: async () => {
                throw new Error('connection refused');
              },
            },
          },
        ],
      }).compile();
      const res = await app.get(AppController).health();
      expect(res.status).toBe('degraded');
      expect(res.checks.database).toBe('error');
    });
  });
});
