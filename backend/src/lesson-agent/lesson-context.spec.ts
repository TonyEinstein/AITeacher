import { describe, it, expect } from 'vitest';
import { relevanceScore, rankRelevantChunks, buildQaContext } from './lesson-context';

describe('relevanceScore', () => {
  it('完全相同得满分', () => {
    expect(relevanceScore('光合作用', '光合作用')).toBe(1);
  });

  it('完全无关得 0 分', () => {
    expect(relevanceScore('光合作用', '牛顿第一定律')).toBe(0);
  });

  it('部分重合落在 0 与 1 之间', () => {
    const s = relevanceScore('光合作用的光反应', '光合作用分为光反应和暗反应两个阶段');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('标点与空白不影响匹配', () => {
    expect(relevanceScore('光合作用', '光，合 作 用！')).toBe(1);
  });

  it('空查询得 0 分', () => {
    expect(relevanceScore('', '任意文本')).toBe(0);
    expect(relevanceScore('   ', '任意文本')).toBe(0);
  });

  it('单字查询也能匹配', () => {
    expect(relevanceScore('光', '光合作用')).toBeGreaterThan(0);
  });
});

describe('rankRelevantChunks', () => {
  const chunks = [
    '导入：植物为什么是绿色的',
    '叶绿体利用光能把二氧化碳和水转化成有机物',
    '光合作用分为光反应和暗反应两个阶段',
    '牛顿第一定律：物体不受外力时保持静止或匀速直线运动',
  ];

  it('按相关度降序返回，且只返回有重合的片段', () => {
    const r = rankRelevantChunks('光合作用的光反应', chunks, 2);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(r.every((c) => c.includes('光合作用') || c.includes('光反应'))).toBe(true);
    expect(r.some((c) => c.includes('牛顿'))).toBe(false);
  });

  it('无任何重合时返回空数组，而不是硬塞内容', () => {
    expect(rankRelevantChunks('完全无关的量子纠缠', chunks, 3)).toEqual([]);
  });

  it('topK 生效', () => {
    const r = rankRelevantChunks('光合作用', chunks, 1);
    expect(r).toHaveLength(1);
  });

  it('空候选返回空数组', () => {
    expect(rankRelevantChunks('光合作用', [], 3)).toEqual([]);
  });
});

describe('buildQaContext', () => {
  const base = {
    question: '光合作用的暗反应在哪里进行',
    lessonTitle: '光合作用',
    transcript: [
      '导入：植物为什么是绿色的',
      '叶绿体利用光能把二氧化碳和水转化成有机物',
      '光合作用分为光反应和暗反应两个阶段',
    ],
    knowledgePoints: ['光合作用', '细胞呼吸', '遗传定律'],
  };

  it('始终包含课题', () => {
    const ctx = buildQaContext(base);
    expect(ctx).toContain('光合作用');
  });

  it('包含与问题相关的讲稿片段', () => {
    const ctx = buildQaContext(base);
    expect(ctx).toContain('光反应和暗反应');
  });

  it('包含相关的知识点', () => {
    const ctx = buildQaContext(base);
    expect(ctx).toContain('光合作用');
  });

  it('相关度低的内容不进上下文，避免污染', () => {
    const ctx = buildQaContext({ ...base, question: '暗反应' });
    expect(ctx).not.toContain('植物为什么是绿色的');
  });

  it('尊重 maxChars 上限', () => {
    const long = Array.from({ length: 200 }, (_, i) => `光合作用的第${i}段很长的讲稿内容，用于测试截断行为`);
    const ctx = buildQaContext({ ...base, transcript: long, maxChars: 50 });
    expect(ctx.length).toBeLessThanOrEqual(50);
    expect(ctx.length).toBeGreaterThan(20);
  });

  it('讲稿为空时仍能产出只含课题与知识点的上下文', () => {
    const ctx = buildQaContext({ ...base, transcript: [] });
    expect(ctx).toContain('光合作用');
    expect(ctx.length).toBeGreaterThan(0);
  });
});
