# AI-Teacher 管理后台核对报告 — school_admin（学校管理员）

- **测试角色**：school_admin
- **登录账号**：GZ001_admin / 123456
- **绑定学校**：广州市第一中学（schoolId=2，code=GZ001，userId=4）
- **后端 API**：http://localhost:3000/api/v1
- **数据库**：PostgreSQL 16 @ 127.0.0.1:5432/ai_teacher
- **测试时间**：2026-09-22
- **测试方法**：node 脚本发 HTTP 请求 + Prisma 直接查库确认落库；写测试数据统一用「核对测试/E2E」前缀，测试后已全部清理（0 残留）。
- **响应包络**：统一 `{code, data, message}`；HTTP 200/201 = 业务成功，403 = 鉴权/数据越权拦截，500 = 服务端错误。

## 一、结论速览

| 维度 | 结果 |
|------|------|
| 登录 | ✅ 201，返回 token + user.schoolId=2 |
| 21 页 GET 加载 | ✅ 15 页正常；⚠️ 6 页因接口限制 super_admin 返回 403 |
| 组织架构 CRUD（核心） | ✅ 年级/班级/学生/用户 增删改查全部落库验证通过 |
| 数据隔离 | ✅ DataScopeGuard 生效：跨校 schoolId/classId/gradeId/box 一律 403「数据越权」 |
| 本校设备隔离 | ✅ GET /boxes?schoolId=2 仅返回本校 3 个盒子（全库共 15 个） |
| 写操作落库 | ✅ 18 项写操作逐项查库确认；4 项越权写被 403 拦截 |
| 关键 Bug | ⚠️ 6 个页面后端接口仅 super_admin 可访问，school_admin 无法加载（见 Bug 清单） |

---

## 二、逐页核对（GET 数据加载）

