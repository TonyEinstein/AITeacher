# 地基修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `Evaluation.score` 及其所有下游功能建立在真实数据上，而不是 50% 随机噪声与反向扣分逻辑。

**Architecture:** 把课后打分逻辑从 `EvaluationsService` 的私有方法抽成纯函数模块 `lesson-scoring.ts`，先写单元测试锁定行为（含"无随机性"与"正常行为不扣纪律分"两个关键断言），再让服务层从 `BehaviorEvent` / `Submission` / `Warning` 取真实数据喂进去，最后用一个可重复运行的脚本端到端验证整条链路。

**Tech Stack:** NestJS 12 + TypeScript 6 + Prisma 5 + PostgreSQL 16 + Vitest 4 + ts-node

**设计文档：** `docs/plans/2026-09-30-foundation-repair-design.md`

---

## 阶段 0：环境就绪

### Task 0: 启动中间件并同步数据库结构

**Files:**
- 无代码改动（环境操作）

**Step 1: 启动中间件**

```bash
cd E:/AITeacher/infra/docker
./start.ps1
```

Expected: `ai-teacher-postgres` / `ai-teacher-redis` / `ai-teacher-s3` / `ai-teacher-srs` 四个容器 Running。
若 MinIO 镜像拉取失败（历史已知问题），**不阻塞**——Postgres 起来即可继续。

**Step 2: 确认 Postgres 端口可达**

```bash
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/127.0.0.1/5433' && echo "PG OK"
```

Expected: `PG OK`

**Step 3: 同步 Prisma schema（含本次新增的 county / emotion / StudentAlert）**

