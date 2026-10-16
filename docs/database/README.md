# 数据库表说明

本文档基于 `backend/prisma/schema.prisma` 实际 model 整理，按业务域分组。共 51 个 model。

数据库：PostgreSQL 16，连接串见 `backend/.env` 的 `DATABASE_URL`。

## 组织架构域

| 表（model） | 用途 |
|---|---|
| `School` | 学校/租户，含省市区、联系人、状态、到期时间 |
| `Campus` | 学校下的校区（多校区） |
| `Grade` | 年级（高一/高二…），可挂校区 |
| `Class` | 班级（1班/2班…），挂年级 |
| `Subject` | 全局科目字典（语文/数学/英语…） |
| `User` | 管理后台账号，角色：super_admin / school_admin / grade_admin / subject_admin / teacher |

## 学生家长域

| 表 | 用途 |
|---|---|
| `Student` | 学生，挂班级，学号唯一 |
| `Parent` | 家长绑定，微信 openid 唯一 |
| `ParentMessage` | 家长给孩子留言，待审/通过/驳回/已转达 |

## 教学域

| 表 | 用途 |
|---|---|
| `Textbook` | 教材文件 + 解析章节，挂学校和科目 |
| `LessonPlan` | 教案（PPT 大纲+讲稿+提问），状态 draft/confirmed/locked |
| `Agent` | 授课/辅导 Agent，绑定学校和科目 |
| `Schedule` | 课表，关联班级/Agent/教案/教室 |
| `Room` | 教室 |
| `Box` | 教室小盒子（含摄像头/麦克风/4G/求助键等子设备），状态与故障码 |

## 作业域

| 表 | 用途 |
|---|---|
| `Assignment` | 作业单，状态 draft/confirmed/published/closed |
| `Submission` | 学生作业提交，含分数、评语、状态 |
| `QuestionBank` | 题库题目（选择/填空/作文/计算） |
| `WrongQuestion` | 学生错题本 |

## 考试域

| 表 | 用途 |
|---|---|
| `Exam` | 考试（月考/期中/期末） |
| `Paper` | 试卷内容（JSON），状态 draft/confirmed/locked |
| `Score` | 学生考试成绩与排名 |
| `ExamCheat` | 作弊记录（证据截图） |

## 课堂域

| 表 | 用途 |
|---|---|
| `LessonRecord` | 实际上课记录（开始/结束、课堂总结） |
| `BehaviorEvent` | 课堂行为事件（说话/走动/睡觉/迟到等） |
| `Attendance` | 考勤（出勤/缺席/迟到/早退） |
| `Leave` | 学生请假申请与审批 |
| `Warning` | 课堂纪律警告与扣分 |
| `MyopiaReminder` | 近视休息提醒记录 |

## 评估域

| 表 | 用途 |
|---|---|
| `Evaluation` | 每节课每学生的多维度评分与评语 |
| `StudentProfile` | 学生综合画像（总分、排名、趋势、强弱项） |
| `StudentPreference` | 学生个性化偏好（风格/语速/近视提醒） |

## 商务域

| 表 | 用途 |
|---|---|
| `Subscription` | 学校订阅套餐与有效期 |
| `UsageLog` | 用量日志（LLM token / 存储 / 带宽 / 辅导时长） |
| `WorkOrder` | 售后工单（设备维修/订阅/网络/软件） |

## 分享与获客

| 表 | 用途 |
|---|---|
| `ShareSnapshot` | 成绩分享快照（学生/班级/年级/学校） |
| `Lead` | 官网/分享页留资线索 |

## 官网域

| 表 | 用途 |
|---|---|
| `SiteConfig` | 官网公开配置（单行）：ICP 备案号 / 咨询电话 / 工作时间 / 微信公众号 / 二维码 URL / 数据背书数值，后台可配置、未备案时官网隐藏备案位 |
| `TrackingEvent` | 官网转化埋点事件（pageview / lead_submit），含来源 referrer 与 utm 参数，meta 白名单仅 company |

## 问卷域

| 表 | 用途 |
|---|---|
| `Survey` | 家长满意度问卷 |
| `SurveyResponse` | 问卷回答 |

## 通知与辅导

| 表 | 用途 |
|---|---|
| `Notification` | 站内通知 |
| `TutoringSession` | 辅导会话 |
| `TutoringMessage` | 辅导对话消息 |
| `PracticeRecord` | 学科专项练习记录 |
| `TutoringSubscription` | 学生辅导服务订阅（配发眼镜/手表） |

## 设备与数字人

| 表 | 用途 |
|---|---|
| `Device` | 通用设备（摄像头/麦克风/眼镜/手表/求助键） |
| `DigitalAvatar` | 数字人形象（通用/学校定制，含价格） |
| `FacePhoto` | 学生人脸照片与特征向量，下发教室盒子 |
