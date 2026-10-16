import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // 启动时校验关键环境变量
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('环境变量 JWT_SECRET 缺失或长度不足 32，请在 .env 中配置强随机密钥');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 全局拦截器：统一响应格式
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter());

  // 参数校验
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  // 信任一层反向代理（生产 H5 经 nginx proxy_pass 到本服务）：
  // 未开启时 req.ip 恒为 nginx 容器 IP，限流会退化为全站共享桶。
  // 只信任一跳（勿用 true）；后端仅在内网暴露，不可被直连伪造 X-Forwarded-For。
  app.set('trust proxy', 1);

  // 跨域白名单
  app.enableCors({
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5175').split(','),
    credentials: true,
  });

  // Swagger API 文档（生产环境不暴露）
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AI Teacher API')
      .setDescription('AI Teacher 智能教学系统接口文档')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log('🚀 后端服务启动成功: http://localhost:' + port + '/api/v1');
  if (process.env.NODE_ENV !== 'production') {
    console.log('📖 API 文档: http://localhost:' + port + '/api/docs');
  }
}
bootstrap();
