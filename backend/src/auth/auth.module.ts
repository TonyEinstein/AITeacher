import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { DataScopeGuard } from './guards/data-scope.guard';
import { LoginRateLimiterService } from './login-rate-limiter.service';
import { StudentsModule } from '../students/students.module';

// 全局鉴权模块：各业务模块的 controller 直接用 @UseGuards(JwtAuthGuard) 即可，
// 无需每个模块重复导入 PassportModule/JwtModule
@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    StudentsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, DataScopeGuard, LoginRateLimiterService],
  exports: [AuthService, JwtModule, PassportModule, JwtAuthGuard, RolesGuard, DataScopeGuard],
})
export class AuthModule {}
