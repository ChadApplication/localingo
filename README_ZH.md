# Next.js + FastAPI 全栈入门模板

内置身份认证、基于会话的数据隔离、异步后台处理和分步工作流基础设施的生产级全栈入门模板。

## 前置要求

- Python 3.12+
- Node.js 18+

## 快速开始

```bash
git clone https://github.com/ChadApplication/_template.git
cd _template
./setup.sh          # 一键安装 (venv + npm + DB + seed)
./run.sh start      # 启动服务器
```

打开 http://localhost:3001 并使用 `admin` / `admin` 登录。

### 默认账户

| 用户名 | 密码 | 角色 |
|----------|----------|------|
| admin | admin | ADMIN |
| guest | guest | GUEST |

### 命令

```bash
./run.sh start      # 启动 Backend + Frontend
./run.sh stop       # 停止所有服务器
./run.sh restart    # 重启
./run.sh live       # 启动 + 实时日志流
```

## 技术栈
- **Backend:** Python 3.12 / FastAPI
- **Frontend:** Next.js 15 (App Router) / React 19 / TailwindCSS / TypeScript
- **Database:** Prisma ORM / SQLite（默认）
- **Auth:** NextAuth.js (Credentials Provider)

---

## 核心功能

### 1. 身份认证 (NextAuth + Prisma)
- 邮箱/密码登录和注册
- 用于账户管理的 `User` 模型
- 客户端和服务端组件间的统一认证会话
- **Bearer 令牌认证** — 后端 `verify_token()` 从 `Authorization: Bearer {user_id}` 头中提取 user_id
- **401 自动重定向** — 未认证请求返回 401，前端自动重定向到 `/login`
- **无匿名回退** — `mock_token` 或缺失的令牌会被拒绝（防止数据污染）

### 2. 基于会话的项目管理
- 每次"新分析"在 `temp_uploads/{user_id}/{session_id}/` 创建唯一的 `session_id` 目录
- **项目元数据**：仪表板上的卡片视图，包含标题、描述、创建日期、最后修改日期
- **步骤完成追踪**：`GET /api/session/status` 自动检测哪些步骤已有结果
- **单步重置**：`DELETE /api/step/{step}` 清除特定步骤数据，不影响其他步骤
- **单步恢复**：`GET /api/step/{step}/results` 返回缓存结果以即时恢复 UI
- **变量持久化**：`POST/GET /api/variables` 按会话保存和恢复变量定义

### 3. 异步后台处理
- **Fire-and-forget 模式** — 长时间运行的 LLM 端点立即返回 `{status: "processing"}`
- **后台任务追踪** — `llm_tasks` 字典以 `"{user_id}:{step}"` 为键，防止跨步骤状态污染
- **进度轮询** — `GET /api/progress?step=X` 返回实时进度 + 任务完成状态
- **用户级锁定** — 每用户 `asyncio.Lock` 防止并发破坏性操作
- **tqdm 集成** — 进度更新被猴子补丁写入 `progress.json` 供前端轮询
- **代理超时** — `next.config.ts` 设置 `proxyTimeout: 300_000`（5分钟）

### 4. CSV 安全处理
- **全局 `to_csv` 猴子补丁** — 所有 `DataFrame.to_csv()` 调用自动使用 `quoting=csv.QUOTE_ALL`
- 防止数据中特殊字符导致的 `need to escape, but no escapechar set` 错误

### 5. UI/UX
- **多语言 (i18n)**：通过用户设置或浏览器 cookie 支持韩语、英语、中文
- **暗色模式**：`next-themes` 无水合闪烁
- **应用内提示**：`react-hot-toast` 显示所有反馈消息
- **活动追踪器**：将页面访问、按钮点击、IP/UserAgent 记录到数据库

### 6. API 代理与基础设施
- **Next.js rewrites** 将 `/api/*` 代理到 FastAPI 后端（从 `.run_ports` 自动检测端口）
- **后端端口发现** — `run.sh` 查找空闲端口，写入 `.run_ports`，前端读取
- **日志捕获** — `uvicorn.run(main.app)` 模式（非 `-m uvicorn`）以正确捕获 stdout
- **日志存于 /tmp** — 避免 Dropbox/云同步对日志缓冲的干扰

---

## API 端点

### 会话管理
| 方法 | 端点 | 说明 |
|--------|----------|-------------|
| POST | `/api/sessions` | 创建新会话 |
| GET | `/api/sessions` | 列出用户的所有会话 |
| DELETE | `/api/sessions/{session_id}` | 删除会话 |
| GET | `/api/session/status` | 步骤完成状态 |

