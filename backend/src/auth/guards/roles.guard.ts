import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('权限不足，无权访问此资源');
    }
    // 注意：**不做自动提权**。
    //
    // 历史实现是 `user.role === 'group_admin' ? ['group_admin', 'super_admin'] : [user.role]`，
    // 相当于把集团管理员当成超级管理员放行，导致它能调用所有 `@Roles('super_admin')`
    // 的平台级接口（学校管理、官网设置、咨询留资…）并读到其他集团的数据。
    // PRD §8.7 规定集团管理员的数据范围是「所有校区」（本集团），不是「所有学校」。
    //
    // 现在改为**显式授权**：需要集团管理员访问的接口必须在 @Roles 里写明 'group_admin'。
    // 凡是与 school_admin 同级的校内接口都已补上 group_admin；仅列 super_admin 的
    // 平台级接口保持集团管理员不可访问。
    const effectiveRoles: string[] = [user.role];
    if (!requiredRoles.some((r) => effectiveRoles.includes(r))) {
      throw new ForbiddenException('权限不足，无权访问此资源');
    }
    return true;
  }
}