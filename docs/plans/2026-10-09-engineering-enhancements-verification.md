# C 工程增强项 验证报告

> 日期：2026-10-09
> 设计：[2026-10-09-engineering-enhancements-design.md](./2026-10-09-engineering-enhancements-design.md)
> 计划：[2026-10-09-engineering-enhancements-plan.md](./2026-10-09-engineering-enhancements-plan.md)
> 提交范围：`37c5623`（起点）→ 15 个提交

## 一、逐项验证

| 编号 | 事项 | 命令 / 手段 | 结果 |
|---|---|---|---|
| E1 | 图表（ProportionBar ×4 处、ChartBar ×2 处） | `npm run type-check`；H5 逐页实测 | ✅ 通过 |
| E2 | 归档 + 生产切换 + apiBase 修复 | `git mv` 结果核查；`docker compose config`；生产产物 grep | ✅ 通过 |
| E3 | focusCount 采集与口径 | `python scripts/test_logic.py`；`npm --prefix backend test`；真实 Redis 链路 | ⚠️ 部分（见下） |
| E4 | CI | `build-all.ps1 -SkipDesktop`；workflow YAML 解析 | ✅ 通过 |

### E1 证据

`npm run type-check` → 0 错误（`vue-tsc --noEmit`）。

H5 实测（Playwright，`http://localhost:5175`）：

| 页面 | 断言 | 实测 |
|---|---|---|
| lesson-report | 专注率 = ΣfocusCount/ΣtotalDetected，且无夹取 | `85%`（= 11/13） |
| lesson-report | 无 NaN、单套图例、图表按真实值定轴 | `hasNaN=false`；1 canvas；1 处「专注」；X 轴 `20:51`、Y 轴 0~15 |
| dashboard（superadmin） | LLM 用量为真实定轴柱状图 | canvas 存在；X 轴 7 个 `MM-DD`；柱高与数值标签一致（777） |
| roi | 2 条比例条，宽度按最大值归一 | `1%` / `100%`（对应 ¥2,000 / ¥174,000）；height 22px |
| health | 5 条比例条按设备在线率 | `67/67/33/33/75%`；height 10px |
| pages-site | `go()` 重构后跳转正常 | 点击「了解更多」→ `/pages-site/features`；console 0 错误 |

### E2 证据

- 归档：`git mv` 三个目录 → 138 个已跟踪文件全部记为 `R`（rename），零删除；`git show --stat` 为 `142 files changed, 45 insertions(+)`（仅 4 个说明文件新增）。
- 结构：`archive/{admin-web,website,miniprogram}` 存在、根目录三目录消失、`node_modules` 随目录物理迁移（168M/159M 占用不变）。
- 生产编排：`env … docker compose -f infra/docker/docker-compose.prod.yml config` → exit 0；服务列表为 `backend / minio / mobile-web / postgres / redis / srs`，无 `admin-web`/`ait-admin`。
- apiBase：生产产物 `grep -rl "127.0.0.1:3000" dist/build/h5/` → **无匹配**，且含 `/api/v1`；dev 模式编译产物 `apiBase = http://127.0.0.1:3000/api/v1`，浏览器实测请求 `GET /api/v1/schools` → 200。
- 启动脚本：`start-all.ps1` 实跑后 3000 与 5175 均就绪，5175 登录页浏览器加载正常；`bash -n` 校验两个 `.sh` 通过；PSParser 校验两个 `.ps1` 通过。

### E3 证据与限度

已完成：
- `edge-vision/scripts/test_logic.py` → 7 个用例全通过（含新增：显式 focus 计入 focusCount、空帧安全、**固定「detector 未填 behavior」现状**）。
- 后端 `npm --prefix backend test` → 9 文件 / **97 用例全通过**（含新增 `vision.service.spec.ts` 3 用例；TDD 先红后绿）。
- 真实 Redis 链路：`POST /vision/aggregates` → `{ok:true}`；`GET /vision/config` → `lastAggregates` 原样回读（`focusCount:9`、`totalDetected:12`）。

**未能完成（重要，见「与设计的偏离」）**：专注率在真实链路仍无法反映专注度。原因不是缺少一行代码，而是两处产品级缺口：
1. `edge-vision` 是**模型训练仓库**（其 README 明写「骨架，缺行为分类头」），`detector.py` 从不给 `behavior` 赋值 → 所有行为计数塌缩进 `focusCount`（`focusCount ≡ totalDetected`，专注率恒 100%），违纪检测在真实数据上不触发。
2. 生产实现 `classroom-client/vision-service` **不上报每分钟聚合**（只发 WebSocket `/ws/box` 与 `POST /lesson-records/:id/behavior`）。

即：**没有任何生产组件产生 `ClassMinuteAggregate`**。本次已把该限制写入代码注释并加测试固定，未伪造行为分类结果。

### E4 证据

- `powershell -NoProfile -File scripts/build-all.ps1 -SkipDesktop` → 退出码 0；三项产物校验 `ok`；三个产物文件实际存在。
- `.github/workflows/build.yml` → pyyaml 解析成功：`jobs=['backend-test','mobile-build']`、`triggers=['push','pull_request']`、`matrix=['h5','mp-weixin','app']`、工作目录 `backend` / `apps/mobile`、步骤清单正确。
- 本地等效运行 CI 的 backend job：`npx vitest run` → 97/97 通过。