### 步骤数据（每个分析步骤）
| 方法 | 端点 | 说明 |
|--------|----------|-------------|
| GET | `/api/step/{step}/results` | 获取缓存的步骤结果 |
| DELETE | `/api/step/{step}` | 删除步骤相关文件 |
| GET | `/api/progress?step=X` | 进度 + 任务状态 |

### 数据持久化
| 方法 | 端点 | 说明 |
|--------|----------|-------------|
| POST | `/api/variables` | 保存变量定义 |
| GET | `/api/variables` | 加载变量定义 |
| POST | `/api/research-info` | 保存研究元数据 |
| GET | `/api/research-info` | 加载研究元数据 |

### 用户设置
| 方法 | 端点 | 说明 |
|--------|----------|-------------|
| GET | `/api/settings` | 获取用户设置 |
| POST | `/api/settings` | 保存用户设置 |

---

## 快速开始

### 1. 克隆并配置
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. 后端设置
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 前端设置
```bash
cd frontend
npm install
npx prisma db push
npx prisma generate
```

### 4. 运行两个服务器
```bash
./run.sh start
```

### 默认端口
- **Frontend:** http://localhost:3001
- **Backend:** http://localhost:8001
- **API Docs:** http://localhost:8001/docs

### 其他命令
```bash
./run.sh stop      # 停止所有服务器
./run.sh restart   # 重启所有服务器
./run.sh status    # 检查服务器状态
./run.sh live      # 实时日志流
```

---

## 架构

```
_template_latest/
├── backend/
│   ├── main.py                    # FastAPI 应用 + 会话基础设施
│   ├── app/
│   │   └── routers/
│   │       └── session.py         # 会话 CRUD (Bearer 认证)
│   ├── services/
│   │   └── user_settings_service.py
│   ├── temp_uploads/              # 按用户、按会话的数据 (gitignored)
│   │   └── {user_id}/
│   │       └── {session_id}/
│   │           ├── variables.json
│   │           ├── research_info.json
│   │           ├── *_results.csv
│   │           └── progress.json
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/         # 会话列表 + 创建
│   │   │   ├── analysis/[id]/     # 工作区（分析步骤）
│   │   │   ├── login/
│   │   │   └── admin/
│   │   ├── components/
│   │   ├── services/
│   │   │   └── sessionApi.ts      # Bearer 认证 + 401 重定向
│   │   └── auth.ts                # NextAuth 配置
│   ├── next.config.ts             # 代理 rewrites + 300秒超时
│   └── package.json
├── run.sh                         # 启动/停止/重启/实时日志
└── .gitignore
```

---

## 添加新的分析步骤

要在工作流中添加新步骤：

1. **Backend**：添加 `(user_id, session_id, ...)` 签名的服务函数
2. **Backend**：在 `main.py` 中使用 `_run_llm_in_background()` 添加异步处理端点
3. **Frontend**：创建包含 `getToken` prop、`restoredOnce` 恢复守卫、使用后端 DELETE 的 `handleReset` 的组件
4. **Frontend**：添加 `step=your_step_name` 参数的进度轮询
5. **Backend**：`GET /api/session/status` 和 `DELETE /api/step/{step}` 端点自动检测匹配 `*_results.csv`/`*_results.json` 的文件

---

## 关键模式

### 认证流程
```
Frontend getToken() → session.user.id
    ↓
Authorization: Bearer {user_id}
    ↓
Backend verify_token() → {"sub": user_id}
    ↓
401 if missing/invalid → Frontend redirects to /login
```

### 异步处理流程
```
POST /api/your-endpoint → returns {status: "processing"} immediately
    ↓
Background: _run_llm_in_background(user_id, "step_name", service_fn, ...)
    ↓
Frontend polls: GET /api/progress?step=step_name
    ↓
{status: "complete", result: {...}} or {status: "error", error: "..."}
```

### 会话数据隔离
```
temp_uploads/
├── user_abc/
│   ├── session_001/     ← 隔离的工作区
│   │   ├── variables.json
│   │   └── step_results.csv
│   └── session_002/     ← 独立的工作区
│       └── ...
└── user_xyz/            ← 不同用户，无交叉访问
    └── ...
```

## 变更日志

### v0.0.1 (2026-03-17)

- 初始公开发布
- macOS bash 3.2 兼容性修复 (run.sh)
- Python 3.12.8 迁移
- 数据库种子自动化（admin/guest 账户，通过 setup.sh）
- dev.db 从 git 追踪中移除
- 带自动版本号的版权页脚
- setup.sh 一键安装

## 许可证

Copyright (c) chadchae
