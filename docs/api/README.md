# API 概览

本文档基于后端 `backend/src/**/*.controller.ts` 实际路由整理，全局前缀 `/api/v1`，实时接口以 Swagger 为准：<http://localhost:3000/api/docs>。

## 鉴权

- 除登录、微信登录、公开留资、官网公开配置、官网转化埋点、分享公开页外，所有接口都需要在请求头携带 `Authorization: Bearer <token>`。
- 登录接口：`POST /api/v1/auth/login`，入参 `{ username, password }`，返回 JWT。
- 写操作通过 `@Roles(...)` 限制角色：`super_admin` / `school_admin` / `grade_admin` / `subject_admin` / `teacher`。

## 全局约定

- 统一响应包 `{ code, data, message }`，`code === 0` 表示成功；下文「data：」均指该包中的 `data` 字段。
- **接口限流**（2026-10-10 新增）：默认 60 次/分/IP（环境变量 `RATE_LIMIT_PER_MIN` 可调），超限返回 HTTP 429。豁免：设备端点（`boxes/heartbeat`、`boxes/ota/latest`、`boxes/ota/report`、`vision/*`，高频机器调用）；分享公开页放宽至 120 次/分（朋友圈转发可能瞬时多人点开）。
- **软删除**（2026-10-10 首批落地）：Student / Class / Schedule / Assignment / Box / LessonPlan 六表的 `delete` 为软删除（写 `deletedAt`），查询自动过滤已删除行；`update` 将 `deletedAt` 置回 `null` 即恢复。其余表分批推进。

## 按模块分组的端点

### 认证与用户
- `POST /auth/login` 登录
- `GET /auth/profile` 当前用户

### 组织架构
- `GET/POST /schools`、`GET/PUT/DELETE /schools/:id`（Super）
- `GET /campuses/school/:schoolId`、`POST /campuses`、`PUT /campuses/:id`
- `GET /campuses/group-overview?schoolId=`（JWT；super_admin/group_admin/school_admin）跨校区汇总（PRD §3.32）。2026-10-10 变更：`summary` 新增 `satisfaction` 字段——满意度均值（1~5 分）或 null；口径为答卷 `SurveyResponse.answers` 内 `score` 字段（1~5 分）取平均，兼容顶层 `{ score }` / 嵌套 `{ q1: { score } }` / 字符串数字 `'4'` 三种形态，无有效分值的答卷整体跳过
- `GET/POST /grades`、`GET/PUT/DELETE /grades/:id`
- `GET/POST /classes`、`GET/PUT/DELETE /classes/:id`
- `GET/POST /students`、`GET/PUT/DELETE /students/:id`
- `GET/POST /users`、`GET/PUT/DELETE /users/:id`

### 教学
- `POST /textbooks/upload`、`GET /textbooks`、`GET/DELETE /textbooks/:id`、`POST /textbooks/:id/parse`
- `POST /lesson-plans/generate-outline`、`POST /lesson-plans/generate`、`GET /lesson-plans`、`GET/PUT/DELETE /lesson-plans/:id`、`POST /lesson-plans/:id/confirm`
- `POST /schedules`、`POST /schedules/auto`、`GET /schedules`、`GET /schedules/today/:boxId`、`GET/PUT/DELETE /schedules/:id`
- `POST/GET /agents`、`GET/PUT/DELETE /agents/:id`、`PATCH /agents/:id/style`
- `GET/POST /rooms`、`GET/PUT/DELETE /rooms/:id`
- `POST /boxes/register`、`POST /boxes/heartbeat/:serial`、`GET /boxes`、`GET /boxes/all`（Super）、`GET /boxes/ota/latest`、`POST /boxes/ota/report`、`GET /boxes/:serial`、`PUT /boxes/:id/assign-room`、`DELETE /boxes/:id`
- OTA 灰度发布/回滚/分组（2026-10-10 新增，PRD §4.4.1）：
  - `POST /boxes/ota/releases`（JWT；super_admin/group_admin）发布新版本到指定通道，body `{ version, packageUrl, checksum?, channel: 'canary'|'stable', note? }`
  - `POST /boxes/ota/rollback`（JWT；super_admin/group_admin）回滚指定通道，body `{ channel, rollbackToVersion, packageUrl, checksum?, note? }`
  - `PUT /boxes/:id/ota-group`（JWT；school_admin 及以上）设置盒子灰度分组，body `{ group: 'canary'|'stable' }`
  - `GET /boxes/ota/releases?channel=`（JWT；school_admin 及以上）发布历史，供回滚溯源
  - 配套：`Box` 加 `otaGroup` 字段；`GET /boxes/ota/latest` 优先读 OtaRelease（按盒子分组选通道），环境变量兜底
- `POST /lesson-records/start`、`POST /lesson-records/:id/end`、`POST /lesson-records/:id/behavior-event`、`POST /lesson-records/:id/attendance`、`GET /lesson-records`、`GET /lesson-records/:id`

