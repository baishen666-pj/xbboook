# xbboook (网文笔阁)

AI 网文写作工作台 — 暗色主题、三栏布局、AI 辅助创作。

## 技术栈

- **前端**: React 19 + Vite + Tiptap 3.x + Zustand 5 + Tailwind CSS 4
- **后端**: Express + better-sqlite3 (WAL mode) + tsx
- **AI**: OpenAI 兼容 API（SSE 流式），环境变量配置
- **端口**: 后端 3210，前端 Vite dev 5210

## 开发命令

```bash
npm run dev        # 前端开发服务器
npm run server     # 后端 API 服务器
npm run dev:all    # 前后端同时启动
npm run build      # 生产构建
```

## AI 配置

```bash
AI_API_KEY=sk-xxx          # 必填
AI_BASE_URL=https://...    # 可选，默认 OpenAI
AI_MODEL=gpt-4o-mini       # 可选
```

## 项目结构

```
server/
  index.ts              # 入口 PORT 3210
  app.ts                # Express 路由挂载
  db/
    database.ts         # better-sqlite3 WAL
    migrations.ts       # 8 张表定义
    repositories/       # CRUD 数据访问层
  ai/
    agentFactory.ts     # OpenAI 兼容客户端 + SSE 流式
    writingSkills.ts    # 9 个写作技能定义
    contextBuilder.ts   # 上下文编译器（优先级+Token预算+Lost-in-Middle）
    promptBuilder.ts    # Prompt 组装
  services/
    aiService.ts        # AI 写作服务
    fileService.ts      # Markdown 文件读写
  routes/               # 8 个路由模块
  middleware/            # errorHandler + validate + sse

src/
  components/
    editor/             # NovelEditor (Tiptap) + EditorToolbar + GhostMark + ContextMenu
    ai-panel/           # AiPanel + ChatList + ChatInput + MessageBubble + SkillPicker + Settings
    sidebar/            # ChapterSidebar + VolumeTree + ChapterItem（可拖拽）
    character/          # CharacterList + Card + Form
    worldview/          # WorldviewList + Card + Form
    outline/            # OutlinePanel（树形大纲）
    stats/              # StatsPanel（统计图表）
    project/            # ProjectList + Card + CreateProjectModal
    layout/             # AppLayout + TitleBar + StatusBar + ResizablePanel
    ui/                 # Button + Input + Modal + ScrollArea
  stores/               # Zustand: projectStore + editorStore + uiStore + aiStore
  hooks/                # useAutoSave + useChapterContent + useAiChat + useKeyboardShortcuts
  services/             # API 客户端 + 各模块服务
  styles/               # tokens.css (oklch) + global.css + editor.css
  types/                # TypeScript 类型定义
```

## API 端点

| 路径 | 说明 |
|------|------|
| `GET/POST /api/projects` | 项目列表/创建 |
| `GET/PUT/DELETE /api/projects/:id` | 项目 CRUD |
| `GET/POST /api/projects/:projectId/volumes` | 卷管理 |
| `GET/POST /api/projects/:projectId/chapters` | 章节管理 |
| `PUT /api/projects/:projectId/chapters/reorder` | 章节排序 |
| `GET/POST /api/projects/:projectId/characters` | 角色管理 |
| `POST/DELETE .../characters/relations` | 角色关系 |
| `GET/POST /api/projects/:projectId/worldviews` | 世界观管理 |
| `GET/POST /api/projects/:projectId/outlines` | 大纲管理 |
| `GET/POST /api/projects/:projectId/stats` | 写作统计 |
| `GET /api/projects/:projectId/export/txt` | 导出 TXT |
| `GET /api/projects/:projectId/export/md` | 导出 Markdown |
| `GET /api/ai/skills` | AI 技能列表 |
| `GET /api/ai/status` | AI 配置状态 |
| `POST /api/ai/stream` | AI SSE 流式请求 |

## 快捷键

- `Ctrl+S` — 手动保存
- `Ctrl+Shift+F` — 全屏模式
- `Ctrl+B` — 切换侧边栏
- `Ctrl+Shift+A` — 切换 AI 面板
- `Esc` — 退出全屏

## 数据存储

- `data/xbboook.db` — SQLite 数据库（WAL 模式）
- `data/projects/{id}/chapters/{chapterId}.md` — 章节 Markdown 文件

## AI 技能（9 个）

续写 / 改写 / 润色 / 风格转换 / 对话生成 / 一致性检查 / 灵感激发 / 写作问答 / 去AI味
