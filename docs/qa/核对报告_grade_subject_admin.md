# AI-Teacher 管理后台核对报告 — grade_admin / subject_admin

- **核对时间**：2026-09-22
- **后端 API**：http://localhost:3000/api/v1
- **数据库**：postgresql://postgres:***@127.0.0.1:5432/ai_teacher
- **测试账号**：
  - grade_admin：`GZ001_grade1` / `123456`（userId=5，schoolId=2=广州市第一中学，gradeId=3=高一，subjectId=null）
  - subject_admin：`GZ001_math` / `123456`（userId=6，schoolId=2，gradeId=null，subjectId=2=数学）
- **测试方法**：node 原生 fetch 发 HTTP 请求；写操作后用 PrismaClient 直查 PostgreSQL 验证落库；写测试数据均带「核对测试」前缀，用例结束已清理。
- **响应包络**：后端统一返回 `{code:0, data:..., message:"success"}`，状态码列记录的是 HTTP 状态码。

---

## 一、访问控制测试表（Part A：schoolOnly 页面 API）

> schoolOnly 页面：/organization、/devices、/tutoring、/leave-approval、/device-monitor。
> 下表「用本校参数」指 grade_admin / subject_admin 用自己所属学校（schoolId=2、classId=3、roomId=1）直接调用对应 API。

| 角色 | API（对应 schoolOnly 页面） | 期望 | 实际 HTTP | 返回数据条数 | 是否正确拦截 |
|---|---|---|---|---|---|
| grade_admin | GET /students?classId=3 （组织架构） | 403 / 空 / 过滤 | **200** | **8 条学生** | ❌ 未拦截（越权可读） |
| subject_admin | GET /students?classId=3 （组织架构） | 403 / 空 / 过滤 | **200** | **8 条学生** | ❌ 未拦截（越权可读） |
| grade_admin | GET /boxes?schoolId=2 （设备管理） | 403 / 空 / 过滤 | **200** | **3 台盒子** | ❌ 未拦截（越权可读） |
| subject_admin | GET /boxes?schoolId=2 （设备管理） | 403 / 空 / 过滤 | **200** | **3 台盒子** | ❌ 未拦截（越权可读） |
| grade_admin | GET /tutoring/subscriptions/school/2 （辅导管理） | 403 / 空 / 过滤 | 200 | 0 条 | ⚠️ 未拦截（恰好空数据，接口本身放行） |
| subject_admin | GET /tutoring/subscriptions/school/2 （辅导管理） | 403 / 空 / 过滤 | 200 | 0 条 | ⚠️ 未拦截（恰好空数据） |
| grade_admin | GET /tutoring/devices/2 （辅导管理-穿戴） | 403 / 空 / 过滤 | 200 | 0 条 | ⚠️ 未拦截（恰好空数据） |
| subject_admin | GET /tutoring/devices/2 （辅导管理-穿戴） | 403 / 空 / 过滤 | 200 | 0 条 | ⚠️ 未拦截（恰好空数据） |
| grade_admin | GET /leaves/pending/2 （请假审批） | 403 / 空 / 过滤 | 200 | 0 条 | ⚠️ 未拦截（恰好空数据） |
| subject_admin | GET /leaves/pending/2 （请假审批） | 403 / 空 / 过滤 | 200 | 0 条 | ⚠️ 未拦截（恰好空数据） |
| grade_admin | GET /boxes/all （设备监控） | 403 / 空 / 过滤 | **403** | — | ✅ 已拦截（@Roles('super_admin')） |
| subject_admin | GET /boxes/all （设备监控） | 403 / 空 / 过滤 | **403** | — | ✅ 已拦截（@Roles('super_admin')） |
| grade_admin | GET /leaves/pending/3 （跨校越界对照：SZ001） | 403 | **403** | — | ✅ 数据边界守卫生效 |
| subject_admin | GET /leaves/pending/3 （跨校越界对照：SZ001） | 403 | **403** | — | ✅ 数据边界守卫生效 |

**小结**：
- 后端 `JwtAuthGuard` 内部串联了 `DataScopeGuard`，但该守卫**只做"跨校"拦截**（schoolId 不匹配 → 403「数据越权」），**不做"角色"拦截**。
- 组织架构 / 设备管理 / 辅导管理 / 请假审批这 4 个 schoolOnly 接口在校内范围内对 grade_admin、subject_admin **完全放行**，前端路由跳转拦截可被绕过（直接拿 token 调 API 即可拿到学生、盒子等全量数据）。
- 仅 /boxes/all（设备监控）通过 `@Roles('super_admin')` 正确拦截；跨校越界对照用例也正确返回 403。

---

## 二、数据加载测试表（Part B：非 schoolOnly 页面）

