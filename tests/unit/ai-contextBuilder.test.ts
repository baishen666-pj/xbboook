import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/services/fileService.js', () => ({
  readChapter: vi.fn().mockResolvedValue('章节内容'),
}));

vi.mock('../../server/db/repositories/chapterRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([
    { id: 'ch1', title: '第一章', project_id: 'p1', volume_id: null, word_count: 1000, sort_order: 0 },
    { id: 'ch2', title: '第二章', project_id: 'p1', volume_id: null, word_count: 2000, sort_order: 1 },
    { id: 'ch3', title: '第三章', project_id: 'p1', volume_id: null, word_count: 3000, sort_order: 2 },
  ]),
}));

vi.mock('../../server/db/repositories/characterRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([
    { id: 'c1', name: '主角', role_type: 'protagonist', gender: '男', personality: '勇敢' },
  ]),
}));

vi.mock('../../server/db/repositories/projectRepo.js', () => ({
  findById: vi.fn().mockReturnValue(undefined),
}));

vi.mock('../../server/db/repositories/storyArcRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([]),
}));

vi.mock('../../server/db/repositories/plotThreadRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([]),
}));

vi.mock('../../server/db/repositories/foreshadowingRepo.js', () => ({
  findAll: vi.fn().mockReturnValue([]),
}));

vi.mock('../../server/db/repositories/outlineRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([]),
}));

vi.mock('../../server/db/repositories/worldviewRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([]),
}));

import { buildContext, contextToString } from '../../server/ai/contextBuilder.js';

describe('contextBuilder', () => {
  describe('buildContext', () => {
    it('includes selected text as highest priority', async () => {
      const sources = await buildContext({
        projectId: 'p1',
        selectedText: '选中的文本',
        maxTokens: 4000,
      });
      const selected = sources.find((s) => s.label === '选中内容');
      expect(selected).toBeDefined();
      expect(selected!.content).toBe('选中的文本');
    });

    it('includes current chapter content', async () => {
      const sources = await buildContext({
        projectId: 'p1',
        currentChapterId: 'ch2',
        maxTokens: 4000,
      });
      const chapter = sources.find((s) => s.label.includes('第二章'));
      expect(chapter).toBeDefined();
    });

    it('includes previous chapters for continuity', async () => {
      const sources = await buildContext({
        projectId: 'p1',
        currentChapterId: 'ch3',
        maxTokens: 8000,
      });
      const prev = sources.find((s) => s.label.includes('前文'));
      expect(prev).toBeDefined();
    });

    it('includes character profiles', async () => {
      const sources = await buildContext({
        projectId: 'p1',
        maxTokens: 4000,
      });
      const chars = sources.find((s) => s.label === '角色设定');
      expect(chars).toBeDefined();
      expect(chars!.content).toContain('主角');
    });

    it('returns empty when no data', async () => {
      const { findByProject: findChapters } = await import('../../server/db/repositories/chapterRepo.js');
      vi.mocked(findChapters).mockReturnValueOnce([]);
      const { findByProject: findChars } = await import('../../server/db/repositories/characterRepo.js');
      vi.mocked(findChars).mockReturnValueOnce([]);

      const sources = await buildContext({ projectId: 'empty', maxTokens: 4000 });
      expect(sources).toEqual([]);
    });
  });

  describe('contextToString', () => {
    it('formats sources with labels', () => {
      const result = contextToString([
        { priority: 1, label: '角色', content: '张三' },
        { priority: 2, label: '章节', content: '第一章' },
      ]);
      expect(result).toContain('=== 角色 ===');
      expect(result).toContain('张三');
      expect(result).toContain('=== 章节 ===');
    });
  });
});
