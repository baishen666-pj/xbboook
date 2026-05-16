# Xbboook — AI 网文写作工作台

## 项目概述

Xbboook 是一个 AI 辅助的中文网文写作工作台，提供项目管理、章节编辑、AI 写作辅助、角色管理、世界观构建、大纲管理、伏笔追踪、片段管理、故事弧线等功能。

## 技术栈

- **前端**: React 19 + Vite 6 + Tiptap 2.x + Zustand 5 + Tailwind CSS 4
- **后端**: Express 5 + better-sqlite3 + ws (WebSocket)
- **AI**: 多供应商支持 (OpenAI 兼容 API) + SSE 流式输出
- **测试**: Vitest + supertest + jsdom

## 项目结构

```
xbboook/
├── src/                          # 前端
│   ├── components/               # React 组件
│   │   ├── ai-panel/             # AI 写作面板
│   │   ├── characters/           # 角色管理
│   │   ├── editor/               # Tiptap 编辑器
│   │   ├── foreshadowing/        # 伏笔管理
│   │   ├── outline/              # 大纲管理
│   │   ├── search/               # 搜索面板
│   │   ├── settings/             # 设置面板
│   │   ├── sidebar/              # 侧边栏
│   │   ├── snippets/             # 片段管理
│   │   ├── story-arcs/           # 故事弧线
│   │   └── worldview/            # 世界观管理
│   ├── stores/                   # Zustand stores
│   ├── services/                 # API 服务
│   ├── hooks/                    # 自定义 hooks
│   └── lib/                      # 工具函数
├── server/                       # 后端
│   ├── ai/                       # AI 模块
│   │   ├── agentFactory.ts       # SSE 流式客户端 + 重试/超时
│   │   ├── chapterPipeline.ts    # 多章节批量生成
│   │   ├── configStore.ts        # 供应商配置
│   │   ├── contextBuilder.ts     # 上下文编译 (CJK-aware token 估算)
│   │   ├── contextCache.ts       # 60s TTL LRU 缓存
│   │   ├── promptBuilder.ts      # 提示词组装
│   │   ├── providers.ts          # 供应商适配器
│   │   └── writingSkills.ts      # 写作技能定义
│   ├── db/                       # 数据库
│   │   ├── database.ts           # 连接管理
│   │   ├── migrations.ts         # 版本化迁移系统
│   │   ├── schemaDefinitions.ts  # Schema 定义
│   │   └── repositories/         # 仓储层 (16 个 repo)
│   ├── middleware/                # 中间件
│   │   ├── errors.ts             # 自定义错误类
│   │   ├── errorHandler.ts       # 全局错误处理
│   │   ├── logger.ts             # pino 结构化日志
│   │   ├── rateLimit.ts          # 速率限制
│   │   ├── sse.ts                # SSE 工具
│   │   └── validate.ts           # Zod 验证
│   ├── plugins/                  # 插件系统
│   ├── routes/                   # 20+ API 路由
│   ├── services/                 # 业务逻辑
│   ├── types/                    # TypeScript 类型
│   └── ws/                       # WebSocket 协作
└── tests/                        # 测试
    ├── api/                      # API 集成测试
    ├── unit/                     # 单元测试
    ├── repo/                     # 仓储层测试
    └── helpers/                  # 测试辅助
```

## API 路由 (20+)