| 角色 | 页面 | API | HTTP | 数据条数 | 是否正常 |
|---|---|---|---|---|---|
| grade_admin | /dashboard 首页概览 | GET /dashboard/grade/3 | 200 | 对象（高一，3班级/24学生） | ✅ 正常 |
| subject_admin | /dashboard 首页概览 | GET /dashboard/grade/3 | 200 | 对象（同上） | ✅ 正常（见 Bug5：未校验年级归属） |
| grade_admin | /textbooks 教材教案 | GET /textbooks?schoolId=2 | 200 | 0 条 | ✅ 正常（库内无教材） |
| subject_admin | /textbooks 教材教案 | GET /textbooks?schoolId=2 | 200 | 0 条 | ✅ 正常 |
| grade_admin | /schedules 课表管理 | GET /schedules?classId=3 | 200 | 0 条 | ✅ 正常（用例前库内无课表） |
| subject_admin | /schedules 课表管理 | GET /schedules?classId=3 | 200 | 0 条 | ✅ 正常 |
| grade_admin | /assignments 作业复核 | GET /assignments?classId=3 | 200 | 0 条 | ✅ 正常 |
| subject_admin | /assignments 作业复核 | GET /assignments?classId=3 | 200 | 0 条 | ✅ 正常 |
| grade_admin | /exams 考试管理 | GET /exams?schoolId=2 | 200 | 0 条 | ✅ 正常 |
| subject_admin | /exams 考试管理 | GET /exams?schoolId=2 | 200 | 0 条 | ✅ 正常 |
| grade_admin | /live 巡课旁听 | GET /live/pull/room/1 | 200 | 对象（flv/hls/webrtc/rtmp 推流地址） | ✅ 正常 |
| subject_admin | /live 巡课旁听 | GET /live/pull/room/1 | 200 | 对象（同上） | ✅ 正常 |
| grade_admin | /reports 报表驾驶舱 | GET /rankings/grade-performance/3 | 200 | 对象（3班级/24学生排名） | ✅ 正常 |
| subject_admin | /reports 报表驾驶舱 | GET /rankings/grade-performance/3 | 200 | 对象（同上） | ✅ 正常（见 Bug5） |
| grade_admin | /question-bank 学科题库 | GET /question-bank?subjectId=2 | 200 | 0 条 | ✅ 正常 |
| subject_admin | /question-bank 学科题库 | GET /question-bank?subjectId=2 | 200 | 0 条 | ✅ 正常 |
| grade_admin | /agents AI教师管理 | GET /agents?schoolId=2 | 200 | 0 条 | ✅ 正常 |
| subject_admin | /agents AI教师管理 | GET /agents?schoolId=2 | 200 | 0 条 | ✅ 正常 |
| grade_admin | /avatars 数字人形象 | GET /avatars | 200 | 0 条 | ✅ 正常 |
| subject_admin | /avatars 数字人形象 | GET /avatars | 200 | 0 条 | ✅ 正常 |
| grade_admin | /surveys 满意度问卷 | GET /surveys/active | 200 | 0 条 | ✅ 正常（注：该接口未挂 JwtAuthGuard，实为公开接口） |
| subject_admin | /surveys 满意度问卷 | GET /surveys/active | 200 | 0 条 | ✅ 正常 |
| grade_admin | /leads 咨询留资 | GET /leads | **403** | — | ❌ 前端开放、后端超管独占，页面必空白 |
| subject_admin | /leads 咨询留资 | GET /leads | **403** | — | ❌ 同上 |
| grade_admin | /subscription 订阅管理 | GET /subscriptions | **403** | — | ❌ 前端开放、后端超管独占，页面必空白 |
| subject_admin | /subscription 订阅管理 | GET /subscriptions | **403** | — | ❌ 同上 |
| grade_admin | /work-orders 售后工单 | GET /work-orders | **403** | — | ❌ 前端开放、后端超管独占，页面必空白 |
| subject_admin | /work-orders 售后工单 | GET /work-orders | **403** | — | ❌ 同上 |
| grade_admin | /health 学校健康 | GET /dashboard/health | **403** | — | ❌ 前端开放、后端超管独占，页面必空白 |
| subject_admin | /health 学校健康 | GET /dashboard/health | **403** | — | ❌ 同上 |

**小结**：教学主线（dashboard/textbooks/schedules/assignments/exams/live/reports/question-bank/agents/avatars/surveys）对两个角色均 200 正常；leads、subscription、work-orders、health 这 4 个页面后端一律 403，前端却未加 schoolOnly 拦截，属于前后端权限不一致（见 Bug2）。

---

## 三、写操作落库验证表（Part C）

> 所有写操作后均直查 PostgreSQL 对应表确认；用例结束均已删除清理。

