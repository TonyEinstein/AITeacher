import { describe, it, expect } from 'vitest';
import { computeLessonScores, inferEmotion } from './lesson-scoring';

const base = {
  attendanceStatus: 'present',
  violationEventCount: 0,
  warningDeduction: 0,
  handRaiseCount: 0,
  behaviorEventCount: 0,
  homeworkScores: [] as number[],
};

describe('computeLessonScores', () => {
  it('结果必须确定性：同一输入多次调用完全一致（无随机性）', () => {
    const input = { ...base, handRaiseCount: 3, homeworkScores: [88, 92] };
    const a = computeLessonScores(input);
    const b = computeLessonScores(input);
    const c = computeLessonScores(input);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('正常行为（focus/hand_raise）不得扣减纪律分', () => {
    const withNormalOnly = computeLessonScores({
      ...base,
      behaviorEventCount: 20,
      violationEventCount: 0,
    });
    expect(withNormalOnly.dimensions.discipline).toBe(100);
  });

  it('违纪事件与 Warning 扣分共同作用于纪律分', () => {
    const r = computeLessonScores({ ...base, violationEventCount: 2, warningDeduction: 3 });
    expect(r.dimensions.discipline).toBe(100 - 20 - 3);
  });

  it('纪律分不会低于 0', () => {
    const r = computeLessonScores({ ...base, violationEventCount: 20, warningDeduction: 50 });
    expect(r.dimensions.discipline).toBe(0);
  });

  it('参与度由举手次数推导，封顶 100', () => {
    expect(computeLessonScores({ ...base, handRaiseCount: 0 }).dimensions.participation).toBe(70);
    expect(computeLessonScores({ ...base, handRaiseCount: 1 }).dimensions.participation).toBe(80);
    expect(computeLessonScores({ ...base, handRaiseCount: 3 }).dimensions.participation).toBe(100);
    expect(computeLessonScores({ ...base, handRaiseCount: 99 }).dimensions.participation).toBe(100);
  });

  it('作业分取最近 5 次均分', () => {
    const r = computeLessonScores({ ...base, homeworkScores: [90, 80, 70, 60, 100, 0] });
    expect(r.dimensions.homework).toBe(80);
  });

  it('无作业数据时用中性默认分 80，并在 _sources 标记 default', () => {
    const r = computeLessonScores(base);
    expect(r.dimensions.homework).toBe(80);
    expect(r.dimensions._sources.homework).toBe('default');
  });

  it('有作业数据时 _sources 标记 submission', () => {
    const r = computeLessonScores({ ...base, homeworkScores: [88] });
    expect(r.dimensions._sources.homework).toBe('submission');
  });

  it('出勤映射：present=100 / late=70 / absent=0 / null=0', () => {
    expect(computeLessonScores({ ...base, attendanceStatus: 'present' }).dimensions.attendance).toBe(100);
    expect(computeLessonScores({ ...base, attendanceStatus: 'late' }).dimensions.attendance).toBe(70);
    expect(computeLessonScores({ ...base, attendanceStatus: 'absent' }).dimensions.attendance).toBe(0);
    expect(computeLessonScores({ ...base, attendanceStatus: null }).dimensions.attendance).toBe(0);
  });

  it('总分按 0.2/0.3/0.25/0.25 加权', () => {
    const r = computeLessonScores({
      attendanceStatus: 'present',
      violationEventCount: 0,
      warningDeduction: 0,
      handRaiseCount: 3,
      behaviorEventCount: 5,
      homeworkScores: [80],
    });
    // 100*0.2 + 100*0.3 + 100*0.25 + 80*0.25 = 20+30+25+20 = 95
    expect(r.overall).toBe(95);
  });
});

describe('inferEmotion', () => {
  it('有违纪行为 → negative', () => {
    expect(
      inferEmotion({ violationEventCount: 1, warningDeduction: 0, discipline: 95, participation: 90 }),
    ).toBe('negative');
  });

  it('纪律扣分 >= 3 → negative', () => {
    expect(
      inferEmotion({ violationEventCount: 0, warningDeduction: 3, discipline: 95, participation: 90 }),
    ).toBe('negative');
  });

  it('纪律分 < 70 → negative', () => {
    expect(
      inferEmotion({ violationEventCount: 0, warningDeduction: 0, discipline: 60, participation: 90 }),
    ).toBe('negative');
  });

  it('纪律好 + 参与度高 → positive', () => {
    expect(
      inferEmotion({ violationEventCount: 0, warningDeduction: 0, discipline: 95, participation: 90 }),
    ).toBe('positive');
  });

  it('其余 → neutral', () => {
    expect(
      inferEmotion({ violationEventCount: 0, warningDeduction: 0, discipline: 85, participation: 70 }),
    ).toBe('neutral');
  });
});
