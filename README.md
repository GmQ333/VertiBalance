# 眩衡 VertiBalance

眩衡是面向眩晕患者、临床医生和平台管理员的三端 Web 智能辅助诊疗平台，覆盖预问诊、危险筛查、报告、挂号移交、医生接诊、随访和平台治理。

## 从零启动

### 1. 准备环境

- 安装 Node.js 22.5 或更高版本（数据库层使用 Node.js 内置 SQLite API）。
- 安装 Git。
- 确保本机的 `4173` 端口未被占用，或在环境变量中修改 `PORT`。

可先确认 Node.js 和 npm 版本：

```bash
node -v
npm -v
```

### 2. 拉取代码并安装依赖

```bash
git clone <仓库地址>
cd VertiBalance2
npm ci
```

如果拿到的是不包含 `package-lock.json` 的源码包，使用 `npm install` 代替 `npm ci`。

### 3. 配置环境变量

```bash
cp .env.example .env
```

然后编辑 `.env`。如需仅在当前机器覆盖某些配置，可创建 `.env.local`，同名变量以 `.env.local` 为准：

```dotenv
MEDCHAT_API_BASE_URL=https://api.modagent-homing.com/v1
MEDCHAT_API_KEY=替换为实际的大模型密钥
MEDCHAT_MODEL=deepseek-v4-pro
AUTH_SECRET=替换为至少32位的随机字符串
PORT=4173
DATABASE_PATH=./data/vertibalance.sqlite
UPLOAD_DIRECTORY=./data/uploads
BACKUP_ROOT=./backups
```

`MEDCHAT_API_KEY` 未配置时，平台的普通业务功能仍可启动，但调用大模型的功能会显示服务未配置或降级提示。真实密钥只能放在已被 Git 忽略的 `.env`、`.env.local` 或服务器环境变量中，不能提交到 Git，也不能使用会暴露到浏览器的 `VITE_*` 前端变量。

### 4. 启动开发环境

```bash
npm run dev
```

浏览器访问 `http://localhost:4173`。停止服务可在终端按 `Ctrl+C`。

首次启动会自动完成以下工作：

- 创建 `data/vertibalance.sqlite` SQLite 数据库；
- 执行 `server/migrations/` 中全部尚未应用的数据库迁移；
- 初始化演示账号和演示业务数据；
- 创建受保护的 `data/uploads/` 上传目录；
- 检查数据库完整性和审计日志哈希链。

因此，全新拉取代码后**不需要手动创建数据库、数据表或执行 SQL 文件**。以后启动时也会自动补齐新版本迁移，不会重复初始化已有数据。

### 5. 生产构建与启动

```bash
npm ci
npm run build
npm start
```

生产模式必须设置一个不可预测的 `AUTH_SECRET`，并建议通过进程管理器或容器持续运行服务。启动后仍访问 `http://<服务器地址>:4173`，也可以在前面配置 Nginx 等反向代理和 HTTPS。

### 6. 验证安装

```bash
npm test
npm run build
```

测试和构建均成功后，说明依赖、后端接口、数据库和前端构建环境工作正常。

### 迁移已有业务数据（可选）

数据库、上传文件、`.env.local` 和备份目录都被 Git 忽略，所以其他人仅拉取代码时会得到一套全新的演示数据库，不会自动取得原环境中的患者数据。

如果需要迁移已有数据，应先在原环境执行：

```bash
npm run db:backup
```

安全传输生成的完整备份目录后，在新环境恢复到尚不存在的目标路径：

```bash
RESTORE_FROM=/path/to/backup \
RESTORE_DATABASE_PATH=/path/to/data/vertibalance.sqlite \
RESTORE_UPLOAD_DIRECTORY=/path/to/data/uploads \
npm run db:restore
```

恢复完成后，将 `.env.local` 中的 `DATABASE_PATH` 和 `UPLOAD_DIRECTORY` 指向上述目标路径再启动服务。不要把真实患者数据库、上传资料或 API 密钥提交到代码仓库。

## 演示账号

统一密码：`Verti123!`

| 角色 | 账号 |
| --- | --- |
| 患者 | `patient@demo.com` |
| 医生 | `doctor@demo.com` |
| 管理员 | `admin@demo.com` |

患者也可以从登录页完成自助注册。医生账号必须由管理员创建并审核。

## 已实现能力

### 患者端

