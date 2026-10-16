# 实现记录（先红后绿）

## T1 增加 grade 幂等性并补测试

- red：`npm run test -- src/assignments/grading.service.spec.ts` 退出码 1，3 个用例均失败；
  失败原因：`GradingService.gradeSubmission` 在写入 `WrongQuestion` 前未清理旧错题，
  导致 `prisma.wrongQuestion.deleteMany` 期望被调用 1 次/2 次，实际 0 次。
- green：在 `backend/src/assignments/grading.service.ts` 的「错题本归集」逻辑前，
  先按 `studentId + subjectId（若不为 null）+ question in [...]` 删除旧错题，再创建新错题；
  重新运行测试，退出码 0，3 个用例全部通过。
