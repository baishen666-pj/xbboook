import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/db/repositories/characterRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([
    { id: 'c1', name: '张三', role_type: 'protagonist', nickname: null },
    { id: 'c2', name: '李四', role_type: 'supporting', nickname: '四哥' },
  ]),
}));

vi.mock('../../server/db/repositories/chapterRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([
    { id: 'ch1', title: '第一章', word_count: 100 },
  ]),
  create: vi.fn().mockReturnValue({ id: 'ch-new', title: '新章节' }),
}));

vi.mock('../../server/services/fileService.js', () => ({
  readChapter: vi.fn().mockResolvedValue('张三遇见了李四，两人成为了师徒。'),
}));

vi.mock('../../server/ai/agentFactory.js', () => ({
  completeChat: vi.fn().mockResolvedValue(JSON.stringify({
    relations: [
      { characterA: '张三', characterB: '李四', relationType: '师徒', description: '师徒关系', confidence: 0.95, keyEvents: ['拜师'] },
    ],
    factions: [{ name: '正道', members: ['张三', '李四'] }],
  })),
}));

vi.mock('../../server/middleware/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('relationshipExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract relationships from chapter content', async () => {
    const { extractRelationships } = await import('../../server/services/relationshipExtractor.js');
    const result = await extractRelationships('proj-1');

    expect(result.relations.length).toBe(1);
    expect(result.relations[0].characterA).toBe('张三');
    expect(result.relations[0].characterB).toBe('李四');
    expect(result.relations[0].relationType).toBe('师徒');
    expect(result.factions.length).toBe(1);
    expect(result.factions[0].name).toBe('正道');
  });

  it('should return empty for no characters', async () => {
    const charRepo = await import('../../server/db/repositories/characterRepo.js');
    vi.mocked(charRepo.findByProject).mockReturnValueOnce([]);

    const { extractRelationships } = await import('../../server/services/relationshipExtractor.js');
    const result = await extractRelationships('proj-empty');

    expect(result.relations).toEqual([]);
    expect(result.factions).toEqual([]);
  });

  it('should handle malformed AI response', async () => {
    const agentFactory = await import('../../server/ai/agentFactory.js');
    vi.mocked(agentFactory.completeChat).mockResolvedValueOnce('This is not JSON at all!');

    const { extractRelationships } = await import('../../server/services/relationshipExtractor.js');
    const result = await extractRelationships('proj-1');

    expect(result.relations).toEqual([]);
    expect(result.chaptersProcessed).toBeGreaterThanOrEqual(0);
  });
});