## 二、Review Focus 逐条

| # | 条件 | 验证方式与结果 |
|---|---|---|
| 1 | `ProportionBar` 收 `null`/`undefined`/`NaN` → 0 宽、无 `NaN%` | 临时将 health 的 `:value` 改为 `undefined`：5 条宽度全 `0%`、页面无 `NaN`、`height:10px` 生效；随后还原并复验为 `67/67/33/33/75%` ✅ |
| 2 | `ChartBar` 空 `categories`/全 0 → 不崩 | 临时插入 `:categories="[]"` 实例 → 显示「暂无数据」、不抛错、console 无错误 ✅ |
| 3 | 同页两个 `ChartBar` 不串图 | 临时插入两个实例（7 类 1 序列 + 3 类 2 序列）→ 各自独立渲染、图例各自正确 ✅ |
| 4 | `focusRate` 在 Σ`totalDetected`=0 时显示 `—` | 原计划用「不存在的课次」无法触发（该分支被 `v-if` 拦住）；改为临时把 `totalDetected` 置 0 → 显示 `—`、无 NaN；随后还原为 13（专注率 85%）✅ |
| 5 | `edge-vision` 空 `tracks` → 计数 0 不抛错 | `test_aggregate_empty_tracks` 通过 ✅ |

## 三、未验证项（本地无法闭环，如实列出）

1. **生产 `mobile-web` 容器 nginx 反代与 WebSocket 实跑** —— 需完整 Docker 生产环境与 `.env.prod`；本次仅做 compose 解析（exit 0）与 `nginx -t` 语法校验（`nginx:1.27-alpine` 容器，`syntax is ok`）。
2. **uCharts 在微信小程序端 canvas 真实渲染** —— 需微信开发者工具；本次仅 H5 实测 + 小程序产物存在性校验。
3. **Tauri 桌面对新 H5 产物的目视确认** —— 本机桌面虚拟截图组件（PIP）初始化失败（上游已记录该限制）。
4. **`.github/workflows/build.yml` 在真实 CI runner 的执行** —— 无 CI 可触达；本次仅 YAML 解析 + 本地等效步骤（vitest 97/97）。
5. **`scripts/build-all.ps1` 的 Tauri（桌面）段实跑** —— 依赖外网 NSIS 工具链下载；本次仅验证 `-SkipDesktop` 路径。
6. **`npx prisma generate`** —— 本地因运行中的后端进程持有 query engine DLL 报 EPERM；CI 干净 runner 无此冲突（schema 本次未改动）。
7. **`scripts/stop-all.sh/.ps1` 实跑** —— 未执行（会拆掉实测所需环境）；仅语法与逐行一致性校验。

## 四、与设计的偏离（诚实记录）

| # | 设计/计划原定 | 实际 | 原因 |
|---|---|---|---|
| 1 | `@qiun/ucharts@2.5.0` | `2.5.0-20230101` | npm 无 `2.5.0` 版本；实际 latest 为后者 |
| 2 | 「H5 ECharts / 小程序 uCharts 双写」 | uCharts 单库 + 单值比例条保留 DOM | 设计 4.1 已论证并获用户确认（避免双实现维护成本） |
| 3 | Task 6「修复 edge-vision focusCount 采集（恒 0）」 | 该函数本就正确；改为固定真实契约 + 注释 + 记录产品级缺口 | 经查证：`focusCount ≡ totalDetected`（非 0）；根因是行为分类头未训练 + 生产端不上报聚合 |
| 4 | Task 12 仅 4 个 markdown | 另更新 `start-all.sh`、`stop-all.sh`、`部署运维手册.md`、`docker-compose.yml` 注释 | 计划 Step 5 的「全仓无失效引用」门禁暴露遗漏 |
| 5 | Task 8 仅 Dockerfile + nginx.conf | 另加 `apps/mobile/.dockerignore` | 对齐 `admin-web` 既有约定，避免巨大构建上下文 |
| 6 | 专注率移除 `Math.min(100,…)` | 同时修正库内一行不自洽种子数据（28/13 → 11/13） | 否则页面显示 215%；已核实无下游影响 |
| 7 | 前端端口 5175 | 另在 `vite.config.ts` 固定 `port:5175, strictPort: true` | uni-app 默认 5173；需与 Tauri `devUrl`、启动脚本三者一致 |

## 五、遗留（不在本次范围）

1. **训练行为分类头**并让生产端（`vision-service`）上报每分钟聚合 —— 专注率才能真正反映课堂专注度。这是 E3 的完整闭环前提。
2. App（Android/iOS）云打包与真机验收 —— 需 HBuilderX。
3. 真实支付/推送闭环、桌面自动更新版本服务器、Windows 代码签名 —— 需外部账号与服务器。
4. 各应用市场上架材料 —— 需资质。
5. 归档目录（`archive/`，约 327M）的最终删除 —— 需在 App/小程序真机验收完成后显式确认。