```bash
cd E:/AITeacher/backend
./node_modules/.bin/prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

**Step 4: 灌种子数据（若库为空）**

```bash
cd E:/AITeacher/backend
./node_modules/.bin/prisma db seed
```

Expected: 输出创建的学校/年级/班级/学生数量。

**Step 5: 记录结果**

若第 1 步失败，停下来告知用户，不要继续。

---

## 阶段 1：数据地基

### Task 1: 抽取打分纯函数并写单元测试

**Files:**
- Create: `backend/src/evaluations/lesson-scoring.ts`
- Test: `backend/src/evaluations/lesson-scoring.spec.ts`

**Step 1: 写失败的测试**

创建 `backend/src/evaluations/lesson-scoring.spec.ts`：

```ts
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
    const withNormalOnly = computeLessonScores({ ...base, behaviorEventCount: 20, violationEventCount: 0 });
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
    expect(r.dimensions.homework).toBe(80); // 只取前 5 个：[90,80,70,60,100]
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

  it('出勤映射：present=100 / late=70 / absent=0', () => {
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
    expect(inferEmotion({ violationEventCount: 1, warningDeduction: 0, discipline: 95, participation: 90 })).toBe('negative');
  });

  it('纪律扣分 >= 3 → negative', () => {
    expect(inferEmotion({ violationEventCount: 0, warningDeduction: 3, discipline: 95, participation: 90 })).toBe('negative');
  });

  it('纪律分 < 70 → negative', () => {
    expect(inferEmotion({ violationEventCount: 0, warningDeduction: 0, discipline: 60, participation: 90 })).toBe('negative');
  });

  it('纪律好 + 参与度高 → positive', () => {
    expect(inferEmotion({ violationEventCount: 0, warningDeduction: 0, discipline: 95, participation: 90 })).toBe('positive');
  });

  it('其余 → neutral', () => {
    expect(inferEmotion({ violationEventCount: 0, warningDeduction: 0, discipline: 85, participation: 70 })).toBe('neutral');
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
cd E:/AITeacher/backend
./node_modules/.bin/vitest run src/evaluations/lesson-scoring.spec.ts
```

Expected: FAIL —— `Failed to resolve import "./lesson-scoring"`

**Step 3: 实现纯函数**

创建 `backend/src/evaluations/lesson-scoring.ts`：

```ts
/**
 * 课后打分纯函数（无副作用、无随机、可单测）
 *
 * 数据来源：
 *  - attendance   ← Attendance.status
 *  - discipline   ← BehaviorEvent(category=violation) + Warning.scoreDeduction
 *  - participation← BehaviorEvent(type=hand_raise) 计数
 *  - homework     ← Submission.score（同科最近 N 次已批改）
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
    input.attendanceStatus === 'present' ? 100
    : input.attendanceStatus === 'late' ? 70
    : 0;

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
```

**Step 4: 运行测试，确认通过**

```bash
cd E:/AITeacher/backend
./node_modules/.bin/vitest run src/evaluations/lesson-scoring.spec.ts
```

Expected: PASS —— 15 个用例全绿

**Step 5: 提交**

```bash
git add backend/src/evaluations/lesson-scoring.ts backend/src/evaluations/lesson-scoring.spec.ts
git commit -m "feat(evaluations): 抽取课后打分纯函数并补单测，消除随机性与反向扣分"
```

---

### Task 2: 服务层接入真实数据

**Files:**
- Modify: `backend/src/evaluations/evaluations.service.ts`（`scoreAfterLesson` + 删除私有 `generateComment` 里的旧逻辑、删除私有 `inferEmotion`）

**Step 1: 引入依赖与常量**

在 `evaluations.service.ts` 顶部 import：

```ts
import { computeLessonScores, inferEmotion } from './lesson-scoring';
```

**Step 2: 在 `scoreAfterLesson` 的 include 里补 lessonPlan**

把 `findUnique` 的 `include` 改为：

```ts
      include: {
        attendance: true,
        behaviorEvents: true,
        warnings: true,
        lessonPlan: true,
        class: { include: { students: true } },
      },
```

**Step 3: 批量取作业分（一次查询，避免 N+1）**

在 `if (!record) return [];` 之后、`const results = [];` 之前插入：

```ts
    const studentIds = record.class.students.map((s) => s.id);
    const subjectId = record.lessonPlan?.subjectId ?? null;

    // 该班学生同科最近已批改作业得分，按学生分组（时间倒序）
    const submissions = studentIds.length
      ? await this.prisma.submission.findMany({
          where: {
            studentId: { in: studentIds },
            score: { not: null },
            status: { in: ['graded', 'reviewed'] },
            ...(subjectId ? { assignment: { lessonPlan: { subjectId } } } : {}),
          },
          select: { studentId: true, score: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const homeworkByStudent = new Map<number, number[]>();
    for (const sub of submissions) {
      if (sub.score == null) continue;
      const arr = homeworkByStudent.get(sub.studentId) || [];
      if (arr.length < 5) arr.push(sub.score);
      homeworkByStudent.set(sub.studentId, arr);
    }
```

**Step 4: 替换循环内的打分逻辑**

把循环体内从 `// 各维度打分（满分100）` 到 `const dimensions = {...};` 的整段替换为：

```ts
      // 只统计违纪类事件参与纪律扣分；正常行为（focus/hand_raise/…）不扣分
      const violationEventCount = events.filter((e) => e.category === 'violation').length;
      const handRaiseCount = events.filter((e) => e.type === 'hand_raise').length;
      const warningDeduction = warnings.reduce((s, w) => s + (w.scoreDeduction || 0), 0);

      const { overall, dimensions } = computeLessonScores({
        attendanceStatus: attendance?.status ?? null,
        violationEventCount,
        warningDeduction,
        handRaiseCount,
        behaviorEventCount: events.length,
        homeworkScores: homeworkByStudent.get(student.id) || [],
      });
```

**Step 5: 替换情绪推断调用**

把：

```ts
      const emotion = this.inferEmotion(dimensions, events, warnings);
```

改为：

```ts
      const emotion = inferEmotion({
        violationEventCount,
        warningDeduction,
        discipline: dimensions.discipline,
        participation: dimensions.participation,
      });
```

**Step 6: 删除服务内已废弃的私有 `inferEmotion` 方法**

删除整个 `private inferEmotion(...) { ... }` 方法（已迁到 `lesson-scoring.ts`）。

**Step 7: 编译验证**

```bash
cd E:/AITeacher/backend
./node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: 无输出（0 错误）

**Step 8: 跑全量单测确认无回归**

```bash
cd E:/AITeacher/backend
./node_modules/.bin/vitest run
```

Expected: PASS

**Step 9: 提交**

```bash
git add backend/src/evaluations/evaluations.service.ts
git commit -m "fix(evaluations): 打分接入真实数据（举手/作业），修正纪律分反向扣分"
```

---

## 阶段 2：端到端验证

### Task 3: 编写端到端验证脚本

**Files:**
- Create: `backend/scripts/verify-evaluation-chain.ts`

**Step 1: 编写脚本**

创建 `backend/scripts/verify-evaluation-chain.ts`：

```ts
/**
 * 端到端验证：造一节完整的课 → 打分 → 情绪 → 预警 → 排名
 *
 * 覆盖：Attendance / BehaviorEvent(正常+违纪) / Assignment+Submission
 *      → EvaluationsService.scoreAfterLesson
 *      → AlertsService.scan
 *      → RankingsService.classRanking
 *
 * 运行：npx ts-node --transpile-only scripts/verify-evaluation-chain.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { EvaluationsModule } from '../src/evaluations/evaluations.module';
import { EvaluationsService } from '../src/evaluations/evaluations.service';
import { AlertsModule } from '../src/alerts/alerts.module';
import { AlertsService } from '../src/alerts/alerts.service';
import { RankingsModule } from '../src/rankings/rankings.module';
import { RankingsService } from '../src/rankings/rankings.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

function line(t = '') { console.log(t); }
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const app = await NestFactory.createApplicationContext(
    [PrismaModule, EvaluationsModule, AlertsModule, RankingsModule],
    { logger: ['error', 'warn'] },
  );
  const prisma = app.get(PrismaService);
  const evaluations = app.get(EvaluationsService);
  const alerts = app.get(AlertsService);
  const rankings = app.get(RankingsService);

  // ---------- 1. 找一条真实链路 ----------
  const schedule = await prisma.schedule.findFirst({
    include: { class: { include: { students: true, grade: true } } },
  });
  if (!schedule) throw new Error('库里没有 schedule，请先执行 prisma db seed');

  const klass = schedule.class;
  const students = klass.students;
  if (students.length < 3) throw new Error(`班级学生不足 3 人（当前 ${students.length}）`);

  line(`链路：学校#${klass.grade.schoolId} 年级「${klass.grade.name}」班级「${klass.name}」共 ${students.length} 名学生`);

  // ---------- 2. 造一节完整的课 ----------
  const record = await prisma.lessonRecord.create({
    data: {
      scheduleId: schedule.id,
      classId: klass.id,
      agentId: schedule.agentId,
      lessonPlanId: schedule.lessonPlanId,
      startedAt: new Date(Date.now() - 45 * 60 * 1000),
      endedAt: new Date(),
      status: 'completed',
      summary: { note: 'E2E 验证课程' },
    },
  });
  line(`已创建 LessonRecord #${record.id}`);

  const [good, avg, bad] = students;
  // 出勤：good/avg 正常，bad 迟到
  await prisma.attendance.createMany({
    data: students.map((s) => ({
      lessonRecordId: record.id,
      studentId: s.id,
      status: s.id === bad.id ? 'late' : 'present',
    })),
  });

  // 行为事件：good 举手 3 次 + 专注 5 次；avg 举手 1 次；bad 违纪 2 次 + 举手 0 次
  const events: any[] = [];
  const push = (studentId: number, type: string, category: string, n: number) => {
    for (let i = 0; i < n; i++) {
      events.push({
        lessonRecordId: record.id,
        studentId,
        type,
        category,
        startTime: new Date(Date.now() - (i + 1) * 60 * 1000),
      });
    }
  };
  push(good.id, 'hand_raise', 'normal', 3);
  push(good.id, 'focus', 'normal', 5);
  push(avg.id, 'hand_raise', 'normal', 1);
  push(avg.id, 'focus', 'normal', 4);
  push(bad.id, 'talking', 'violation', 2);
  await prisma.behaviorEvent.createMany({ data: events });
  line(`已写入 ${events.length} 条行为事件`);

  // 违纪事件同步生成 Warning（模拟 lesson-records 的行为）
  await prisma.warning.create({
    data: {
      lessonRecordId: record.id,
      studentId: bad.id,
      type: 'discipline',
      content: '课堂讲话，扣1分',
      scoreDeduction: 1,
    },
  });

  // 作业：给三名学生各造 2 条已批改 Submission
  const lessonPlanId = schedule.lessonPlanId;
  if (lessonPlanId) {
    const assignment = await prisma.assignment.create({
      data: {
        schoolId: klass.grade.schoolId,
        lessonPlanId,
        title: 'E2E 验证作业',
        content: { questions: [] },
        type: 'homework',
        status: 'closed',
      },
    });
    const scores: Record<number, number[]> = { [good.id]: [95, 92], [avg.id]: [80, 78], [bad.id]: [60, 55] };
    const subs: any[] = [];
    for (const [sid, list] of Object.entries(scores)) {
      for (const sc of list) {
        subs.push({
          assignmentId: assignment.id,
          studentId: Number(sid),
          score: sc,
          status: 'reviewed',
          submittedAt: new Date(),
        });
      }
    }
    await prisma.submission.createMany({ data: subs });
    line(`已写入 ${subs.length} 条已批改作业`);
  } else {
    line('⚠️  该 schedule 未绑定 lessonPlan，跳过作业数据（homework 将走默认分）');
  }

  // ---------- 3. 打分 ----------
  line();
  line('=== 课后打分 ===');
  const results = await evaluations.scoreAfterLesson(record.id);
  const byId = new Map(results.map((e: any) => [e.studentId, e]));

  const g = byId.get(good.id) as any;
  const b = byId.get(bad.id) as any;

  line(`  ${good.name}: score=${g?.score} dims=${JSON.stringify(g?.dimensions)} emotion=${g?.emotion}`);
  line(`  ${bad.name}: score=${b?.score} dims=${JSON.stringify(b?.dimensions)} emotion=${b?.emotion}`);
  line();

  ok(!!g && !!b, '三名学生都生成了 Evaluation');
  ok(g?.dimensions?.discipline === 100, `${good.name}（无违纪）纪律分应为 100，实际 ${g?.dimensions?.discipline}`);
  ok(b?.dimensions?.discipline === 100 - 2 * 10 - 1, `${bad.name}（2 违纪 + 扣1分）纪律分应为 79，实际 ${b?.dimensions?.discipline}`);
  ok(g?.dimensions?.participation === 100, `${good.name}（举手3次）参与度应为 100，实际 ${g?.dimensions?.participation}`);
  ok(b?.dimensions?.participation === 70, `${bad.name}（举手0次）参与度应为 70，实际 ${b?.dimensions?.participation}`);
  ok(g?.dimensions?._sources?.homework === 'submission', '作业分来源应为 submission');
  ok(b?.emotion === 'negative', `${bad.name} 情绪应为 negative，实际 ${b?.emotion}`);

  // 确定性：再打一次分，结果必须完全一致
  const again = await evaluations.scoreAfterLesson(record.id);
  const g2 = again.find((e: any) => e.studentId === good.id) as any;
  ok(g2?.score === g?.score, `重复打分结果一致（无随机性）：${g?.score} vs ${g2?.score}`);

  // ---------- 4. 预警 ----------
  line();
  line('=== 学生预警扫描 ===');
  const scan = await alerts.scan(klass.grade.schoolId);
  line(`  扫描：${scan.scannedStudents} 名学生，新增 ${scan.createdAlerts} 条预警`);
  const alertRows = await prisma.studentAlert.findMany({
    where: { studentId: { in: students.map((s) => s.id) } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  for (const a of alertRows) {
    line(`  [${a.level}] ${a.type} — ${a.content}`);
  }
  ok(Array.isArray(alertRows), '预警表可读（未抛错）');

  // ---------- 5. 排名 ----------
  line();
  line('=== 班级排名 ===');
  const rank = await rankings.classRanking(klass.id);
  for (const r of rank.slice(0, 5)) {
    line(`  #${r.rank} ${r.name} ${r.score} 分`);
  }
  ok(rank.length > 0, '班级排名返回数据');
  ok(rank[0].score >= rank[rank.length - 1].score, '排名按分数降序');

  line();
  line(process.exitCode ? '❌ 存在未通过断言' : '✅ 全链路验证通过');
  await app.close();
}

main().catch((e) => {
  console.error('验证失败：', e);
  process.exit(1);
});
```

**Step 2: 运行脚本**

```bash
cd E:/AITeacher/backend
npx ts-node --transpile-only scripts/verify-evaluation-chain.ts
```

Expected: 全部 `✅`，最后一行 `✅ 全链路验证通过`

**Step 3: 若断言失败，回到 Task 1/2 修正**

常见失败：
- `participation !== 100` → 检查 `hand_raise` 事件的 `category` 是否为 `normal`，以及过滤条件是否用 `type`
- `discipline !== 100` → 检查是否误把 `focus` 算进了 violation

**Step 4: 提交**

```bash
git add backend/scripts/verify-evaluation-chain.ts
git commit -m "test(evaluations): 新增打分-情绪-预警-排名全链路验证脚本"
```

---

## 阶段 3：架构收敛

### Task 4: 视觉代码归属与虚假声明修正

**Files:**
- Modify: `edge-vision/README.md`
- Create: `classroom-client/vision-service/README.md`

**Step 1: 修正 `edge-vision/README.md`**

在文件开头插入：

```markdown
> ⚠️ **本项目为「模型训练 / 算法实验仓库」，不是生产实现。**
> 生产可用的视觉识别在 `classroom-client/vision-service/`（人脸检测、举手识别、纪律检测、麦克风阵列、双链路、教材 OCR 均已实现）。
> 本目录目标是验证 YOLO26-N + ByteTrack 的行为识别方案，**行为分类头尚未训练**（`src/detector.py` 中 `behavior` 字段为占位默认值 `focus`），
> 因此下文目录结构中提到的 `src/behavior_classifier.py` **尚不存在**，属规划项。
```

并把目录结构中 `behavior_classifier.py` 那一行改为：

```
│   ├── behavior_classifier.py  # 【规划中·尚未实现】行为分类
```

**Step 2: 新建 `classroom-client/vision-service/README.md`**

```markdown
# vision-service · 教室端视觉/音频服务（生产实现）

教室小盒子上运行的 Python 服务，负责本地感知并把结构化事件上报后端。

## 定位

**本目录是视觉能力的生产实现。** `edge-vision/`（仓库根）是 YOLO26 算法实验仓库，尚未产出可用的行为分类模型，两者不要混用。

## 模块

| 目录 | 文件 | 职责 |
|---|---|---|
| `face/` | `detector.py`、`recognizer.py` | 人脸检测与识别（学生到座、身份确认） |
| `behavior/` | `hand_raise.py`、`discipline.py` | 举手识别、纪律检测（说话/走动/睡觉/趴桌） |
| `audio/` | `mic_array.py` | 四麦阵列噪声检测 |
| `network/` | `monitor.py`、`ws_client.py` | 双链路切换（网线↔4G）、WebSocket 上报 |
| `ocr/` | `parse_textbook.py` | 教材扫描版 OCR 解析 |
| `main.py` | — | 服务入口 |

## 上报协议

- WebSocket `/ws` 命名空间，事件名 `event`，见 `backend/src/realtime/realtime.gateway.ts`
- HTTP 兜底：`POST /api/v1/lesson-records/:id/behavior`（写 `BehaviorEvent`）
- 行为事件需带 `category`：`normal` / `violation` / `violation_conditional`
  —— 后端打分依赖该字段区分正常行为与违纪行为，**务必正确上报**

## 运行

见 `config.ini` 与 `requirements.txt`；树莓派上由 systemd `ait-vision.service` 托管（见 `infra/pi/`）。
```

**Step 3: 提交**

```bash
git add edge-vision/README.md classroom-client/vision-service/README.md
git commit -m "docs: 明确 vision-service 为生产实现、edge-vision 为实验仓库，修正不存在的文件声明"
```

---

### Task 5: 标注 lesson-agent 为实验态

**Files:**
- Modify: `backend/src/lesson-agent/lesson.agent.service.ts`（顶部注释）
- Modify: `docs/development/lesson-agent.md`（状态标注）

**Step 1: 在 `lesson.agent.service.ts` 顶部加状态注释**

在文件最上方（import 之前）插入：

```ts
/**
 * ⚠️ 实验态（Experimental）—— 尚未接管生产上课流程
 *
 * 本模块是「讲稿驱动自动上课」的下一代实现（LangGraph 状态机 + 断点恢复），
 * 编排机制已完整验证，但**业务节点仍为占位**：
 *   - 点名：写死全员 present，未接人脸/签到真实数据
 *   - 讲授：讲稿为调用方传入的固定文本，未接课前预生成缓存
 *   - 答疑：无 Key 时走 mock
 *   - pendingEvents：未接边缘视觉事件
 *
 * 生产上课流程目前仍由 `lesson-records.service.ts` 承载，两套并存。
 * 切换前必须先补齐上述业务节点，否则是功能退化。
 *
 * 详见 docs/development/lesson-agent.md
 */
```

**Step 2: 在 `docs/development/lesson-agent.md` 的状态行后加提示**

把第 3 行的状态说明改为：

```markdown
> 落地日期：2026-09-26 · 状态：**实验态**（骨架已跑通验证，业务节点为占位，尚未接管生产上课流程）
>
> ⚠️ **与生产流程的关系**：当前教室上课仍由 `backend/src/lesson-records/lesson-records.service.ts` 承载。
> 本模块 `startLesson` **未被任何 controller 调用**。切换前需先补齐业务节点（见第九节「当前边界与后续」）。
```

**Step 3: 提交**

```bash
git add backend/src/lesson-agent/lesson.agent.service.ts docs/development/lesson-agent.md
git commit -m "docs(lesson-agent): 标注为实验态，明确与生产上课流程的关系"
```

---

### Task 6: 同步项目文档

**Files:**
- Modify: `docs/qa/PRD对照差异分析.md`（追加 0.7 节）
- Modify: `docs/product/开发实施方案与任务规划.md`（追加 六-补3 节）

**Step 1: 在 `PRD对照差异分析.md` 的 0.6 节后追加**

```markdown
### 0.7 数据地基修复（2026-09-30）

修复了课后打分函数的三个缺陷（详见 `docs/plans/2026-09-30-foundation-repair-design.md`）：

| 缺陷 | 原状 | 修复后 |
|---|---|---|
| participation 随机数 | `80 + random()*20` | 由 `BehaviorEvent(type=hand_raise)` 计数推导 |
| homework 随机数 | `85 + random()*15` | 由 `Submission.score`（同科最近 5 次）均分推导，无数据时用中性分 80 |
| discipline 反向扣分 | 全部行为事件（含 focus/hand_raise）都扣分，学生越专注分越低 | 仅 `category === 'violation'` 的事件与 Warning 扣分参与计算 |

打分逻辑已抽为纯函数 `backend/src/evaluations/lesson-scoring.ts` 并附单元测试；新增端到端验证脚本 `backend/scripts/verify-evaluation-chain.ts`。

> 影响面：`Evaluation.score` 是学生报告、班级/年级/跨校排名、`StudentProfile`、家长端成绩、预警引擎「成绩下滑」规则的共同输入源，本次修复后这些功能才建立在真实数据上。
```

**Step 2: 在 `开发实施方案与任务规划.md` 的 六-补2 节后追加**

```markdown
## 六-补3、数据地基修复（2026-09-30）

| 任务编号 | 任务名称 | 任务内容 | 进度 | 结果 | 测试结果 |
|---|---|---|---|---|---|
| D.01 | 打分链路接真实数据 | 抽取 `lesson-scoring.ts` 纯函数；participation 接举手事件、homework 接作业分、discipline 仅统计违纪事件 | ✅ | 消除 50% 随机噪声与反向扣分 | 单测 15 项通过 |
| D.02 | 端到端验证脚本 | `scripts/verify-evaluation-chain.ts` 造课→打分→情绪→预警→排名 | ✅ | 一条链跑通并可重复运行 | 脚本内断言全绿 |
| D.03 | 架构收敛 | 明确 vision-service 为生产实现、edge-vision 为实验仓库；标注 lesson-agent 为实验态 | ✅ | 消除重复实现与虚假 README 声明 | 文档核对 |
```

**Step 3: 提交**

```bash
git add docs/qa/PRD对照差异分析.md docs/product/开发实施方案与任务规划.md
git commit -m "docs: 记录数据地基修复"
```

---

## 完成标准

- [ ] `vitest run` 全绿（含 15 个新增打分用例）
- [ ] `tsc --noEmit` 0 错误
- [ ] `verify-evaluation-chain.ts` 输出 `✅ 全链路验证通过`
- [ ] `Evaluation.dimensions` 中不再存在随机来源
- [ ] 文档中不再有 `behavior_classifier.py` 的不实声明
- [ ] 每个 Task 独立提交
