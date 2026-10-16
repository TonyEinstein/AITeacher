# 可维护性清理计划 — 2026-10-12

依据：`deliverables/测试分析报告-官网登录页-2026-10-12.md`（17 项发现已逐条实证）。
全局约束（Global Constraints）：
- G1 后端每批改动后 `npx vitest run`（backend 目录）必须全绿（基线 12 套件 113 用例）。
- G2 前端不得改动 pages-site/**.vue 的模板结构与样式（仅允许 Batch D 的 go() 替换）；视觉行为零变化。
- G3 删除任何符号前必须重新 grep 确认零引用（以本会话核验清单为准，允许引用数为 0 才可删）。
- G4 不新增业务功能；只做清理/收敛/加固。
- G5 提交信息用中文 conventional commits，末尾 Co-Authored-By: Claude Code <noreply@anthropic.com>。
- G6 已有裁决：lesson-agent.startLesson（灰度实验入口）与 queue 基础设施组 **不删**（产品决策项，另行排期）；其余 13 个孤儿方法删除。

## Task 1（后端加固）：leads DTO 校验 + 限流

- 新建 `backend/src/leads/dto/create-lead.dto.ts`：class-validator 装饰——company 必填 @IsString() @Length(1,120)；name 必填 @Length(1,40)；phone 必填 @Matches(/^[\d\-+ ]{6,25}$/)；message 可选 @Length(0,500)；用 @ApiPropertyOptional 保持 swagger 兼容可选。
- `leads.controller.ts` 的 `createPublic(@Body() body: any)` 改为 `@Body() dto: CreateLeadDto`；service.create 签名对应收窄。
- 启用限流：`@nestjs/throttler` 已在依赖。app.module.ts 挂 ThrottlerModule（全局，限 100/min 每 IP 兜底），leads 的 `@Post('public')` 上单独 `@Throttle({ default: { limit: 5, ttl: 60_000 } })`（每 IP 每分钟 5 次）。注意 ThrottlerModule v5+ 的数组式配置；若版本 API 不同以安装版本为准。
- 新增/扩展单测：leads.service.spec 或 controller 测试，覆盖「合法提交通过、超长字符串被拒、空 body 被拒」至少 3 例（校验逻辑用 ValidationPipe 单元级测试即可，不必起 HTTP）。
- 验证：G1 全绿。

## Task 2（后端清理）：test/ 归档 + 孤儿方法删除 + deploy script

- `git mv backend/test` → `archive/backend-test/`（9 个文件整体：test_helper.js、test-d2.js、cleanup-d2.js、test_full.js、test_retest.js、test_pages_1_7.js、regression-test.js、regression-results.json、boot3.err）。archive/ 下已有先例如 admin-web。
- 删除以下孤儿方法（每个删除前 grep 确认 0 引用，含 spec；G3）：
  assignments.service.findSubmission、textbooks.service.updateStatus、parents.service.getMyChild、minio.service.getFileUrl、media-stream.service.getHlsUrl、media-stream.service.getActiveStreams、notifications.service.notifyParentAfterWarning、wechat.service.notifyScore、wrong-questions.service.refreshProfileWeaknessesBatch、lesson-agent.service.getLessonState、vision.service.setQueue（注意：spec 若引用 setRedisForTest 之外的 setQueue 则保留并报告）、lesson.event.processor.enqueue（仅删该方法，模块与 Worker 保留）。
  删除后若无其他引用，顺带清掉只为它们存在的私有辅助/ import。
- evaluations.service：删除构造器注入 `private llm: LlmService` 与对应 import（this.llm 0 引用已实证）。
- backend/package.json：删除 `"deploy": "nest deploy"` script；@nestjs/mau 依赖一并移除（npm uninstall）。
- 验证：G1 全绿；`npx oxlint --type-aware src/ test/` 无新增报错。

## Task 3（前端清理）：死文件/死导出/死资源

- 删除文件：`src/utils/face.ts`、`src/utils/pay.ts`、`src/utils/push.ts`、`src/static/logo.png`（各 0 引用已实证；删除前再 grep 一次）。
- 死导出收敛（删导出保留内部使用）：
  - utils/realtime.ts：删 `connectObserver` 导出（函数本体若无内部使用一并删）。
  - utils/request.ts：`request()` 函数若无内部使用则整体删除；`http.patch` 方法删除；`ApiResponse` 若仅内部使用则取消 export。
  - config/env.ts：删 `APP_INFO`。
  - utils/upload.ts：`UploadOptions` 取消 export（内部使用保留）。
  - composables/useSite.ts：`SiteConfig` 取消 export（接口保留内部使用）。
  - config/admin-menus.ts：superAdminMenus/groupAdminMenus/schoolMenus/teachingMenus/AdminMenuItem 取消 export（getAdminMenus/ROLE_TEXT 保留导出）。
- 验证：dev server 编译无错（curl http://localhost:5175 返回 200 且首页/console 无新错——以 vite 构建无报错为准：`npx vue-tsc --noEmit` 若工程配置可用则跑，不可用以 `npm run build:h5` dry 校验或 vite dev 启动日志为准，报告所用方式）。

## Task 4（前端收敛）：登录守卫组合式 + useSiteNav 组合式

- 新建 `src/composables/useStudentAuth.ts`：`useStudentAuth()` 内部注册 onShow（@dcloudio/uni-app），校验 `isLogin()` 且 `uni.getStorageSync('studentId')` 存在，失败 `uni.reLaunch({ url: '/pages/login/index' })`。
- 改造 6 个学生页（homework/scores/tutoring/wrong-book/practice/index——grep 实证的标准 onShow+isLogin+reLaunch 守卫；profile 是登出/切换场景、homework-detail/leave 是函数内取 studentId，均**不属守卫收敛**，不动）：setup 中调用 useStudentAuth()，删除各自重复的守卫块；页面原有 onShow 数据加载逻辑保留不动（多 onShow 回调可共存；index 页的 studentInfo/role 重读保留在其自己的 onShow 中）。
- 新建 `src/composables/useSiteNav.ts`：`useSiteNav()` 返回 `{ go }`，go 内部为现有条件编译（H5 navigateTo / 非 H5 reLaunch）。替换 pages-site/ 下 5 个文件（index/about/cases/faq/features）的本地 go()。
- 验证：grep 确认 pages/ 下守卫模式只剩组合式调用；dev 编译无错；登录守卫行为手工路径不变（不登录访问 /pages/homework/index 应回登录页——以代码审查为准，不起浏览器）。

## Task 5（前端测试基线）：vitest + 3 个用例

- apps/mobile 安装 devDependencies：vitest、happy-dom、@vue/test-utils（版本与 vue 3.4 兼容）。
- 新建 `apps/mobile/vitest.config.ts`：environment happy-dom，alias `@` → src，include `src/**/*.{spec,test}.ts`；不得影响 vite.config.ts 的 uni 构建链（独立文件）；package.json 加 `"test": "vitest run"`。
- 用例 1 `src/composables/useSite.spec.ts`：mock api/site——接口返回含 null 字段时 merge 后默认值不被覆盖；全 null 时全兜底；正常值覆盖默认值。
- 用例 2 `src/composables/useReveal.spec.ts`：mock IntersectionObserver 与 matchMedia——reduced-motion 时直接加 reveal-visible；IO 触发后加 reveal-visible 且 unobserve。
- 用例 3 `src/components/site/SiteLeadForm.spec.ts`：mock api/site 的 submitLead——必填缺失时点击提交显示错误提示且不发请求；填写完整后调用 submitLead 且成功提示。
- 验证：`npm run test` 3 文件全绿；G2（未动模板/样式）。

## Task 6（收尾）：文档同步 + 重启后端实测

- 测试分析报告（deliverables/…md）第九节各行动项后补「✅ 已执行（<commit>）」标注；queue/startLesson 的保留裁决写入报告。
- README 结构树中 backend/test 若被提及则同步为 archive 路径。
- 控制器（会话主线程）重建后端 dist 并重启进程，实测 `POST /api/v1/leads/public`：合法 body 200、空 body 400、超长 body 400、连发 6 次 ≥1 次 429。