| 角色 | 操作 | API | HTTP | 数据库验证结果 |
|---|---|---|---|---|
| subject_admin | 创建题目 | POST /question-bank | 201 | ✅ QuestionBank 落库：id=3，question="核对测试-1+1等于几？"，difficulty=2 |
| subject_admin | 编辑题目 | PUT /question-bank/3 | 200 | ✅ 已更新：question="核对测试-编辑后:2+2等于几？"，difficulty=4 |
| subject_admin | 删除题目 | DELETE /question-bank/3 | 200 | ✅ 已删除：表中查无此行 |
| subject_admin | 创建 AI 教师 | POST /agents | 201 | ✅ Agent 落库：id=3，name="核对测试AI数学教师"，style=serious |
| subject_admin | 修改风格 | PATCH /agents/3/style | 200 | ✅ 已更新：style 由 serious → humorous |
| subject_admin | 删除 AI 教师 | DELETE /agents/3 | 200 | ✅ 已删除：表中查无此行 |
| grade_admin | 创建课表 | POST /schedules | 201 | ✅ Schedule 落库：id=3，classId=3，status=scheduled，startTime=2026-09-25T08:00 |
| grade_admin | 编辑课表 | PUT /schedules/3 | 200 | ✅ 已更新：status=scheduled→completed，roomId→2 |
| grade_admin | 删除课表 | DELETE /schedules/3 | 200 | ✅ 已删除：表中查无此行 |

**小结**：subject_admin 的 question-bank / agents 全套 CRUD、grade_admin 的 schedules 全套 CRUD，HTTP 状态与数据库落库结果完全一致，写链路正常。

---

## 四、Bug 清单

### Bug1【严重 / 越权】schoolOnly 教学管理接口后端未做角色拦截
- **现象**：组织架构（GET /students）、设备管理（GET /boxes）、辅导管理（GET /tutoring/*）、请假审批（GET /leaves/pending/:schoolId）这 4 类 schoolOnly 接口，grade_admin / subject_admin 用本校参数调用均返回 **200 + 全量数据**（学生 8 条、盒子 3 台）。
- **根因**：`JwtAuthGuard` 串联的 `DataScopeGuard` 只校验"跨校 schoolId"，不校验"角色是否属于 schoolOnly 资源"；这些控制器也未加 `@Roles(...)`。
- **影响**：前端 `router.beforeEach` 的 schoolOnly 跳转拦截可被直接绕过——持有 grade_admin / subject_admin token 直接调 API 即可读取组织架构、设备、请假等本应学校管理员/超管可见的数据。
- **建议**：在上述控制器的对应 GET 上加 `@Roles('super_admin','school_admin')`，或扩展 DataScopeGuard 按角色（grade_admin/subject_admin）拒绝 schoolOnly 资源。

### Bug2【严重 / 前后端权限不一致】leads / subscription / work-orders / health 页面 403 白屏
- **现象**：GET /leads、GET /subscriptions、GET /work-orders、GET /dashboard/health 对 grade_admin / subject_admin 均返回 **403「权限不足」**（后端 `@Roles('super_admin')`）。
- **根因**：前端路由未把这 4 个页面标记为 schoolOnly，grade_admin / subject_admin 可进入页面，但一进页面调接口即 403，列表空白。
- **影响**：用户在 leads / 订阅管理 / 售后工单 / 学校健康 页面看到空白或报错。
- **建议**：二选一——前端给这 4 个页面加 `schoolOnly: true`（与设备监控一致），或后端放开为按本校数据返回。

### Bug3【中 / 前端遗漏】/device-monitor 路由未标记 schoolOnly
- **现象**：`admin-web/src/router/index.ts` 第 34 行 device-monitor 的 meta 只有 `{title, icon}`，**缺少 `schoolOnly: true`**（任务定义它属于 schoolOnly）。
- **影响**：虽然后端 GET /boxes/all 已 `@Roles('super_admin')` 返回 403（接口层兜底 OK），但前端不会把 grade_admin / subject_admin 重定向走，用户会停留在一个必然 403 的空白页。
- **建议**：给 device-monitor 路由 meta 补上 `schoolOnly: true`。

### Bug4【轻 / 数据范围】subject_admin 写操作未校验学科归属
- **现象**：POST /question-bank、POST /agents 未校验入参 subjectId 是否等于用户绑定的 subjectId=2。subject_admin 可创建其他学科（如语文 id=1）的题目、可创建任意 schoolId/subjectId 的 Agent。
- **建议**：写操作时以 token 中的 subjectId / schoolId 覆盖或校验入参，防止跨学科越权写。

### Bug5【轻 / 数据范围】subject_admin 可读任意年级数据
- **现象**：GET /dashboard/grade/:gradeId、GET /rankings/grade-performance/:gradeId 不校验 gradeId 是否归属用户。subject_admin（gradeId=null）可遍历查看高一/高二/高三任意年级的概览与排名（限本校）。
- **建议**：对 gradeId 维度增加与 DataScope 类似的年级/学科归属校验。

### 备注
- GET /surveys/active 未挂 `JwtAuthGuard`（公开接口），两个角色均可匿名读取 active 问卷，建议确认是否为有意设计。
- 用例产生的「核对测试」题目、AI 教师、课表均已在本报告用例中删除，未残留脏数据。
