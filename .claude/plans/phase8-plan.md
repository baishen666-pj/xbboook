# Phase 8 实施计划

## 概览

Phase 8 聚焦三个方向：AI 深度增强、工程质量提升、测试覆盖增强，分为三个子阶段顺序实施。

---

## 子阶段 8A：工程质量提升（基础设施先行）

> 先修基础设施，为 8B/8C 的 AI 功能提供更好的工程支撑。

### 8A-1: 结构化日志 pino

**修改文件**: `server/middleware/logger.ts`（新建）, `server/app.ts`

```typescript
// server/middleware/logger.ts
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// 请求 ID 中间件
export function requestIdMiddleware(req, res, next) {
  req.id = crypto.randomUUID();
  next();
}
```

**app.ts 变更**: 替换 `console.log` → `logger.info`，添加 requestIdMiddleware

### 8A-2: 自定义错误类

**修改文件**: `server/middleware/errors.ts`（新建）, `server/middleware/errorHandler.ts`, 所有 routes

```typescript
// server/middleware/errors.ts
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, `${resource}${id ? ` ${id}` : ''} not found`);
  }
}
export class ValidationError extends AppError {
  constructor(message: string) { super(400, message); }
}
export class AuthError extends AppError {
  constructor(message = 'Unauthorized') { super(401, message); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(403, message); }
}
```

**errorHandler.ts 变更**: 使用 `err.statusCode || 500`，移除硬编码 500

### 8A-3: 迁移版本追踪

**修改文件**: `server/db/migrations.ts`

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);
```

- 每个 migration 标记版本号
- 运行前检查 schema_migrations 是否已应用
- ALTER 语句包裹在事务中
- 清理冗余 ALTER（合并同表操作）

### 8A-4: 搜索路由提取 + FTS5

**新建文件**: `server/routes/search.ts`

- 从 `chapters.ts` 提取搜索端点
- 添加 FTS5 虚拟表：

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
  title, content,
  content=chapters, content_rowid=id
);
```

- 添加触发器自动同步 FTS 索引
- 添加 `POST /api/search/rebuild` 重建索引
- `app.ts` 注册新路由

### 8A-5: 健康检查端点

**新建文件**: `server/routes/health.ts`

```typescript
router.get('/', (req, res) => {
  const dbOk = db.prepare('SELECT 1').get();
  res.json({ status: 'ok', uptime: process.uptime(), version: pkg.version, db: !!dbOk });
});
```

### 8A-6: 更新 CLAUDE.md

反映当前状态：19 路由、16 AI skills、所有功能列表

### 8A 测试计划

- `tests/api/health-routes.test.ts` - 健康检查
- `tests/api/search-routes.test.ts` - 搜索路由
- `tests/unit/errors.test.ts` - 错误类
- `tests/unit/migrations.test.ts` - 迁移版本追踪
- 现有 851 测试必须继续通过

---

## 子阶段 8B：AI 深度增强

### 8B-1: 中文 Token 估算修正

**修改文件**: `server/ai/contextBuilder.ts`

当前问题：`CHARS_PER_TOKEN = 2.5` 对中文不准确（中文约 1.5 字符/token）

```typescript
// 替换固定 CHARS_PER_TOKEN
function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const totalChars = text.length;
  const cjkRatio = cjkCount / totalChars;
  // CJK: ~1.5 chars/token, ASCII: ~4.0 chars/token
  const effectiveCharsPerToken = cjkRatio * 1.5 + (1 - cjkRatio) * 4.0;
  return Math.ceil(totalChars / effectiveCharsPerToken);
}
```

- 替换所有 `Math.ceil(text.length / CHARS_PER_TOKEN)` 调用
- 添加 `estimateTokens` 单元测试

### 8B-2: 角色语音一致性

**修改文件**:
- `server/db/migrations.ts` - 添加 voice 字段
- `server/repositories/characterRepo.ts` - 更新 CRUD
- `server/ai/contextBuilder.ts` - 提升角色优先级
- `server/ai/writingSkills.ts` - 所有技能使用语音数据
- `src/components/characters/CharacterEditor.tsx` - 语音编辑 UI

**数据库迁移**:
```sql
ALTER TABLE characters ADD COLUMN speech_style TEXT DEFAULT '';
ALTER TABLE characters ADD COLUMN verbal_tics TEXT DEFAULT '';
ALTER TABLE characters ADD COLUMN vocabulary_level TEXT DEFAULT 'common';
ALTER TABLE characters ADD COLUMN sentence_length_pref TEXT DEFAULT 'medium';
ALTER TABLE characters ADD COLUMN emotional_expressiveness TEXT DEFAULT 'moderate';
ALTER TABLE characters ADD COLUMN voice_examples TEXT DEFAULT '[]';
```

**contextBuilder 变更**: 角色资料优先级提升，防止被截断

