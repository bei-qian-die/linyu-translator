# 淋语翻译器 · 云端润色代理部署指南

`src/core/llm-polish.js` 里的「LLM 润色」逻辑需要一个大模型后端。桌面端走本地 Ollama；
**Web 端 / 微信小程序端没有本地模型**，需要一个部署在云上的「润色代理」来调大模型，
并把结果回传。本文给出三种部署方案，均共用同一份策略代码（提示词 + 护栏的唯一真源
`server/prompt.mjs`；云开发版把同一份逻辑内联进了云函数），保证各端行为一致。

---

## ⭐ 方案 0 · 微信云开发（**同时覆盖 Web + 小程序，小程序必选**）

**这是"一套后端同时上线双端"的正解**，也是唯一能过微信小程序域名关的方案：

| 端 | 调法 | 是否需备案域名 |
|----|------|---------------|
| 小程序 | `wx.cloud.callFunction('polish', {source, draft})` | **不需要** ✅ 云开发原生调用 |
| Web | 云开发「HTTP 访问服务」→ `https://<env>.service.tcloudbase.com/polish` | 腾讯默认域名已备案，国内可直连 ✅ |

云函数代码已就位：`miniprogram/cloudfunctions/polish/`（`index.js` + `package.json`），
双模式自适应（`callFunction` / HTTP 访问），提示词与护栏与 `prompt.mjs` 逐字一致。

**部署步骤：**

1. 微信开发者工具打开 `miniprogram/` → 顶部「云开发」→ 开通环境，记下**环境 ID**。
2. 把环境 ID 填进 `miniprogram/app.js` 顶部的 `const CLOUD_ENV = '你的环境ID';`。
3. 右键 `cloudfunctions/polish` → **上传并部署（云端安装依赖）**。
4. 云开发控制台 → 云函数 → `polish` → 配置 → **环境变量**，新增：
   - `LLM_API_BASE` = `https://api.deepseek.com/v1`
   - `LLM_API_KEY` = 你的 DeepSeek Key（敏感）
   - `LLM_MODEL` = `deepseek-chat`
   > 建议用**非推理模型**（如 `deepseek-chat`）。推理模型（`deepseek-reasoner`）可能把
   > `max_tokens` 耗在 reasoning 上导致空返回。
5. **Web 端接法**：云开发控制台 → HTTP 访问服务 → 添加路径 `/polish` → 关联云函数 `polish`。
   拿到的地址填进翻译器设置「LLM 润色（云端代理）」即可。
6. 小程序端无需额外配置：翻译页打开「润色」开关（`app.js` 初始化云开发后自动可用）。

> 小程序端已内置：`services/prefs.js` 的 `polish` 开关（默认关）、`services/content.js`
> 的 `polishViaCloud()`、翻译页「润色」开关与「已润色 ♥」标记。未配置云开发时自动退回纯本地翻译。

---

## 方案对比（Cloudflare / Vercel 仅覆盖 Web）

| 维度 | 微信云开发 | Cloudflare Worker | Vercel 函数 |
|------|-----------|-------------------|-------------|
| 覆盖端 | **Web + 小程序** ✅ | 仅 Web | 仅 Web |
| 小程序合法域名 | 免备案 ✅ | 过不了 ❌ | 过不了 ❌ |
| 路由 | `wx.cloud.callFunction` / `https://<env>.service.tcloudbase.com/polish` | `https://<子域>.workers.dev/polish` | `https://<域名>/api/polish` |
| 国内可达性 | 好 | 差（常被限速） | 一般（绑备案域名更稳） |
| 部署复杂度 | 低（开发者工具右键上传） | 低（`wrangler deploy`） | 低（CLI / Git） |
| 适合 | **双端首选**：小程序必须走这条 | Web 且网络可连 Cloudflare | 前端已在 Vercel |

> **结论**：只要你要**同时上线 Web + 小程序**，就用 **方案 0 微信云开发**（一套搞定）。
> Cloudflare / Vercel 仅作「只做 Web、且想用免费边缘函数」时的备选。

---

## 环境变量（三者通用）

| 变量 | 说明 | 示例 |
|------|------|------|
| `LLM_API_KIND` | `openai`（默认，OpenAI 兼容）或 `ollama` | `openai` |
| `LLM_API_BASE` | 大模型 base。`openai` 填到 `/v1`；`ollama` 填到根 | `https://api.deepseek.com/v1` |
| `LLM_API_KEY` | **密钥**，绝不下发前端 | `sk-xxxx`（用 secret / 加密变量存） |
| `LLM_MODEL` | 模型名 | `deepseek-chat` / `qwen-plus` / `qwen3:8b` |
| `LLM_TIMEOUT_MS` | 单次超时，默认 30000 | `30000` |

**推荐云端模型**（OpenAI 兼容、便宜、中文好）：DeepSeek `deepseek-chat`、
通义 `qwen-plus` / `qwen-max`、OpenAI `gpt-4o-mini`。本地自测可用 Ollama `qwen3:8b`。

> ⚠️ 提示词已用 few-shot 把「淋语是目标语言」钉死，并带字符级护栏，模型几乎不会翻回中文；
> 但任何异常都会**安全回退到规则草稿**，翻译器永远有可用输出。

---

## 方案 A · Cloudflare Worker（推荐）

