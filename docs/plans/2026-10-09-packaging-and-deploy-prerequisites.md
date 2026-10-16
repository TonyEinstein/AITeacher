# 多端打包与部署前置条件（操作清单）

> 状态：**待执行（用户决定后续再做）**
> 记录日期：2026-10-09
> 适用：本项目「五端」中尚未本地闭环的部分
> ⚠️ 历史快照：文中提及的 `utils/pay.ts` / `utils/push.ts` / `utils/face.ts` 适配层已于 2026-10-13 作为死代码清理删除（见 commit `d8af866`）；本文件保留当时状态，勿据此判断当前代码结构。

## 说明

下面每一项都是**需要外部资源/账号/GUI 工具**的前置条件，本地无法代为完成。每项列出：为什么需要、缺什么、具体步骤、以及本仓库需要配合的改动。

> ⚠️ **准确性声明**：本机网络策略拦截了 DCloud 官方文档（`hx.dcloud.net.cn`、`uniapp.dcloud.net.cn`），无法核对最新界面与免费额度政策。**下文涉及 HBuilderX 界面菜单名与云打包政策的部分来自既有知识，可能随版本变化，请以官网为准**；涉及**本仓库配置**的部分（manifest 字段、compose 变量）均经实际读取核实。

---

## 1. App 打包（Android / iOS）—— 需 HBuilderX

### 为什么需要
uni-app 的 App 端（Android/iOS）**不能仅靠 CLI 产出可安装包**，必须经 HBuilderX 云打包或 DCloud 离线 SDK。当前 `apps/mobile` 的 `app` 产物（`npm run build:app`）只是**资源包**，HBuilderX 用它生成安装包。

### 缺什么
- HBuilderX（含 App 打包能力）
- DCloud 账号（需实名认证才能云打包）
- Android：自建 keystore（上架用）或公共测试证书（调试用）
- iOS：Apple 开发者账号（$99/年）+ 证书 + Provisioning Profile

### 步骤

1. **安装 HBuilderX**
   - 下载页：**https://www.dcloud.io/hbuilderx.html**
   - 选 **App 开发版**（标准版不含 App 打包能力）
   - Windows 选 zip 绿色版或安装版，无需管理员权限
   - 启动后 **文件 → 登录**，用 DCloud 账号登录；在账号中心完成实名认证

2. **补齐本项目配置**（当前有两处空值，已核实）
   | 文件 | 字段 | 现状 | 需填 |
   |---|---|---|---|
   | `apps/mobile/src/manifest.json` | 顶层 `appid` | `""` | HBuilderX 打开工程后点「重新获取」，拿 DCloud 分配的 AppID |
   | `apps/mobile/src/manifest.json` | `mp-weixin.appid` | `""` | 微信公众平台申请的小程序 AppID |

3. **导入工程**
   - HBuilderX → **文件 → 打开目录** → 选 `E:\AITeacher\apps\mobile`
   - **App 图标配置**：可用 `apps/desktop/app-icon-source.png`（1024×1024）作源图自动生成全尺寸
   - **App 模块配置**：勾选本项目所需原生能力 —— 相机（人脸录入 / 作业拍照）、通知推送、文件上传
   - **App 权限配置**：`manifest.json` 已有 Android 权限清单（相机、网络、闪光灯、读写等，已核实）

4. **真机调试**：**运行 → 运行到手机或模拟器**（USB 连接 + 开启 USB 调试）

5. **云打包**：**发行 → 原生App-云打包**
   - Android：调试用「公共测试证书」；上架必须「自有证书」（自建 keystore）
   - iOS：需 Apple 开发者账号 + 证书 + Provisioning Profile，无账号无法打包
   - 产物由 HBuilderX 控制台给出下载链接

> 免费额度与排队策略以官网为准：https://uniapp.dcloud.net.cn/

---

## 2. 生产容器实跑 —— 需 Docker + 生产密钥

### 为什么需要
生产前端服务已从 `admin-web` 切换为 `mobile-web`（uni-app H5 产物），但仍**从未真实构建运行过**（本次仅做 compose 解析与 `nginx -t` 语法校验）。

