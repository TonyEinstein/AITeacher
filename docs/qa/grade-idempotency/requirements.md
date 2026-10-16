# 需求记录

## 可验收行为

1. R1 重复批改幂等：对同一 submission 连续调用两次 `POST /assignments/submission/{id}/grade` 后，该学生在错题本中对应这批题目的错题记录总数与调用一次时相同（不重复累加）。
2. R2 首次批改正常归集：首次调用 grade 后，错题本中为该 submission 的每道错题各生成一条 `WrongQuestion` 记录，字段（studentId/question/userAnswer/correctAnswer/knowledgePoint/subjectId）完整。
3. R3 已复核状态不被破坏：若某条 submission 先被 grade 为 `graded`，再被 teacher review 为 `reviewed`，再次调用 grade 时不得重新生成错题或把状态改回 `graded`；本条作为约束，本次实现以「grade 前清理旧错题」为准，状态机保护由后续需求覆盖。

## 不做的范围

- 不改数据库 schema（不在 `WrongQuestion` 增加 submissionId/assignmentId）。
- 不改 LLM 主观题评分逻辑与分值计算。
- 不改前端页面与路由。

## 待确认歧义

- 无歧义。实现方案采用「按 studentId + subjectId + question 文本清理旧错题后再写入」，在现有 schema 下做到幂等；若后续需要精确到 submission 的追溯，再评估加字段。
