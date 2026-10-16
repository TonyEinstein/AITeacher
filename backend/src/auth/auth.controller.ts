import { Controller, Post, Body, Get, UseGuards, Request, Req, HttpCode, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginRateLimiterService } from './login-rate-limiter.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimiter: LoginRateLimiterService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const ip: string = (req.ip || req.headers?.['x-forwarded-for'] || 'unknown').toString().split(',')[0].trim();
    // 锁定检查（锁定中直接抛 429）
    this.rateLimiter.check(ip);
    try {
      const result = await this.authService.login(loginDto);
      this.rateLimiter.reset(ip);
      return result;
    } catch (e) {
      this.rateLimiter.recordFailure(ip);
      throw e;
    }
  }

  /** 学生端登录（公开，无守卫）：学号+姓名验证并签发 JWT */
  @Post('student-login')
  @HttpCode(200)
  studentLogin(@Body() body: { studentNo: string; name?: string }) {
    if (!body.studentNo || !body.studentNo.trim()) {
      throw new BadRequestException('缺少 studentNo 参数');
    }
    return this.authService.studentLogin(body.studentNo.trim(), body.name);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