| # | 前端路由 | 页面 | 主要 GET 接口 | HTTP | 数据结果 | 备注 |
|---|---------|------|--------------|------|---------|------|
| 1 | /dashboard | 首页 | GET /dashboard/school/2 | 200 | students=72, classes=9, grades=3, teachers=3, devices{total:3,online:2}, pendingReview=0，含各年级分布 | ✅ 正常 |
| 2 | /schools | 学校管理 | GET /schools | **403** | message=权限不足 | ⚠️ 列表接口仅 super_admin；school_admin 看不到列表 |
| 2 | /schools | 学校管理 | GET /schools/2 | 200 | 返回本校详情（name=广州市第一中学, status=active） | ✅ 本校详情可看 |
| 3 | /organization | 组织架构 | GET /grades?schoolId=2 | 200 | 3 个年级（高一/高二/高三），含嵌套班级 | ✅ |
| 3 | /organization | 组织架构 | GET /classes?gradeId=3 | 200 | 3 个班级，含嵌套学生 | ✅ |
| 3 | /organization | 组织架构 | GET /students?classId=3 | 200 | 8 名学生 | ✅ |
| 3 | /organization | 组织架构 | GET /users?schoolId=2 | 200 | 3 名本校用户（admin/年级主任/教研组长） | ✅ |
| 4 | /textbooks | 教材教案 | GET /textbooks?schoolId=2 | 200 | 0 条 | ✅ 正常（空数据） |
| 4 | /textbooks | 教材教案 | GET /lesson-plans?textbookId=999 | 200 | 0 条 | ✅ 正常 |
| 5 | /schedules | 课表 | GET /schedules?classId=3 | 200 | 0 条 | ✅ 正常（空数据） |
| 6 | /assignments | 作业复核 | GET /assignments?classId=3 | 200 | 0 条 | ✅ 正常 |
| 6 | /assignments | 作业复核 | GET /assignments/review/pending?schoolId=2 | 200 | 0 条待复核 | ✅ 正常 |
| 7 | /exams | 考试 | GET /exams?schoolId=2 | 200 | 0 条 | ✅ 正常（空数据） |
| 8 | /live | 巡课 | GET /live/pull/room/1 | 200 | 返回 streamKey=room-1 及 flv/hls/webrtc/rtmp 拉流地址 | ✅ 接口正常（实际流取决于 SRS） |
| 9 | /reports | 报表 | GET /rankings/grade/3 | 200 | 24 名学生排名（score 均为 0） | ✅ 正常 |
| 9 | /reports | 报表 | GET /evaluations/warnings?schoolId=2 | 200 | 0 条预警 | ✅ 正常 |
| 10 | /devices | 设备 | GET /boxes?schoolId=2 | 200 | 本校 3 个盒子（GZ001-BOX1/2/3），含 room 关联 | ✅ 仅本校 |
| 10 | /devices | 设备 | GET /rooms?schoolId=2 | 200 | 3 个教室，含嵌套盒子 | ✅ |
| 11 | /tutoring | 辅导 | GET /tutoring/subscriptions/school/2 | 200 | 0 条订阅 | ✅ 正常 |
| 12 | /leave-approval | 请假 | GET /leaves/pending/2 | 200 | 0 条待审批 | ✅ 正常 |
| 13 | /question-bank | 题库 | GET /question-bank | 200 | 0 条 | ✅ 正常 |
| 14 | /agents | AI教师 | GET /agents?schoolId=2 | 200 | 0 条 | ✅ 正常 |
| 15 | /avatars | 数字人 | GET /avatars?schoolId=2 | 200 | 1 个平台公共数字人 | ✅ 正常 |
| 16 | /surveys | 问卷 | GET /surveys/active | 200 | 活动问卷列表 | ✅ 正常 |
| 17 | /leads | 留资 | GET /leads | **403** | message=权限不足 | ⚠️ 仅 super_admin |
| 18 | /subscription | 订阅 | GET /subscriptions/school/2 | **403** | message=权限不足 | ⚠️ 仅 super_admin（学校有 pro 订阅却无法查看） |
| 19 | /work-orders | 工单 | GET /work-orders | **403** | message=权限不足 | ⚠️ 仅 super_admin |
| 19 | /work-orders | 工单 | GET /work-orders/stats | **403** | message=权限不足 | ⚠️ 仅 super_admin |
| 20 | /device-monitor | 设备监控 | GET /boxes/all | **403** | message=权限不足 | ⚠️ 页面调用的全量接口仅 super_admin |
| 21 | /health | 学校健康 | GET /dashboard/health | **403** | message=权限不足 | ⚠️ 仅 super_admin |

---

## 三、写操作 + 数据库落库验证

> 每项均：HTTP 调用 → 用 Prisma 查库确认记录存在/字段已变。测试数据前缀「核对测试/E2E」，验证后已删除。