### 作业与考试
- `POST /assignments/generate`、`POST /assignments`、`POST /assignments/:id/publish`、`GET /assignments`、`GET /assignments/student/:studentId`、`GET/PUT/DELETE /assignments/:id`、`POST /assignments/:id/submit/:studentId`、`POST /assignments/submission/:submissionId/grade`、`POST /assignments/submission/:submissionId/review`、`GET /assignments/review/pending`
- `POST/GET /question-bank`、`POST /question-bank/batch`、`PUT/DELETE /question-bank/:id`、`GET /question-bank/knowledge-points/:subjectId`
- `GET /wrong-questions/student/:studentId`、`GET /wrong-questions/stats/:studentId`、`GET /wrong-questions/weaknesses/:studentId?subjectId=&topN=10`、`DELETE /wrong-questions/:id`
- 全班学科薄弱分布（2026-10-10 新增，教师视角，PRD §3.25）：`GET /wrong-questions/class-distribution/:classId?topN=5`（JWT）→ data：`{ classId, studentCount, distribution: [{ knowledgePoint, studentCount, wrongCount, percentOfClass, students[] }], perStudent: [{ studentId, name, topKnowledgePoints[] }] }`。口径：逐生取薄弱画像前 topN 后跨学生聚合，按「多少学生在错」排序（`percentOfClass` 为全班学生中错该知识点的百分比）。
- `POST/GET /exams`、`GET /exams/:id`、`POST /exams/:id/generate-paper`、`POST /exams/paper/:paperId/lock`、`POST /exams/:id/cheat`、`POST /exams/:id/score`、`GET /exams/:id/analysis`

### 课堂与评估
- `POST /leaves/apply/:studentId`、`POST /leaves/:id/review`、`GET /leaves/pending/:schoolId`、`GET /leaves/student/:studentId`、`GET /leaves/on-leave/:studentId`
- `POST /evaluations/lesson/:recordId/score`、`GET /evaluations/student/:studentId/report`、`GET /evaluations/warnings`
- `GET /rankings/class/:classId`、`GET /rankings/grade/:gradeId`、`GET /rankings/class-performance/:classId`、`GET /rankings/grade-performance/:gradeId`、`GET /rankings/cross-school/:studentId`
- `GET /live/push/room/:roomId`、`GET /live/pull/room/:roomId`、`GET /live/pull/lesson/:scheduleId`
- 教师工作量（2026-10-10 新增，PRD §3.14）：
  - `GET /teachers/workload?schoolId=&days=30`（JWT；super_admin/group_admin/school_admin/grade_admin）→ data：`{ schoolId, windowDays, homework: { reviewedCount, pendingReviewCount, avgReviewHours }, leave: { reviewedCount, pendingCount, avgApprovalHours } }`——单校作业复核量/复核时效 + 请假审批量/审批时效；时效为 `reviewedAt - createdAt/submittedAt` 的平均小时数（无数据为 null）
  - `GET /teachers/workload/me?days=30`（JWT）→ data：`{ userId, windowDays, leaveReviewedCount, avgApprovalHours }`——教师个人请假审批明细

### 辅导与偏好
- `POST /tutoring/subscribe/:studentId`、`GET /tutoring/subscription/:studentId`、`GET /tutoring/subscriptions/school/:schoolId`、`POST /tutoring/cancel/:studentId`
- `POST /tutoring/devices/register`、`GET /tutoring/devices/:schoolId`、`POST /tutoring/devices/heartbeat/:serial`
- `POST /tutoring/session/start/:studentId`、`POST /tutoring/session/:sessionId/chat`、`POST /tutoring/session/:sessionId/end`、`GET /tutoring/history/:studentId`、`GET /tutoring/practice/:studentId`、`GET /tutoring/stats/:studentId`
- 学科专项练习（2026-10-10 新增，PRD §3.19）：朗读/默写/口语/听写四类专项
  - `POST /practice/record`（JWT）body `{ sessionId, practiceType: 'reading'|'dictation'|'oral'|'spelling', subject?, question, userAnswer, correctAnswer?, isCorrect? }`——提交一次练习，须关联有效辅导会话
  - `GET /practice/history?studentId=&type=`（JWT）专项练习历史，可按类型过滤（默认最近 100 条）
  - `GET /practice/stats?studentId=`（JWT）→ data：`{ types: [{ type, total, correctRate, lastAt }], readingStreakDays }`——分类型次数/正确率（`isCorrect` 为 null 的记录不计入正确率分母）+ 朗读打卡连续天数
  - 口径：复用 `PracticeRecord` 表，`practiceType` 区分专项类型；tutoring 自由问答不带该字段
- 近视提醒反馈（2026-10-10 新增，PRD §24.7）：
  - `POST /tutoring/myopia/:reminderId/rested`（JWT）body `{ studentId, rested: boolean }`——眼镜/手表端上报「是否按提醒休息」，写 `rested/restedAt`；提醒不属于该学生时报错
  - `GET /tutoring/myopia/:studentId/compliance`（JWT）→ data：`{ totalReminders, restedCount, complianceRate }`——依从率统计（已反馈的提醒中按提醒休息的百分比，无数据为 null）
