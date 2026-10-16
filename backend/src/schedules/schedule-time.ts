/**
 * 课表时间计算（调课顺延 / 冲突检测）
 *
 * 纯函数：无副作用、无 IO，`now` 可注入以便测试。
 * 时区注意：一律用毫秒偏移做位移，保持「时分」不变（中国无夏令时）。
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 可参与顺延的课表状态（已取消/已完成/进行中的不动） */
const SHIFTABLE_STATUS = new Set(['scheduled']);

export type SkipReason = 'not_schedulable' | 'before_range' | 'already_started' | 'invalid_days';

export interface ShiftableSchedule {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
}

export interface PostponePlanItem {
  id: number;
  /** 原开始时间（ISO），便于前端回显与撤销 */
  from: string;
  /** 新开始时间（ISO） */
  to: string;
  newStartTime: string;
  newEndTime: string;
}

export interface PostponePlan {
  items: PostponePlanItem[];
  skipped: { id: number; reason: SkipReason }[];
}

/** 整体后移 N 天，保持时分秒不变 */
export function shiftByDays(date: Date | string, days: number): Date {
  return new Date(new Date(date).getTime() + days * MS_PER_DAY);
}

/** 半开区间重叠判断：首尾相接（endA === startB）不算重叠，允许背靠背排课 */
export function isOverlapping(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string,
): boolean {
  return (
    new Date(startA).getTime() < new Date(endB).getTime() &&
    new Date(startB).getTime() < new Date(endA).getTime()
  );
}

/**
 * 生成「整体顺延」计划。
 *
 * 规则：
 *  - 只动 `status = scheduled` 的课（已取消 / 已完成 / 进行中的不动）
 *  - 只动 `startTime >= fromDate` 的课（范围内）
 *  - 只动「尚未开始」的课（`startTime > now`）—— 已经上过的课不该被挪走
 *  - `days <= 0` 视为无效，不做任何顺延
 */
export function buildPostponePlan(
  schedules: ShiftableSchedule[],
  fromDate: Date | string,
  days: number,
  now: Date = new Date(),
): PostponePlan {
  const list = schedules ?? [];
  if (!list.length) return { items: [], skipped: [] };

  if (!Number.isFinite(days) || days <= 0) {
    return {
      items: [],
      skipped: list.map((s) => ({ id: s.id, reason: 'invalid_days' as SkipReason })),
    };
  }

  const fromTs = new Date(fromDate).getTime();
  const nowTs = now.getTime();

  const items: PostponePlanItem[] = [];
  const skipped: { id: number; reason: SkipReason }[] = [];

  for (const s of list) {
    if (!SHIFTABLE_STATUS.has(s.status)) {
      skipped.push({ id: s.id, reason: 'not_schedulable' });
      continue;
    }
    const startTs = new Date(s.startTime).getTime();
    if (startTs < fromTs) {
      skipped.push({ id: s.id, reason: 'before_range' });
      continue;
    }
    if (startTs <= nowTs) {
      skipped.push({ id: s.id, reason: 'already_started' });
      continue;
    }

    const newStart = shiftByDays(s.startTime, days);
    const newEnd = shiftByDays(s.endTime, days);
    items.push({
      id: s.id,
      from: new Date(s.startTime).toISOString(),
      to: newStart.toISOString(),
      newStartTime: newStart.toISOString(),
      newEndTime: newEnd.toISOString(),
    });
  }

  return { items, skipped };
}
