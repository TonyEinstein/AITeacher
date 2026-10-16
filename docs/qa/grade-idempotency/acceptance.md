# 验收记录

## 需求-验收对照

| 需求编号 | 验收动作 | 命令 | 期望结果 | 实际结果 | 退出码 |
|----------|----------|------|----------|----------|--------|
| R1 重复批改幂等 | 运行 grading.service.spec.ts 中的重复批改用例 | `<python> .stagegate\run-test.py` | 第二次调用仍只生成 2 条错题记录 | 通过 | 0 |
| R2 首次批改正常归集 | 运行 grading.service.spec.ts 中的首次批改用例 | 同上 | 为错题生成 WrongQuestion，字段完整 | 通过 | 0 |
| R3 状态保护约束 | 代码审查确认 gradeSubmission 不修改 submission.status 之外的状态机 | 人工审查 `grading.service.ts` | 不破坏 reviewed 状态 | 通过 | - |

## 测试摘要

- 测试文件：`backend/src/assignments/grading.service.spec.ts`
- 用例数：3
- 通过：3
- 失败：0

## 结论

所有验收项通过，可进入收尾阶段。