### 缺什么
- Docker 环境
- `infra/docker/.env.prod`（生产变量，含密钥）

### 必填变量（从 `docker-compose.prod.yml` 提取，`:?` 表示无默认值、缺失即启动失败）

```
DB_PASSWORD          # 必填
JWT_SECRET           # 必填
MINIO_ACCESS_KEY     # 必填
MINIO_SECRET_KEY     # 必填
REDIS_PASSWORD       # 必填
# 可选（LLM 能力；缺失时系统走 mock 降级）
DEEPSEEK_API_KEY
DOUBAO_API_KEY
GLM_API_KEY
```

### 步骤

```bash
cd infra/docker
# 1. 创建 .env.prod，填入上述变量（不要提交）
# 2. 构建并启动
docker compose -f docker-compose.prod.yml up -d --build
# 3. 验证
curl -s http://localhost/api/v1/health
# 4. 浏览器打开 http://<host>/ 验证 H5（nginx 托管 + /api 反代）
```

### 本仓库已就绪的部分
- `apps/mobile/Dockerfile`（多阶段构建 → nginx 托管）
- `apps/mobile/nginx.conf`（静态缓存 + SPA 回退 + `/api/` 反代 + `/ws`、`/wearable` WebSocket 反代）
- `apps/mobile/.dockerignore`
- `infra/docker/docker-compose.prod.yml` 的 `mobile-web` 服务（context 指向 `apps/mobile`）

---

## 3. CI 实跑 —— 需远端仓库

### 为什么需要
`.github/workflows/build.yml` 已写好（后端单测 + 三端构建），但**从未在真实 runner 执行过**（本机仅做 YAML 解析与本地等效步骤）。

### 步骤

```bash
# 1. 在 GitHub 建空仓库（不要初始化 README）
# 2. 添加远端并推送
git remote add origin <repo-url>
git push -u origin main
# 3. Actions 自动运行（push / PR 触发）
```

> ⚠️ **推送前必查**：确认密钥未被提交。`backend/.env` 已被 `.gitignore` 忽略（已核实）；推送前建议再跑一次 `git status` 与 `git log --stat` 复核。

> 若使用其他平台（GitLab / Gitea），workflow 需改写为对应 CI 语法。

---

## 4. 其他外部依赖（清单备查）

| 项 | 依赖 | 说明 |
|---|---|---|
| 微信小程序上架 | AppID、服务类目资质、用户隐私保护指引（含人脸采集说明）、订阅消息模板 | 后台 `POST /wechat/miniprogram-login` 已就绪 |
| iOS 上架 | 苹果开发者账号、软著、备案、隐私政策、TestFlight | — |
| Android 上架 | 软著、备案、各市场（华为/小米/OPPO/vivo/应用宝）账号、统一签名 keystore | — |
| 桌面自动更新 | 版本服务器（静态 JSON + 安装包 + `.sig`） | 插件与签名链路已就绪，`updater` 端点仍为占位 |
| Windows 代码签名 | 商业代码签名证书 | 缺失时安装会触发 SmartScreen 提示 |
| 支付闭环 | 微信支付商户号 / 支付宝 | 代码适配层 `apps/mobile/src/utils/pay.ts` 已就绪，当前订阅为线下开通制 |
| 推送送达 | 小程序订阅消息模板、App 端 uni-push 2.0 + 厂商通道 | 代码适配层 `apps/mobile/src/utils/push.ts` 已就绪 |
| 官网合规 | 域名 ICP 备案、公安备案、隐私政策与用户协议正式文本 | 当前为占位文本 |

---

## 5. 建议顺序

| 优先级 | 事项 | 理由 |
|---|---|---|
| P1 | HBuilderX 安装 + 填 AppID | 解锁 App 端真机验收，是「五端」承诺的最后一块 |
| P2 | 生产容器实跑 | 上线前的部署闭环，需服务器与密钥 |
| P3 | CI 实跑 | 需先有远端；本地已有等效验证 |
| P4 | 上架材料 | 需资质，周期最长，宜早启动 |

> 与模型训练工作项的关系：见 [课堂行为识别缺口](./2026-10-09-classroom-behavior-model-gap.md)（优先级更高，影响产品核心能力）。