| 页面 | 操作 | API 端点 | HTTP | 数据结果 | 数据库验证 |
|------|------|---------|------|---------|-----------|
| 3 组织架构 | 新建年级 | POST /grades | 201 | name=核对测试年级E2E, schoolId=2 | ✅ DB grade 存在，schoolId=2 |
| 3 组织架构 | 新建班级 | POST /classes | 201 | name=核对测试班E2E | ✅ DB class 存在，gradeId 指向新年级 |
| 3 组织架构 | 新建学生 | POST /students | 201 | studentNo=CHK-E2E-S001 | ✅ DB student 存在 |
| 3 组织架构 | 新建用户(教师) | POST /users | 201 | role=teacher, schoolId=2 | ✅ DB user 存在，密码已 bcrypt 加密 |
| 3 组织架构 | 更新年级 | PUT /grades/:id | 200 | name 改为「…改」 | ✅ DB name=核对测试年级E2E改 |
| 3 组织架构 | 更新班级 | PUT /classes/:id | 200 | name 改为「…改」 | ✅ DB name 已变 |
| 3 组织架构 | 更新学生 | PUT /students/:id | 200 | name 改为「…改」 | ✅ DB name 已变 |
| 3 组织架构 | 更新用户 | PUT /users/:id | 200 | phone=13900001111 | ✅ DB phone 已落库 |
| 3 组织架构 | 删除学生 | DELETE /students/:id | 200 | 返回被删记录 | ✅ DB 记录已不存在 |
| 3 组织架构 | 删除班级 | DELETE /classes/:id | 200 | 返回被删记录 | ✅ DB 记录已不存在 |
| 3 组织架构 | 删除年级 | DELETE /grades/:id | 200 | 返回被删记录 | ✅ DB 记录已不存在 |
| 3 组织架构 | 删除用户 | DELETE /users/:id | 200 | 返回被删记录 | ✅ DB 记录已不存在 |
| 10 设备 | 新建教室 | POST /rooms | 201 | code=CHK-E2E-R1 | ✅ DB room 存在 |
| 10 设备 | 注册盒子 | POST /boxes/register | 201 | serial=CHK-E2E-B1, status=offline | ✅ DB box 存在，schoolId=2 |
| 10 设备 | 分配教室 | PUT /boxes/:id/assign-room | 200 | roomId=新教室 | ✅ DB box.roomId 已更新 |
| 10 设备 | 删除盒子/教室 | DELETE /boxes/:id, /rooms/:id | 200 | — | ✅ DB 记录已删除 |
| 5 课表 | 新建课表 | POST /schedules | 201 | classId=3, status=scheduled | ✅ DB schedule 存在 |
| 5 课表 | 更新课表 | PUT /schedules/:id | 200 | status=cancelled | ✅ DB status 已变 |
| 5 课表 | 自动排课 | POST /schedules/auto | 201 | lessonPlanIds=[] → 0 条 | ✅ 空入参正常返回空数组 |
| 5 课表 | 删除课表 | DELETE /schedules/:id | 200 | — | ✅ DB 已删除 |
| 6 作业复核 | 新建作业 | POST /assignments | 201 | status=draft | ✅ DB assignment 存在 |
| 6 作业复核 | 发布作业 | POST /assignments/:id/publish | 201 | status=published | ✅ DB status=draft→published |
| 6 作业复核 | AI 生成作业 | POST /assignments/generate | 400 | message=教案不存在 | 无 lessonPlan，未触达 LLM；依赖外部 LLM |
| 7 考试 | 新建考试 | POST /exams | 201 | status=scheduled | ✅ DB exam 存在 |
| 7 考试 | AI 组卷 | POST /exams/:id/generate-paper | 201 | 201 但 content.raw=「【开发环境模拟】…请配置 LLM API Key」 | ⚠️ LLM 未配置，落库为模拟空卷 |
| 7 考试 | 锁卷(不存在) | POST /exams/paper/99999/lock | **500** | 服务器内部错误 | 见 Bug #8（应返回 404） |
| 12 请假 | 请假申请 | POST /leaves/apply/6 | 201 | status=pending | ✅ DB leave 存在 |
| 12 请假 | 审批请假 | POST /leaves/:id/review | 201 | approved=true, reviewerId=4 | ✅ DB status=pending→approved |
| 13 题库 | 新建题目 | POST /question-bank | 201 | answer=A | ✅ DB questionBank 存在 |
| 13 题库 | 更新题目 | PUT /question-bank/:id | 200 | answer=B | ✅ DB answer 已变 |
| 13 题库 | 删除题目 | DELETE /question-bank/:id | 200 | — | ✅ DB 已删除 |
| 14 AI教师 | 新建AI教师 | POST /agents | 201 | style=gentle | ✅ DB agent 存在 |
| 14 AI教师 | 更新风格 | PATCH /agents/:id/style | 200 | style=humorous | ✅ DB style 已变 |
| 14 AI教师 | 删除AI教师 | DELETE /agents/:id | 200 | — | ✅ DB 已删除 |
| 15 数字人 | 新建数字人 | POST /avatars | 201 | isCustom=false | ✅ DB digitalAvatar 存在 |
| 15 数字人 | 定制数字人 | POST /avatars/custom/2 | 201 | isCustom=true, schoolId=2 | ✅ DB 落库 schoolId=2 |
| 16 问卷 | 新建问卷 | POST /surveys | 201 | status=active | ✅ DB survey 存在 |
| 11 辅导 | 订阅辅导 | POST /tutoring/subscribe/6 | 201 | status=active, endDate=+1月 | ✅ DB tutoringSubscription 存在 |
| 11 辅导 | 注册穿戴设备 | POST /tutoring/devices/register | 201 | serial=CHK-E2E-G1, type=glasses | ✅ DB device 存在 |
| 11 辅导 | 取消辅导 | POST /tutoring/cancel/6 | 201 | status=cancelled | ✅ DB status=active→cancelled |
| 17 留资 | 删除留资 | DELETE /leads/1 | **403** | 权限不足 | ✅ 越权写被正确拦截（super_admin 专属） |
| 18 订阅 | 停用订阅 | PUT /subscriptions/school/2/disable | **403** | 权限不足 | ✅ 越权写被正确拦截 |
| 18 订阅 | 续订订阅 | POST /subscriptions/school/2/renew | **403** | 权限不足 | ✅ 越权写被正确拦截 |
| 19 工单 | 创建工单 | POST /work-orders | **403** | 权限不足 | ✅ 越权写被正确拦截 |

