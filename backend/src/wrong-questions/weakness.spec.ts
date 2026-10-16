import { describe, it, expect } from 'vitest';
import { computeWeaknesses, RECENT_DAYS } from './weakness';

const NOW = new Date('2026-09-30T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('computeWeaknesses', () => {
  it('空输入返回空画像', () => {
    const r = computeWeaknesses([], 5, NOW);
    expect(r.totalWrong).toBe(0);
    expect(r.classified).toBe(0);
    expect(r.items).toEqual([]);
    expect(r.summary).toBe('');
  });

  it('无知识点的错题计入 unclassified，不进入 items', () => {
    const r = computeWeaknesses(
      [
        { knowledgePoint: null, createdAt: daysAgo(1) },
        { knowledgePoint: '', createdAt: daysAgo(1) },
        { knowledgePoint: '光合作用', createdAt: daysAgo(1) },
      ],
      5,
      NOW,
    );
    expect(r.totalWrong).toBe(3);
    expect(r.classified).toBe(1);
    expect(r.unclassified).toBe(2);
    expect(r.items.map((i) => i.knowledgePoint)).toEqual(['光合作用']);
  });

  it('按知识点聚合计数，并按薄弱分降序', () => {
    const r = computeWeaknesses(
      [
        // 光合作用：3 错，其中 2 次在近 30 天 → 3 + 2*0.5 = 4
        { knowledgePoint: '光合作用', createdAt: daysAgo(1) },
        { knowledgePoint: '光合作用', createdAt: daysAgo(5) },
        { knowledgePoint: '光合作用', createdAt: daysAgo(90) },
        // 细胞呼吸：2 错，均较早 → 2
        { knowledgePoint: '细胞呼吸', createdAt: daysAgo(90) },
        { knowledgePoint: '细胞呼吸', createdAt: daysAgo(120) },
        // 遗传定律：1 错且在近期 → 1 + 0.5 = 1.5
        { knowledgePoint: '遗传定律', createdAt: daysAgo(2) },
      ],
      5,
      NOW,
    );

    expect(r.items.map((i) => i.knowledgePoint)).toEqual(['光合作用', '细胞呼吸', '遗传定律']);
    expect(r.items.map((i) => i.wrongCount)).toEqual([3, 2, 1]);
    expect(r.items.map((i) => i.score)).toEqual([4, 2, 1.5]);
    expect(r.items.map((i) => i.recentCount)).toEqual([2, 0, 1]);
  });

  it('sharePercent 以已归类错题为分母，合计约 100', () => {
    const r = computeWeaknesses(
      [
        { knowledgePoint: 'A', createdAt: daysAgo(1) },
        { knowledgePoint: 'A', createdAt: daysAgo(1) },
        { knowledgePoint: 'A', createdAt: daysAgo(1) },
        { knowledgePoint: 'B', createdAt: daysAgo(1) },
        { knowledgePoint: 'B', createdAt: daysAgo(1) },
        { knowledgePoint: 'C', createdAt: daysAgo(1) },
      ],
      5,
      NOW,
    );
    expect(r.items.map((i) => i.sharePercent)).toEqual([50, 33.3, 16.7]);
    const sum = r.items.reduce((s, i) => s + i.sharePercent, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it('recentCount 的窗口是最近 30 天（边界含第 30 天）', () => {
    const r = computeWeaknesses(
      [
        { knowledgePoint: 'A', createdAt: daysAgo(RECENT_DAYS) },
        { knowledgePoint: 'A', createdAt: daysAgo(RECENT_DAYS + 1) },
      ],
      5,
      NOW,
    );
    expect(r.items[0].recentCount).toBe(1);
  });

  it('latestAt 取该知识点最近一次错题时间（ISO 字符串）', () => {
    const r = computeWeaknesses(
      [
        { knowledgePoint: 'A', createdAt: daysAgo(10) },
        { knowledgePoint: 'A', createdAt: daysAgo(3) },
      ],
      5,
      NOW,
    );
    expect(r.items[0].latestAt).toBe(daysAgo(3).toISOString());
  });

  it('topN 截断，但统计量仍按全量计算', () => {
    const records = ['A', 'B', 'C', 'D'].flatMap((k, idx) =>
      Array.from({ length: 4 - idx }, () => ({ knowledgePoint: k, createdAt: daysAgo(1) })),
    );
    const r = computeWeaknesses(records, 2, NOW);
    expect(r.items).toHaveLength(2);
    expect(r.totalWrong).toBe(4 + 3 + 2 + 1);
    expect(r.classified).toBe(10);
  });

  it('summary 取前 3 个知识点，格式为「知识点(错N题)」', () => {
    const records = ['A', 'A', 'A', 'B', 'B', 'C', 'D'].map((k) => ({
      knowledgePoint: k,
      createdAt: daysAgo(1),
    }));
    const r = computeWeaknesses(records, 5, NOW);
    expect(r.summary).toBe('A(错3题)、B(错2题)、C(错1题)');
  });

  it('全部错题都无知识点时 summary 为空、items 为空', () => {
    const r = computeWeaknesses([{ knowledgePoint: null, createdAt: daysAgo(1) }], 5, NOW);
    expect(r.items).toEqual([]);
    expect(r.summary).toBe('');
    expect(r.unclassified).toBe(1);
  });

  it('知识点名称做去空白处理，避免同一知识点被拆成多个', () => {
    const r = computeWeaknesses(
      [
        { knowledgePoint: '光合作用', createdAt: daysAgo(1) },
        { knowledgePoint: '  光合作用 ', createdAt: daysAgo(1) },
      ],
      5,
      NOW,
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].wrongCount).toBe(2);
  });
});
