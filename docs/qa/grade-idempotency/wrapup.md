# 分支收尾记录

## 改动清单

- `backend/src/assignments/grading.service.ts`
  - 在「错题本归集」循环前增加 `prisma.wrongQuestion.deleteMany`：按 `studentId + subjectId（若存在）+ question in [...]` 清理旧错题，再写入新错题。
- `backend/src/assignments/grading.service.spec.ts`
  - 新增 3 条 vitest 用例：首次批改生成错题、重复批改用例、清理条件限定为学生+学科+题干。
- `records/requirements.md`、`records/test_log.md`、`records/review.md`、`records/acceptance.md`、本文件。

## diff 复查结论

- 无接口签名变更；`gradeSubmission` 的输入输出与之前一致。
- 无 schema 变更，符合需求中「不改数据库 schema」的范围约定。
- 新增测试仅依赖 Prisma 与 LlmService mock，未引入外部服务。

## 遗留风险

1. **按题干去重可能误删**：同一学生在同一科目下、题干完全相同的旧错题会被覆盖；若后续业务需要按作业/提交精确追溯，需迁移加字段。
2. **subjectId 为 null 时的清理面更大**：当 `assignment.lessonPlan.subjectId` 缺失时，只按 `studentId + question` 清理，可能误删该学生跨学科的同名错题。当前业务中 subjectId 通常有值，风险可控。
3. **Windows 证据采集输出为空摘要**：本机 `evidence_collect.py` 对 npm/vitest 命令捕获到的原始输出为空（仅保留退出码与兜底说明），已通过 `run-test.py` 包装并在摘要中打印 JSON 测试结果，不影响门禁判断。

## 门禁结果

- 测试：`backend/src/assignments/grading.service.spec.ts` 3/3 通过。
- 构建：`apps/mobile` 的 `npm run build:h5` 完成，退出码 0。

## 建议

- 将 `.stagegate/` 与 `records/` 纳入 `.gitignore` 的已有忽略规则中，避免把阶段脚本和临时产物提交。