---

## 四、数据隔离专项验证（特别关注项）

| 检查项 | 请求 | 预期 | 实际 | 结论 |
|--------|------|------|------|------|
| 跨校查用户 | GET /users?schoolId=1 | 403 | 403「数据越权：无权访问其他学校的数据」 | ✅ |
| 跨校查年级 | GET /grades?schoolId=1 | 403 | 403「数据越权」 | ✅ |
| 跨校查盒子 | GET /boxes?schoolId=1 | 403 | 403「数据越权」 | ✅ |
| 跨校建年级 | POST /grades {schoolId:1} | 403 | 403「数据越权」 | ✅ |
| 本校盒子范围 | GET /boxes?schoolId=2 | 仅本校 | 返回 3 个本校盒子（全库 15 个，其余 12 个属其他校） | ✅ |
| 学校列表 | GET /schools | 仅本校 | **403**（接口本身 super_admin 专属） | ⚠️ 见 Bug #1 |

> 隔离机制：`DataScopeGuard`（src/auth/guards/data-scope.guard.ts）按 schoolId/classId/gradeId/studentId/roomId/boxId/serial 解析归属，非本校一律 403；super_admin 放行。该校验对读、写均生效。

---

## 五、Bug 清单

| # | 严重度 | 页面 | 现象 | 根因/位置 | 建议 |
|---|--------|------|------|----------|------|
| 1 | 高 | /schools 学校管理 | school_admin 调用 GET /schools 返回 403，页面无法加载学校列表 | schools.controller.ts `@Get() @Roles('super_admin')` | 放开 school_admin 的列表查询，或在 service 内强制按 token.schoolId 过滤仅返回本校；前端可改调 GET /schools/:id |
| 2 | 高 | /device-monitor 设备监控 | 页面调用 GET /boxes/all 返回 403，无法加载 | boxes.controller.ts `@Get('all') @Roles('super_admin')` | school_admin 应改用 GET /boxes?schoolId=<本校>（已验证仅返回本校盒子）；前端按角色切换接口 |
| 3 | 高 | /leads 留资 | GET /leads、DELETE /leads/:id 均 403，页面不可用 | leads.controller.ts 全部 `@Roles('super_admin')` | 若 school_admin 需要看本校留资，应放开并按 schoolId 过滤 |
| 4 | 高 | /subscription 订阅 | GET /subscriptions/school/2 及 renew/configure/disable/enable 全 403，学校连自己的 pro 订阅都看不到 | subscriptions.controller.ts 全部 `@Roles('super_admin')` | school_admin 至少应可读本校订阅状态；变更类可仍留 super_admin |
| 5 | 高 | /work-orders 工单 | GET /work-orders、/stats、POST、PUT、status、DELETE 全 403 | work-orders.controller.ts 全部 `@Roles('super_admin')` | school_admin 通常需本校报障/跟进，应放开本校工单读写 |
| 6 | 中 | /health 学校健康 | GET /dashboard/health 返回 403 | dashboard.controller.ts `@Get('health') @Roles('super_admin')` | 学校健康页若面向 school_admin，应放开或提供校级维度接口 |
| 7 | 中 | 全局 | 删除/更新**不存在**的记录返回 HTTP 500「服务器内部错误」，而非 404 | 各 service 直接 Prisma delete/update，P2025 未捕获；AllExceptionsFilter 统一兜底为 500 | 捕获 P2025 抛 NotFoundException → 404；前端据此区分"网络错误/无权限/不存在" |
| 8 | 低 | /exams 考试 | 锁卷不存在 paperId 返回 500（同 #7 根因） | exams.service.lockPaper 未处理记录不存在 | 同 #7 |
| 9 | 低 | /avatars | list 接口未挂 JwtAuthGuard（类级无 @UseGuards，仅 listActive 类外） | avatars.controller.ts 类上无守卫 | 数字人列表应走登录态 |