- `GET/PUT /preferences/student/:studentId`

### 家校互动
- `POST /parent-messages`、`GET /parent-messages/pending`、`GET /parent-messages/mine`、`POST /parent-messages/:id/approve|reject|delivered`
- `GET /notifications`、`POST /notifications/:id/read`、`GET /notifications/unread-count`
- `POST /shares/student/:studentId`、`POST /shares/class/:classId`、`POST /shares/grade/:gradeId`、`POST /shares/school/:schoolId`、`GET /shares/public/:id`、`POST /shares/public/:id/lead`、`GET /shares/leads/list`
- 分享传播看板（2026-10-10 新增，PRD §3.29）：`GET /shares/dashboard/school/:schoolId?days=30`（JWT）→ data：`{ schoolId, windowDays, snapshotCount, totalVisits, totalLeads, conversionRate, byType: { [type]: { count, visits } }, trend: [{ date, visits }] }`——按学校聚合浏览量/留资数/转化率（留资数/浏览量，无浏览为 null）/按类型分布/按天趋势；快照归属经 Student→Class→Grade→schoolId 追溯
- `POST /parents/bind`、`GET /parents/me`、`GET /parents/:id`
- `POST /wechat/miniprogram-login`

### 商务与运营（多为 Super）
- `GET /subscriptions`、`GET /subscriptions/school/:schoolId`、`POST /subscriptions/school/:schoolId/renew`、`PUT /subscriptions/school/:schoolId/configure|disable|enable`
- `POST /leads/public`、`GET /leads`、`GET/DELETE /leads/:id`
- `POST/GET /surveys`、`GET /surveys/active`、`POST /surveys/:id/respond`、`GET /surveys/:id/stats`
- `GET /work-orders/stats`、`GET/POST /work-orders`、`GET/PUT/DELETE /work-orders/:id`、`PUT /work-orders/:id/status`
- `GET /dashboard/global`、`GET /dashboard/health`、`GET /dashboard/school/:schoolId`、`GET /dashboard/grade/:gradeId`、`GET /dashboard/class/:classId`
- `GET /dashboard/usage?days=30`（LLM 用量）、`GET /dashboard/roi?schoolId=`（成本 ROI 报表）
- `GET/POST /avatars`、`PUT /avatars/:id`、`POST /avatars/custom/:schoolId`

### 官网（site-config / tracking）
- `GET /site-config/public` 官网公开配置（无鉴权，官网首页/页脚读取：ICP 备案号、联系方式、数据背书数值）
- `GET /site-config`、`PUT /site-config` 官网配置读写（super_admin / group_admin，后台「官网设置」页）
- `POST /tracking/events` 官网转化埋点上报（无鉴权，event/page/referrer/utm*/meta，meta 白名单仅 company）

### 人脸库
- `POST /face-library/upload`、`GET /face-library/student/:studentId`、`GET /face-library/class/:classId`、`GET /face-library/school/:schoolId`、`POST /face-library/sync`、`GET /face-library/pull`、`POST /face-library/:id/feature`、`DELETE /face-library/:id`

### 视觉边缘服务（vision）
- `POST /vision/events`、`POST /vision/aggregates`、`GET /vision/lessons/:lessonRecordId/events`、`GET /vision/lessons/:lessonRecordId/aggregates`、`GET /vision/config?serial=`（`x-edge-token` 头鉴权，边缘设备高频机器调用，不限流）
- 2026-10-10 变更：`GET /vision/config?serial=` 响应新增 `lessonContext` 字段——按盒子序列号解析进行中的课次上下文（Box → 教室 → 进行中的课 → 班级/年级），为 `{ schoolId, gradeId, classId, lessonRecordId }` 或 `null`（当前无课/任一环节缺失），边缘端据此跳过聚合上报。`POST /vision/aggregates` 契约不变。

### 教室盒子 WebSocket（/ws 命名空间）
- 教室盒子以 socket.io 连接 `/ws`（query 带 `serial`），上行 `event` 消息体 `{ event, data, timestamp }`，支持的事件类型：`attendance`、`hand_raise`、`discipline`、`noise`、`late`、`early_leave`、`sleep`、`heartbeat`。
- 2026-10-10 新增 `help_key`（桌位求助键，PRD §3.37）：data `{ studentId?, seatNo?, deviceSerial? }`（桌位键可绑定学生也可匿名）。服务端落 `BehaviorEvent(type=help_request)`（进行中课次存在时）并向该教室回发 `help_key_notice`（data 同上行），教师屏幕弹求助提醒。

### 学生预警（§3.10）
- `GET /alerts?schoolId=&type=&level=&status=&page=&pageSize=`：预警列表
- `GET /alerts/stats?schoolId=`：按类型/等级聚合统计
- `GET /alerts/student/:studentId`：某学生预警历史
- `POST /alerts/scan?schoolId=`：手动触发扫描（仅 super_admin / group_admin）
- `POST /alerts/:id/handle`：处理预警，body `{ status: 'handled' | 'ignored' }`
