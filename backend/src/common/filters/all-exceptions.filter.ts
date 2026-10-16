import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 5000;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = typeof res === 'string' ? res : res.message || exception.message;

      // 根据 HTTP 状态码映射错误码
      if (status === 400) code = 1001;
      else if (status === 401) code = 2001;
      else if (status === 403) code = 2003;
      else if (status === 404) code = 1002;
      else if (status === 409) code = 1003;
      else if (status === 429) code = 2004;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma 已知错误
      if (exception.code === 'P2025') {
        // 记录不存在或已被删除
        status = HttpStatus.NOT_FOUND;
        code = 1002;
        message = '记录不存在或已被删除';
      } else if (exception.code === 'P2002') {
        // 唯一约束冲突：不返回 target 字段名，避免泄露表结构
        status = HttpStatus.CONFLICT;
        code = 1003;
        message = '数据已存在，请勿重复提交';
      }
    }

    // 未预期的异常打印到日志，便于排查
    if (status >= 500) {
      console.error('[Unhandled Exception]', exception);
    }

    response.status(status).json({
      code: code,
      data: null,
      message: message,
    });
  }
}