> 说明：Bug #1–#6 本质一致——**这些后端接口的角色白名单只写了 super_admin，未纳入 school_admin**，与任务要求"school_admin 应能访问全部 21 页"冲突。组织架构、设备、课表、作业、考试、请假、题库、AI 教师、数字人、问卷、辅导等核心页面均已正常。

---

## 六、依赖外部服务未验证项

| 类别 | 接口 | 状态 | 说明 |
|------|------|------|------|
| MinIO（未启动） | POST /textbooks/upload（教材上传） | 未验证 | 服务端启动日志已报「MinIO 连接失败，文件上传功能暂不可用」 |
| MinIO | 人脸照片上传 / 作业拍照提交 POST /assignments/:id/submit/:sid（file 字段） | 未验证 | 依赖 MinIO 存储 |
| LLM（未配置） | POST /lesson-plans/generate、generate-outline（教案生成） | 未验证 | 需先有 textbook（依赖 MinIO 上传）；且 LLM 未配置 |
| LLM（未配置） | POST /assignments/generate（AI 出题） | 未验证 | 需 lessonPlan；未配置时返回模拟内容 |
| LLM（未配置） | POST /exams/:id/generate-paper（AI 组卷） | 已调用但为模拟 | 返回 201，content.raw=「【开发环境模拟】AI 生成内容，请配置 LLM API Key 后使用真实功能」，questions 为空 |
| LLM（未配置） | POST /tutoring/session/:sid/chat（辅导对话） | 未验证 | 依赖 LLM |
| SRS（流媒体） | GET /live/pull/room/:id 实际拉流播放 | 接口正常，流未验证 | 接口返回 flv/hls/webrtc 地址，但未确认 SRS 服务运行及实际可播放 |
| 微信 | 作业发布后微信订阅消息推送 | 未验证 | wechat.notifyHomework 异步调用，未校验外部微信服务 |

---

## 七、测试数据清理

- 本次创建的年级/班级/学生/用户/教室/盒子/课表/作业/考试/题库/AI教师/数字人/问卷/穿戴设备/请假/辅导订阅等记录，均已通过对应 DELETE 接口或 Prisma 清理。
- 清理后复核：grades/classes/students/users/rooms/boxes/schedules/assignments/qbank/agents/devices/avatars/surveys/exams/leaves 含「核对测试/E2E」前缀记录数均为 **0**。
- 未改动任何生产种子数据（本校原有 72 学生、9 班级、3 年级、3 用户、3 教室、3 盒子、1 条 pro 订阅等保持原样）。
