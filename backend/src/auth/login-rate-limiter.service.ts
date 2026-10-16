import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

/**
 * 简单内存登录限流：同一 IP 连续失败 5 次，锁定 15 分钟。
 * 不引入 @nestjs/throttler，进程内 Map 即可（单实例部署）。
 */
@Injectable()
export class LoginRateLimiterService {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly MAX_FAILS = 5;
  private readonly LOCK_MS = 15 * 60 * 1000; // 15 分钟

  /** 检查是否被锁定；锁定则抛 429 */
  check(ip: string) {
    const rec = this.attempts.get(ip);
    if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
      const retrySec = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
      throw new HttpException(
        `登录失败次数过多，请 ${Math.ceil(retrySec / 60)} 分钟后重试`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** 登录失败时记录一次 */
  recordFailure(ip: string) {
    const now = Date.now();
    const rec = this.attempts.get(ip) || { count: 0, lockedUntil: null };
    // 若锁已过期，重置计数
    if (rec.lockedUntil && rec.lockedUntil <= now) {
      rec.count = 0;
      rec.lockedUntil = null;
    }
    rec.count += 1;
    if (rec.count >= this.MAX_FAILS) {
      rec.lockedUntil = now + this.LOCK_MS;
    }
    this.attempts.set(ip, rec);
  }

  /** 登录成功后清除该 IP 的失败计数 */
  reset(ip: string) {
    this.attempts.delete(ip);
  }
}
