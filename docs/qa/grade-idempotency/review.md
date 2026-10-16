# 代码审查记录

## 审查范围

- `backend/src/assignments/grading.service.ts`（幂等性修复）
- `backend/src/assignments/grading.service.spec.ts`（新增单测）

## 发现的问题

1. **类型安全可加强** `grading.service.ts:102-110`
   - 问题：`deleteMany` 的 `where` 使用了 `any`，虽然是为了条件插入 `subjectId`，但会绕过 Prisma 类型检查。
   - 处置：接受。当前 schema 下 `subjectId` 可能为 `null`，需要动态构造查询条件；已在注释中说明意图，后续若加入 `submissionId` 字段可一并改为强类型。

2. **测试断言依赖实现细节** `grading.service.spec.ts:50-86`
   - 问题：用例直接断言 `deleteMany` 被调用 1/2 次，并检查 where 条件，属于白盒测试；若未来把“清理”改成 upsert，断言会失效。
   - 处置：接受。本次修复的核心就是“先删再写”，这个调用顺序是需求行为的一部分；同时 R2 用例验证了最终生成的错题字段，两者互补。

3. **幂等键为题目文本，存在误删风险** `grading.service.ts:102`
   - 问题：按 `studentId + subjectId + question` 清理，会同时删掉该学生在同科目下、题干完全相同的旧错题（即使来自不同作业）。
   - 处置：记录为已知限制。`records/requirements.md` 已明确本次不改 schema、不加 `submissionId`；若后续需要精确追溯，再评估迁移。

## 被否决的备选方案

- **备选方案**：在 `WrongQuestion` 表中增加 `submissionId` 或 `assignmentId`，重复批改时按 submission 精确删除旧记录。
- **否决理由**：用户要求不修改数据库 schema、不引入额外依赖；且当前生产环境数据可通过 `studentId + subjectId + question` 实现业务上的幂等（同一学生同一科目同题干视为同一道错题）。

## 结论

- 阻断级问题数：0
- 代码可合并，进入验证阶段。
