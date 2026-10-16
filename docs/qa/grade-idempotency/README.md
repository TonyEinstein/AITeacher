# 作业批改幂等 —— 门禁记录（归档）

本目录归档「`AITeacher-grade-idempotency`」小任务的七阶段门禁产物（原位于仓库根 `records/`、`pipeline.json`）。

- **对应代码提交**：`7bd5cca`（`backend/src/assignments/grading.service.ts` + `grading.service.spec.ts`）
- **归档日期**：2026-10-09

## 文件说明

| 文件 | 内容 |
|---|---|
| `requirements.md` | 需求探索：可验收行为与不做范围 |
| `test_log.md` | TDD 实现记录（先红后绿） |
| `review.md` | 代码审查结论 |
| `acceptance.md` | 结果验证：逐条对齐需求编号 |
| `wrapup.md` | 分支收尾：diff 复查结论与遗留风险 |
| `交付报告.md` | 七阶段总报告 |
| `pipeline.json` | 门禁流程状态与证据 |

> ⚠️ `pipeline.json` 中的 `records/*.md` 路径是**该次运行时的原始布局**（文件当时在仓库根 `records/`），收录本目录后未改写。查文件请以本目录实际内容为准。
>
> 设计/实施阶段被门禁标记为「跳过」（`design`/`plan`），因该任务走快速通道（改动 2 文件且无接口变更）。
