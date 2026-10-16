import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { DATA_SCOPE_KEY, DataScopeType } from '../decorators/data-scope.decorator';

@Injectable()
export class DataScopeInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const scope = this.reflector.getAllAndOverride<DataScopeType>(DATA_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!scope) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 把数据范围信息放到 request 上，供 service 层使用
    request.dataScope = {
      type: scope,
      schoolId: user?.schoolId,
      userId: user?.id,
      role: user?.role,
    };

    return next.handle();
  }
}