```bash
# 1) 安装 CLI（已有可跳过）
npm i -g wrangler

# 2) 进入工程目录
cd server/cloudflare

# 3) 登录（首次）
wrangler login

# 4) 配置密钥（交互式粘贴，绝不进代码库）
wrangler secret put LLM_API_KEY
# 非敏感项（模型/base/kind）已在 wrangler.toml 的 [vars] 里，按需改

# 5) 一键部署
wrangler deploy
# 输出类似：https://linyu-polish-proxy.<你的子域>.workers.dev
```

部署完成后，润色端点为 `https://<你的子域>.workers.dev/polish`。
本地调试可用 `wrangler dev`（会注入 `wrangler.toml` 里的 `[vars]`）。

---

## 方案 B · Vercel 函数（备选）

> 国内网络下 `vercel.com` 通常比 `dash.cloudflare.com` 好连；若浏览器授权页打不开，
> 用文末的「Token 直连」方式跳过 OAuth。

```bash
# 1) 进入工程根（server/ 目录即 Vercel 项目根）
cd server

# 2) 安装 CLI（本地装，走 npmmirror 源更快；也可用 npx vercel 免安装）
npm config set registry https://registry.npmmirror.com
npm install vercel

# 3) 登录（首次；选 GitHub / Email，浏览器里点授权）
npx vercel login

# 4) 配置环境变量（也可在 Vercel 后台 Project → Settings → Environment Variables 配）
npx vercel env add LLM_API_KIND      # openai
npx vercel env add LLM_API_BASE      # https://api.deepseek.com/v1
npx vercel env add LLM_API_KEY       # 你的 API Key（敏感）
npx vercel env add LLM_MODEL         # deepseek-chat

# 5) 部署到生产
npx vercel --prod
# 函数自动识别 api/polish.mjs，路由为 /api/polish
```

**Token 直连（浏览器授权打不开时）**：去 `https://vercel.com/account/tokens` 建一个 Token，然后
`npx vercel --token <你的token> --prod` 即可部署，无需 OAuth。

部署完成后，润色端点为 `https://<你的域名>/api/polish`。
`vercel.json` 已锁定 30s 超时，`package.json` 已声明 Node 22。

---

## 客户端如何接上（你已实现的代码）

翻译器设置里填「LLM 润色（云端代理）」地址，存进偏好 `polishProxyUrl`：

- **Cloudflare**：`https://<子域>.workers.dev/polish`
- **Vercel**：`https://<域名>/api/polish`

Web / 小程序端 `src/mobile/api.js`（及 `src/renderer/mobile/api.js`）会按该地址注入
`createHttpProxyClient`，开启「LLM 润色」后自动把 `{source, draft}` 发到代理，
并用 `retentionOk` 做客户端二次兜底。本地 Node 自测：

```bash
# 起本地代理（指向本机 Ollama）
LLM_API_KIND=ollama LLM_API_BASE=http://localhost:11434 LLM_MODEL=qwen3:8b \
  node server/polish-proxy.cjs
# 另开终端跑 Web/小程序链路演示
PROXY_URL=http://localhost:8787/polish node server/demo-web-client.cjs
```

---

## 微信小程序特别注意（重要）

微信小程序对 request 域名有三条硬性要求，**`*.vercel.app` / `*.workers.dev` 这类免费域名过不了**：

1. **必须 HTTPS**（CF/Vercel 默认提供）；
2. **必须 ICP 备案**并**加入后台合法域名**（公众平台 → 开发管理 → 服务器域名 → request 合法域名）——
   `.vercel.app`、`.workers.dev` 无法备案，**所以小程序端不能直接指向它们**；
3. 不要在小程序里硬编码 Key —— Key 只在服务端。

**给小程序端的现实结论：**

| 端 | 可用端点 | 说明 |
|----|----------|------|
| Web（浏览器） | `https://<域名>/api/polish` | Vercel 默认域名在大陆可能不稳，最好绑自有已备案域名 |
| 小程序 | **需备案域名** | 要么给 Vercel 绑自有已备案域名；要么改用**微信云开发 / 腾讯云函数 + API 网关（备案域名）** |

> 最省心的国内方案：**微信云开发（CloudBase）**小程序原生支持，免域名备案、免合法域名配置，
> 把 `prompt.mjs` 的提示词+护栏搬进云函数即可；Web 端若也面向国内用户，建议用腾讯云函数 + 已备案域名。

---

## 目录结构

```
server/
├─ prompt.mjs              # 服务端唯一真源：提示词 + 护栏（被三者共用）
├─ polish-proxy.cjs        # 本地 Node 代理（零依赖，动态 import prompt.mjs）
├─ demo-web-client.cjs     # Web/小程序链路演示
├─ cloudflare/
│  ├─ worker.js            # Cloudflare Worker 入口（import ../prompt.mjs）
│  └─ wrangler.toml        # Worker 配置（[vars] 放非敏感项）
├─ api/
│  └─ polish.mjs           # Vercel 函数入口（import ../prompt.mjs）
├─ vercel.json            # Vercel 函数超时配置
├─ package.json           # 声明 Node 22（Vercel 识别为 Node 项目）
└─ DEPLOY.md              # 本文件
```

> 浏览器/桌面端用的是 `src/core/llm-polish.js` 里的同名副本（需与 `prompt.mjs` 同步修改）。