**CharacterEditor 变更**: 添加"语音特征"折叠面板

### 8B-3: 故事弧线与情节线

**新建文件**:
- `server/repositories/storyArcRepo.ts`
- `server/repositories/plotThreadRepo.ts`
- `server/routes/storyArcs.ts`
- `src/stores/storyArcStore.ts`
- `src/components/story-arcs/StoryArcPanel.tsx`
- `src/components/story-arcs/ArcEditor.tsx`
- `src/components/story-arcs/ThreadList.tsx`

**数据库迁移**:
```sql
CREATE TABLE IF NOT EXISTS story_arcs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_chapter INTEGER,
  end_chapter INTEGER,
  status TEXT DEFAULT 'planned',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plot_threads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  arc_id TEXT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (arc_id) REFERENCES story_arcs(id) ON DELETE SET NULL
);
```

**API 端点**:
- `GET/POST /api/projects/:id/story-arcs`
- `GET/PUT/DELETE /api/story-arcs/:id`
- `GET/POST /api/story-arcs/:id/threads`
- `GET/PUT/DELETE /api/threads/:id`

**前端**: 侧边栏新增"故事弧线"标签页，树状结构展示弧线→情节线

### 8B-4: 多章节批量生成

**新建文件**:
- `server/ai/chapterPipeline.ts` - 后端流水线
- `src/components/ai-panel/BatchChapterGenPanel.tsx` - 前端面板

**chapterPipeline.ts 核心逻辑**:
```typescript
interface PipelineJob {
  projectId: string;
  chapterIds: string[];
  currentStep: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
}

async function runPipeline(job: PipelineJob): AsyncGenerator<PipelineEvent> {
  for (let i = 0; i < job.chapterIds.length; i++) {
    // 1. 编译上下文（含前文摘要）
    // 2. 调用 AI 生成
    // 3. 保存章节内容
    // 4. 生成章节摘要（供下一章使用）
    // 5. yield 进度事件
  }
}
```

**BatchChapterGenPanel**: 复用 BatchPolishPanel 的进度 UI 模式

**AI 技能**: 新增 `batch-chapter-gen` 技能，使用长上下文模型

### 8B-5: 渐进式章节摘要

**修改文件**:
- `server/db/migrations.ts` - 添加 summary 字段
- `server/repositories/chapterRepo.ts` - 更新
- `server/ai/writingSkills.ts` - 新增 `chapter-summarize` 技能
- `server/ai/contextBuilder.ts` - 使用摘要替代全文

**数据库迁移**:
```sql
ALTER TABLE chapters ADD COLUMN ai_summary TEXT DEFAULT '';
```

**contextBuilder 变更**: 远章用摘要替代全文，近章保留全文

### 8B 测试计划

- `tests/unit/tokenEstimation.test.ts` - 中文 token 估算
- `tests/api/story-arc-routes.test.ts` - 故事弧线 API
- `tests/api/plot-thread-routes.test.ts` - 情节线 API
- `tests/unit/chapterPipeline.test.ts` - 批量生成流水线
- `tests/unit/characterVoice.test.ts` - 角色语音数据
- 现有测试继续通过

---

## 子阶段 8C：测试覆盖增强

### 8C-1: 补全 API 路由测试

**新建文件**:
- `tests/api/backup-routes.test.ts`
- `tests/api/import-routes.test.ts`
- `tests/api/ai-routes.test.ts`

### 8C-2: 补全 Repo 测试

**新建文件**:
- `tests/repo/chapterRepo.test.ts`
- `tests/repo/foreshadowingRepo.test.ts`
- `tests/repo/snippetRepo.test.ts`
- `tests/repo/projectRepo.test.ts`

### 8C-3: 补全 Service 测试

**新建文件**:
- `tests/services/backupService.test.ts`
- `tests/services/aiService.test.ts`

### 8C-4: 覆盖率配置

**修改文件**: `vitest.config.ts`

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  include: ['src/**/*.{ts,tsx}', 'server/**/*.{ts,tsx}'],
  exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.config.*'],
  thresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
},
```

### 8C-5: 测试辅助函数去重

**修改文件**: `tests/helpers/setup.ts`

提取公共 `createTestDb()` 和 `createTestApp()` 到共享 helper

---

## 依赖关系

```
8A (工程质量) → 8B (AI增强) → 8C (测试覆盖)
     ↓               ↓
  8A-1~6 可并行    8B-1 先行（token修正是8B-3~5的基础）
                   8B-2, 8B-3 可并行
                   8B-4, 8B-5 依赖 8B-1, 8B-3
```

## 预估规模

| 子阶段 | 新建文件 | 修改文件 | 新增测试 |
|--------|---------|---------|---------|
| 8A | 4 | 8 | ~50 |
| 8B | 12 | 10 | ~80 |
| 8C | 8 | 2 | ~60 |
| **合计** | **24** | **20** | **~190** |
