import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { DataScopeGuard } from './data-scope.guard';

/**
 * JWT 鉴权守卫（自定义实现，不依赖 passport 的跨模块 DI）
 * 从 Authorization: Bearer <token> 解析并校验 JWT，
 * 校验通过后把完整用户对象挂到 req.user，随后执行数据边界校验（DataScopeGuard），
 * 供 RolesGuard / 业务接口使用。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly dataScopeGuard: DataScopeGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('未登录或登录已过期');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (e) {
      throw new UnauthorizedException('登录令牌无效或已过期');
    }

    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }
    request.user = user;
    // 数据边界校验（8.7 权限模型）：非超管只能访问本校数据，越权抛 403
    await this.dataScopeGuard.canActivate(context);
    return true;
  }
}
