import { describe, it, expect } from 'vitest';
import { extractScores } from './campuses.service';

/** D1 满意度评分口径：answers 内 score 字段（1~5）提取 */
describe('extractScores（问卷满意度口径）', () => {
  it('顶层 score 字段直接提取', () => {
    expect(extractScores({ score: 4 })).toEqual([4]);
  });

  it('多题嵌套 score 取各自值', () => {
    expect(extractScores({ q1: { score: 5 }, q2: { score: 3 } })).toEqual([5, 3]);
  });

  it('字符串数字转数值', () => {
    expect(extractScores({ score: '4' })).toEqual([4]);
  });

  it('越界分值（0、6）跳过', () => {
    expect(extractScores({ score: 0, extra: { score: 6 } })).toEqual([]);
  });

  it('无 score 字段返回空', () => {
    expect(extractScores({ choice: 'A', comment: '不错' })).toEqual([]);
  });

  it('非对象/空值安全返回空', () => {
    expect(extractScores(null)).toEqual([]);
    expect(extractScores('abc')).toEqual([]);
    expect(extractScores(42)).toEqual([]);
  });
});
