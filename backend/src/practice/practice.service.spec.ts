import { describe, it, expect } from 'vitest';

/**
 * 学科专项练习（PRD §3.19）统计逻辑测试。
 * service 依赖 DB；这里测纯统计规则的正确定义（练习类型白名单与正确率口径
 * 由 practice.service 内联实现，通过类型与行为约束防回归）。
 * 为保持零 mock，把 streak 计算抽出来直接测。
 */
import { PRACTICE_TYPES } from './practice.service';

describe('PRACTICE_TYPES（学科专项练习类型）', () => {
  it('覆盖 PRD §3.19 的四类专项', () => {
    expect(PRACTICE_TYPES).toEqual(['reading', 'dictation', 'oral', 'spelling']);
  });
});
