# AI-Teacher 外部依赖配置排查结果

排查时间：2026-09-22
排查范围：LLM 接入、微信小程序接入
运行环境：后端 NestJS，端口 3000，全局前缀 `/api/v1`

---

## 一、LLM 配置排查

### 1.1 LLM 架构说明（调什么 API、Key 从哪读）

核心文件：`backend/src/llm/llm.service.ts`

- **调用方写死为 DeepSeek**（不是豆包 / 不是 OpenAI 兼容）。
  - 文件里虽然声明了 `private provider: 'deepseek' | 'doubao' | 'glm' = 'deepseek'`，但这个字段**从头到尾没被使用**，代码路径恒等于走 DeepSeek。
- **API Key 读取位置**：`process.env.DEEPSEEK_API_KEY`（`llm.service.ts:14`）。
- **Base URL（硬编码，不可配置）**：`https://api.deepseek.com/v1/chat/completions`
- **模型名（硬编码）**：`deepseek-chat`
- **鉴权方式**：请求头 `Authorization: Bearer <DEEPSEEK_API_KEY>`

调用链（三处 AI 功能都汇到同一个 `LlmService.chat()`）：

| 功能 | 入口文件 / 方法 | 说明 |
|---|---|---|
| 教学大纲生成 | `lesson-plans/lesson-plans.service.ts` → `generateOutline()` | 经 `LlmService.generateOutline()` 调 `chat()` |
| 教案生成 | `lesson-plans/lesson-plans.service.ts` → `generateLessonPlan()` | 经 `LlmService.generateLessonPlan()` 调 `chat()` |
| 作业出题 | `assignments/assignments.service.ts` → `generateByLesson()` | 直接调 `LlmService.chat()`，要求返回 JSON |
| AI 组卷 | `exams/exams.service.ts` → `generatePaper()` | 直接调 `LlmService.chat({maxTokens:8000})`，要求返回 JSON |

### 1.2 有无 mock / 降级模式

**有。** `llm.service.ts:13-17` 的逻辑：

```ts
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  return this.mockResponse(messages);   // 无 Key 直接返回假数据，不发任何网络请求
}
```

`mockResponse()` 的行为（`llm.service.ts:54-65`）：
- 当最后一条消息里包含「教学大纲」四个字 → 返回固定 JSON：
  ```json
  {"chapters":[{"name":"第一章 导论","objectives":"了解课程基本概念","keyPoints":"基本定义","duration":2},
               {"name":"第二章 基础","objectives":"掌握基础知识","keyPoints":"核心原理","duration":4}]}
  ```
- 其他所有 prompt（作业出题、AI 组卷、教案）→ 返回固定字符串：
  `【开发环境模拟】AI 生成内容，请配置 LLM API Key 后使用真实功能。`
  - 注意：作业/组卷拿到这段文字后会 `JSON.parse` 失败，落入 catch 分支，最终存库为 `{ raw: <那段文字>, questions: [] }`——也就是**题目数量为 0**。这是无 Key 状态下作业/组卷"看起来成功但没有题目"的根因。

### 1.3 当前 .env 配置状态

`backend/.env` 当前**只有一行**：

```env
DATABASE_URL="postgresql://postgres:ai_teacher_dev_2026@127.0.0.1:5432/ai_teacher?schema=public"
```

- ✅ 已配：`DATABASE_URL`
- ❌ 缺失：`DEEPSEEK_API_KEY`（唯一控制 LLM 真/假模式的开关）

`infra/docker/docker-compose.yml` 里只起了 postgres / redis / minio / srs 四个容器，**没有任何 LLM 相关环境变量注入**，也没有给后端服务本身配环境（后端是本地 `npm run start:dev` 跑的，不在 compose 里）。

### 1.4 mock 模式在线验证结果

用 `superadmin / 123456` 登录拿 token，调用 `POST /api/v1/lesson-plans/generate-outline`：

- 接口返回 HTTP 201，body：
  ```json
  {"code":0,"data":{"outline":"{\"chapters\":[{\"name\":\"第一章 导论\",...},{\"name\":\"第二章 基础\",...}]}"}}
  ```
- 返回内容正是 `mockResponse()` 里硬编码的「第一章 导论 / 第二章 基础」结构。

**结论：mock 模式当前正在生效，后端没有真正访问 DeepSeek。**（因为 `.env` 里没有 `DEEPSEEK_API_KEY`。）

> 备注：验证时库里原本没有教材（seed 未造 textbook），为打通接口临时插入了一条 `id=1` 的教材「高中数学必修一(测试)」(schoolId=1 TEST001, subjectId=2 数学)。这是一条测试数据，可保留也可删除。

### 1.5 用户需要做什么（要 Key 的话）

要把 LLM 从 mock 切到真实调用，只需在 **`backend/.env`** 里加一行：

```env
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥
```

- **平台**：DeepSeek 开放平台（https://platform.deepseek.com/），在 API Keys 页面创建，前缀 `sk-`。
- **环境变量名**：`DEEPSEEK_API_KEY`（名字必须完全一致，代码里写死读它）。
- **填到哪个文件**：`E:\AITeacher\backend\.env`，加在现有 `DATABASE_URL` 下面即可。
- **改完必须重启后端**（`.env` 是进程启动时读的，nest --watch 不会因为 .env 变化自动重加载环境变量）。
- Base URL、模型名都写死在 `llm.service.ts` 里，**不需要也无法通过环境变量改**；若以后想换豆包/OpenAI，必须改代码（把 `chat()` 里的 url、model、header 换掉）。