- 注册登录、账号状态校验和角色数据隔离。
- 引导式智能问诊、完整上下文保存、30 秒模型超时和降级提示。
- 危险信号规则优先筛查；命中后模型不能降低风险等级。
- 结构化问诊报告、历史报告、就医科室与时效建议。
- 实时号源、挂号唯一性校验、取消挂号和问诊资料移交。
- 康复随访、异常反馈、定时就诊/随访提醒和站内通知。
- 健康科普、检查资料上传与授权下载、平台反馈。

### 医生端

- 仅展示挂号后授权给当前医生的患者，并按风险排序。
- 查看原始对话、AI 摘要、风险信号、历史处置、随访和患者补充文件。
- 真实调用模型生成结构化辅助分析；结果与医生意见分开保存。
- 提交临床诊断、检查、治疗、用药、复诊和随访计划。
- 创建随访任务、查看异常患者反馈和个人排班。

### 管理端

- 用户、角色、医生资质审核和账号启停。
- 科室、医生排班、号源和排班冲突校验。
- 科普知识发布/下线以及可即时生效的危险信号规则。
- 模型版本新增、服务地址安全校验、连通性检查和激活切换。
- 新问诊固定生效模型版本，进行中会话不随切换中断。
- 八类运营指标、脱敏模型调用记录、用户反馈和只追加审计日志。

## 数据与安全

- 密码使用带随机盐的 `scrypt` 哈希。
- 会话令牌使用 HMAC-SHA256 签名，默认 8 小时失效。
- 权限由后端校验；越权事件、资料访问和关键修改均写审计日志。
- 使用 SQLite WAL 关系型数据库，核心实体具有外键、唯一约束、状态约束和索引。
- 多实体业务写入使用 `BEGIN IMMEDIATE` 数据库事务；模型网络调用保持在事务之外。
- 同一问诊会话的消息请求串行处理，避免上下文并发错乱。
- 审计日志由数据库触发器限制为只追加，并通过 SHA-256 哈希链检测离线篡改。
- 上传限制为单个 5MB，仅允许内容签名匹配的 PDF、JPG 和 PNG；文件存储目录不公开。
- 模型地址禁止本地或私网 URL，防止管理配置导致 SSRF。
- `.env.local`、运行数据和患者上传目录均被 Git 忽略。

本地数据保存在 `data/vertibalance.sqlite`。数据库启动时自动执行 `server/migrations/` 中尚未应用的版本化 SQL；首次升级会从已有的 `data/vertibalance.json` 一次性导入数据，后续以 SQLite 为唯一数据源。

创建包含数据库、患者上传资料和 SHA-256 校验清单的一致性备份：

```bash
npm run db:backup
```

备份默认写入被 Git 忽略的 `backups/`。生产环境应将该目录同步到独立加密存储，并定期执行恢复演练。

恢复操作会先验证校验清单和数据库完整性，并拒绝覆盖已有目标：

```bash
RESTORE_FROM=/path/to/backup \
RESTORE_DATABASE_PATH=/path/to/new/vertibalance.sqlite \
RESTORE_UPLOAD_DIRECTORY=/path/to/new/uploads \
npm run db:restore
```

## 验证

```bash
npm test
npm run build
```

本地业务闭环冒烟测试：

```bash
SKIP_EXTERNAL=1 node scripts/smoke.mjs
```

自动测试为患者端、医生端和管理端分别创建隔离临时数据库，覆盖当前全部 API 路由、注册、权限隔离、危险筛查、报告、文件上传、挂号移交、医生资料访问、处置、随访、通知、管理写入、事务回滚、备份和审计防篡改。医生 AI 结构化解析通过本地模拟响应测试，避免测试病历被发送到外部服务。

## 主要接口

- `/api/v1/auth/*`：注册、登录和当前用户。
- `/api/v1/consultations/*`：问诊会话、消息和报告生成。
- `/api/v1/reports`、`/schedules`、`/bookings`：报告和挂号闭环。
- `/api/v1/followups`、`/notifications`：随访反馈和提醒。
- `/api/v1/uploads`：受控医疗资料上传与授权下载。
- `/api/v1/doctor/*`：工作台、患者资料、AI 分析、处置和随访。
- `/api/v1/admin/*`：用户、排班、知识、规则、模型、统计与审计。

平台所有 AI 输出均为辅助信息，不能替代医生进行临床诊断和治疗决策。