| 路由 | 端点 | 说明 |
|------|------|------|
| projects | /api/projects | 项目 CRUD |
| volumes | /api/projects/:id/volumes | 卷管理 |
| chapters | /api/projects/:id/chapters | 章节 CRUD |
| versions | /api/projects/:id/chapters/:cid/versions | 版本历史 |
| characters | /api/projects/:id/characters | 角色管理 (含语音字段) |
| worldviews | /api/projects/:id/worldview | 世界观 |
| outlines | /api/projects/:id/outlines | 大纲管理 |
| stats | /api/projects/:id/stats | 写作统计 |
| export | /api/projects/:id/export | 导出 (TXT/MD/EPUB/DOCX/PDF) |
| search | /api/projects/:id/search | 全文搜索 |
| storyArcs | /api/projects/:id/story | 故事弧线与情节线 |
| ai | /api/ai | AI 写作 (含批量生成、补全、上下文摘要) |
| templates | /api/templates | 模板管理 |
| users | /api/users | 用户设置 |
| collab | /api/projects/:id/collab | WebSocket 协作 |
| comments | /api/projects/:id/chapters/:cid/comments | 批注 (需认证) |
| backups | /api/backups | 备份管理 |
| import | /api/projects | 项目导入 |
| foreshadowing | /api/foreshadowing/:id | 伏笔管理 |
| snippets | /api/snippets/:id | 片段管理 |
| health | /api/health | 健康检查 |

## AI 写作技能 (24 个)

| 技能 | 说明 |
|------|------|
| continue-writing | 续写 |
| polish | 润色 |
| expand | 扩写 |
| condense | 缩写 |
| rewrite | 改写 |
| character-dialogue | 角色对话 |
| scene-description | 场景描写 |
| plot-twist | 情节转折 |
| chapter-generate | 大纲生章 |
| chapter-summarize | 章节摘要 |
| plot-planning | 情节规划 |
| worldbuilding | 世界观构建 |
| character-design | 角色设计 |
| opening-hook | 开头钩子 |
| ending-cliffhanger | 结尾悬念 |
| foreshadowing-setup | 伏笔埋设 |
| foreshadowing-payoff | 伏笔回收 |
| style-imitation | 风格模仿 |
| style-analysis | 风格分析 |
| plot-suggest | 情节推荐 |
| foreshadowing-track | 伏笔追踪 |
| consistency-scan | 一致性扫描 |
| writing-advice | 写作建议 |
| qa | 问答 |

## 数据库表 (18 个)

projects, volumes, chapters, chapter_versions, characters, character_relations, worldviews, outlines, outline_nodes, writing_stats, templates, users, comments, foreshadowing_items, foreshadowing_links, snippet_templates, story_arcs, plot_threads

## 关键约定

- **数据库**: better-sqlite3 WAL 模式，仓储模式封装
- **迁移**: 版本化迁移系统 (schema_migrations 表)
- **错误处理**: AppError/NotFoundError/ValidationError/AuthError/ForbiddenError
- **日志**: pino 结构化日志，请求 ID 追踪
- **Token 估算**: CJK-aware 双比率估算 (中文 ~1.5 chars/token, ASCII ~4.0)
- **上下文编译**: Lost-in-Middle 排序，优先级 1-10
- **AI 流式**: SSE (Server-Sent Events)
- **AI 重试**: 429/5xx 最多 3 次，指数退避，120s 超时
- **AI 缓存**: 60s TTL 项目级 LRU 缓存
- **前端状态**: Zustand stores，按功能拆分，细粒度选择器
- **测试**: vitest --pool=forks，1560+ 测试
- **安全**: baseUrl SSRF 防护、API Key 脱敏、WebSocket origin 校验、EPUB HTML 净化

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npx vitest run       # 运行测试
npx vitest run --pool=forks  # 稳定运行测试
```

## 环境变量

```bash
AI_API_KEY=          # AI API 密钥
AI_BASE_URL=         # AI API 基础 URL
AI_MODEL=            # 默认模型名称
PORT=3210            # 服务端口
LOG_LEVEL=info       # 日志级别
NODE_ENV=development # 环境
```

## 部署

```bash
# 生产启动
cd E:\xbbook && nohup npx tsx server/index.ts > data/logs/server.log 2>&1 &

# PM2
# ecosystem.config.cjs 用 ./node_modules/.bin/tsx 作为 interpreter
```

- **数据库**: `E:\xbbook\data\novel-pen.db`
- **注意**: 部署时需同步 server/plugins/ 目录