---

## 二、微信小程序配置排查

### 2.1 后端微信登录逻辑

核心文件：`backend/src/wechat/wechat.controller.ts` + `wechat.service.ts`

- 登录接口：`POST /api/v1/wechat/miniprogram-login`，入参 `{ code }`。
- 真实流程（`wechat.service.ts:19-61`）：
  1. 读 `process.env.WX_APPID`、`process.env.WX_SECRET`。
  2. **只要二者任一缺失 → 直接走开发 mock 登录**（不调微信接口）：取库里第一条 `parent` 记录，签一个 `role:'parent'` 的 JWT 返回；如果库里一条 parent 都没有，则返回 `{ access_token: 'dev_token', isBound: false }`。
  3. 若二者都已配置 → 真正请求 `https://api.weixin.qq.com/sns/jscode2session` 用 code 换 openid，再按 openid 查/建 parent，签 JWT 返回。

其他用到的微信环境变量：
- `WX_TEMPLATE_HOMEWORK`：作业下发订阅消息模板 ID（`wechat.service.ts:135`）。
- `JWT_SECRET`：微信登录签 token 用，由 `main.ts` 启动校验强制配置（≥32 位强随机密钥）。

### 2.2 小程序前端配置现状

| 配置项 | 当前值 | 文件位置 | 状态 |
|---|---|---|---|
| AppID | `touristappid` | `miniprogram/project.config.json:5` | ❌ 游客模式，不是真实小程序 AppID |
| 后端 API 地址 | `http://localhost:3000/api/v1` | `miniprogram/app.ts:5`、`miniprogram/utils/request.js:1` | ⚠️ 本地开发地址，真机/体验版需改成服务器域名 |
| AppSecret | 前端不存放，后端用 | — | ❌ 后端 `.env` 未配 |
| 小程序 `.env` | 不存在 | `miniprogram/` 下无 `.env` | — |

登录页 `miniprogram/pages/login/index.js` 的主流程：`wx.login()` 拿 code → `POST /wechat/miniprogram-login` → 存 token。另有一个"学号+姓名"备用登录（调 `GET /students`）。

### 2.3 当前缺失项清单

后端 `.env` 里微信相关变量**全部缺失**：
- ❌ `WX_APPID`
- ❌ `WX_SECRET`
- ❌ `WX_TEMPLATE_HOMEWORK`（可选，仅推送作业通知时需要）
- ❌ `WX_TEMPLATE_SCORE`（可选，仅推送成绩通知时需要）

小程序侧：
- ❌ `project.config.json` 的 `appid` 仍是 `touristappid`（游客模式，无法使用 wx.login 换真实 openid）。

### 2.4 mock 登录在线验证结果

直接调用 `POST /api/v1/wechat/miniprogram-login`，body `{ "code": "mock_code_12345" }`（随便填个 code 即可）：

- 返回 HTTP 201：
  ```json
  {"code":0,"data":{
    "access_token":"eyJhbGciOi...(JWT)",
    "isBound":true,
    "parent":{"id":1,"studentId":6,"openId":"GZ001-parent-1","name":"高一1班学家长1","phone":"13710000200","relation":"father"}
  }}
  ```
- 因为后端没配 `WX_APPID`/`WX_SECRET`，服务端跳过了微信 `jscode2session`，直接返回了库里第一条 parent（id=1）的 JWT。

**结论：mock 登录当前可用，前端随便传一个 code 就能拿到家长 token 跑通后续流程。**

### 2.5 用户需要做什么（接真实微信）

按顺序：

1. **微信公众平台拿 AppID / AppSecret**
   - 登录 https://mp.weixin.qq.com/ ，进入「小程序 → 开发管理 → 开发设置」。
   - 复制 **AppID(小程序ID)**，点「生成」获取 **AppSecret(小程序密钥)**（Secret 只显示一次，务必当场存好）。

2. **填到后端 `E:\AITeacher\backend\.env`**：
   ```env
   WX_APPID=wx你的小程序appid
   WX_SECRET=你的小程序appsecret
   ```
   （可选）订阅消息模板：在公众平台「订阅消息」里申请模板，把模板 ID 填到 `WX_TEMPLATE_HOMEWORK`。

3. **填到小程序 `miniprogram/project.config.json`**：把 `"appid": "touristappid"` 改成你真实的 AppID（`wx...`）。

4. **后端重启**，再用微信开发者工具点登录：此时后端才会真正拿 code 去 `jscode2session` 换 openid。

5. **后端 API 域名**：`miniprogram/utils/request.js` 里的 `http://localhost:3000/api/v1` 仅本地开发者工具可用；真机预览/体验版需改成已在微信公众平台「服务器域名」里配置的 https 域名（微信强制 https，不允许 localhost）。

---

## 三、一句话总结

- **LLM**：写死调 DeepSeek，Key 读 `DEEPSEEK_API_KEY`；当前 `.env` 没配 → 全程 mock（大纲返回固定两章 JSON，作业/组卷返回 0 题）。要真 LLM 就在 `backend/.env` 加 `DEEPSEEK_API_KEY=sk-...` 并重启。
- **微信**：后端靠 `WX_APPID`+`WX_SECRET` 判断是否真登录，二者缺省即 mock（已实测可拿到家长 JWT）；小程序 AppID 还是 `touristappid`。要真登录需在公众平台拿 AppID/AppSecret，分别填到 `backend/.env` 和 `miniprogram/project.config.json`。
