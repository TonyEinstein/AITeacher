/**
 * 课后打分纯函数（无副作用、无随机、可单测）
 *
 * 数据来源：
 *  - attendance    ← Attendance.status
 *  - discipline    ← BehaviorEvent(category=violation) + Warning.scoreDeduction
 *  - participation ← BehaviorEvent(type=hand_raise) 计数
 *  - homework      ← Submission.score（同科最近 N 次已批改）
 *
 * 注意：正常行为（focus/hand_raise/writing/standing）不参与纪律扣分。
 */

export interface LessonScoringInput {
  /** Attendance.status：present / late / absent / early_leave / null */
  attendanceStatus?: string | null;
  /** 该生本节课违纪类行为事件数（category === 'violation'） */
  violationEventCount: number;
  /** 该生本节课 Warning 扣分合计 */
  warningDeduction: number;
  /** 该生本节课举手次数 */
  handRaiseCount: number;
  /** 该生本节课行为事件总数（用于判断参与度是否有真实数据） */
  behaviorEventCount: number;
  /** 该生同科最近若干次已批改作业得分（已按时间倒序） */
  homeworkScores: number[];
}

export interface LessonDimensions {
  attendance: number;
  discipline: number;
  participation: number;
  homework: number;
  /** 各维度数据来源，便于前端/排查区分「真实数据」与「中性默认」 */
  _sources: { participation: string; homework: string };
}

export interface LessonScoringResult {
  overall: number;
  dimensions: LessonDimensions;
}

/** 无作业数据时的中性分 */
export const HOMEWORK_DEFAULT = 80;
/** 零举手时的参与度基础分 */
export const PARTICIPATION_BASE = 70;
/** 每次举手加分 */
export const PARTICIPATION_STEP = 10;
/** 作业取样条数 */
export const HOMEWORK_SAMPLE_SIZE = 5;
/** 每起违纪事件的纪律扣分 */
export const VIOLATION_PENALTY = 10;

export function computeLessonScores(input: LessonScoringInput): LessonScoringResult {
  const attendance =
    input.attendanceStatus === 'present' ? 100 : input.attendanceStatus === 'late' ? 70 : 0;

  // 仅违纪事件参与扣分，正常行为不扣分
  const discipline = Math.max(
    0,
    100 - input.violationEventCount * VIOLATION_PENALTY - input.warningDeduction,
  );

  const participation = Math.min(
    100,
    PARTICIPATION_BASE + input.handRaiseCount * PARTICIPATION_STEP,
  );

  const samples = input.homeworkScores.slice(0, HOMEWORK_SAMPLE_SIZE);
  const homework = samples.length
    ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
    : HOMEWORK_DEFAULT;

  const overall = Math.round(
    attendance * 0.2 + discipline * 0.3 + participation * 0.25 + homework * 0.25,
  );

  return {
    overall,
    dimensions: {
      attendance,
      discipline,
      participation,
      homework,
      _sources: {
        participation: input.behaviorEventCount > 0 ? 'behavior' : 'default',
        homework: samples.length ? 'submission' : 'default',
      },
    },
  };
}

export interface EmotionInput {
  violationEventCount: number;
  warningDeduction: number;
  discipline: number;
  participation: number;
}

/** 课堂情绪推断（PRD §3.28）：positive 积极 / neutral 平稳 / negative 消极 */
export function inferEmotion(input: EmotionInput): 'positive' | 'neutral' | 'negative' {
  if (input.violationEventCount > 0 || input.warningDeduction >= 3 || input.discipline < 70) {
    return 'negative';
  }
  if (input.discipline >= 90 && input.participation >= 90) return 'positive';
  return 'neutral';
}
