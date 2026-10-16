import { describe, it, expect } from 'vitest';
import { shiftByDays, isOverlapping, buildPostponePlan } from './schedule-time';

const NOW = new Date('2026-09-30T02:00:00Z');
const FROM = '2026-09-29T00:00:00Z';

describe('shiftByDays', () => {
  it('加 N 天保持时分秒不变', () => {
    const d = new Date('2026-09-30T00:30:00Z');
    const r = shiftByDays(d, 3);
    expect(r.getTime() - d.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
    expect(r.getUTCDate()).toBe(3); // 2026-10-03
    expect(r.getUTCHours()).toBe(0);
    expect(r.getUTCMinutes()).toBe(30);
  });

  it('跨月正确', () => {
    expect(shiftByDays('2026-01-31T08:00:00Z', 1).toISOString()).toBe('2026-02-01T08:00:00.000Z');
  });

  it('支持负数（前挪）', () => {
    expect(shiftByDays('2026-03-01T08:00:00Z', -1).toISOString()).toBe('2026-02-28T08:00:00.000Z');
  });

  it('0 天返回同一时刻', () => {
    expect(shiftByDays('2026-09-30T08:00:00Z', 0).toISOString()).toBe('2026-09-30T08:00:00.000Z');
  });
});

describe('isOverlapping', () => {
  const t = (s: string) => new Date(s);

  it('明显重叠返回 true', () => {
    expect(
      isOverlapping(t('2026-10-01T08:00:00Z'), t('2026-10-01T09:00:00Z'), t('2026-10-01T08:30:00Z'), t('2026-10-01T09:30:00Z')),
    ).toBe(true);
  });

  it('首尾相接不算重叠（背靠背排课应允许）', () => {
    expect(
      isOverlapping(t('2026-10-01T08:00:00Z'), t('2026-10-01T08:45:00Z'), t('2026-10-01T08:45:00Z'), t('2026-10-01T09:30:00Z')),
    ).toBe(false);
  });

  it('完全分离不算重叠', () => {
    expect(
      isOverlapping(t('2026-10-01T08:00:00Z'), t('2026-10-01T09:00:00Z'), t('2026-10-01T10:00:00Z'), t('2026-10-01T11:00:00Z')),
    ).toBe(false);
  });

  it('包含关系算重叠', () => {
    expect(
      isOverlapping(t('2026-10-01T08:00:00Z'), t('2026-10-01T12:00:00Z'), t('2026-10-01T09:00:00Z'), t('2026-10-01T10:00:00Z')),
    ).toBe(true);
  });
});

describe('buildPostponePlan', () => {
  const base = [
    { id: 1, startTime: '2026-10-01T08:00:00Z', endTime: '2026-10-01T08:45:00Z', status: 'scheduled' },
    { id: 2, startTime: '2026-10-02T08:00:00Z', endTime: '2026-10-02T08:45:00Z', status: 'scheduled' },
    { id: 3, startTime: '2026-09-29T08:00:00Z', endTime: '2026-09-29T08:45:00Z', status: 'scheduled' },
    { id: 4, startTime: '2026-10-03T08:00:00Z', endTime: '2026-10-03T08:45:00Z', status: 'cancelled' },
    { id: 5, startTime: '2026-10-04T08:00:00Z', endTime: '2026-10-04T08:45:00Z', status: 'completed' },
    { id: 6, startTime: '2026-09-28T08:00:00Z', endTime: '2026-09-28T08:45:00Z', status: 'scheduled' },
  ];

  it('只顺延范围内「未开始且未取消」的课', () => {
    const plan = buildPostponePlan(base, FROM, 3, NOW);
    expect(plan.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it('顺延后起止时间整体后移，且保留原值便于回显', () => {
    const plan = buildPostponePlan(base, FROM, 3, NOW);
    expect(plan.items[0]).toEqual({
      id: 1,
      from: '2026-10-01T08:00:00.000Z',
      to: '2026-10-04T08:00:00.000Z',
      newStartTime: '2026-10-04T08:00:00.000Z',
      newEndTime: '2026-10-04T08:45:00.000Z',
    });
  });

  it('已取消 / 已完成的课不参与顺延', () => {
    const plan = buildPostponePlan(base, FROM, 3, NOW);
    const ids = plan.items.map((i) => i.id);
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(5);
    expect(plan.skipped.find((s) => s.id === 4)?.reason).toBe('not_schedulable');
    expect(plan.skipped.find((s) => s.id === 5)?.reason).toBe('not_schedulable');
  });

  it('范围之前、以及已开始的课不参与顺延', () => {
    const plan = buildPostponePlan(base, FROM, 3, NOW);
    expect(plan.skipped.find((s) => s.id === 3)?.reason).toBe('already_started');
    expect(plan.skipped.find((s) => s.id === 6)?.reason).toBe('before_range');
  });

  it('days 非正数时不做任何顺延', () => {
    const zero = buildPostponePlan(base, FROM, 0, NOW);
    expect(zero.items).toEqual([]);
    expect(zero.skipped).toHaveLength(base.length);
    expect(zero.skipped.every((s) => s.reason === 'invalid_days')).toBe(true);

    const neg = buildPostponePlan(base, FROM, -2, NOW);
    expect(neg.items).toEqual([]);
  });

  it('空输入返回空计划', () => {
    const plan = buildPostponePlan([], FROM, 3, NOW);
    expect(plan.items).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });
});
