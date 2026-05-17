import { describe, it, expect, vi } from 'vitest';
import { extractRelationships } from '../../server/services/relationshipExtractor.js';

vi.mock('../../server/db/repositories/characterRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([
    { id: 'c1', name: '张三', role_type: 'protagonist', nickname: null },
  ]),
}));

vi.mock('../../server/db/repositories/chapterRepo.js', () => ({
  findByProject: vi.fn().mockReturnValue([
    { id: 'ch1', title: '第一章', word_count: 100 },
  ]),
}));

vi.mock('../../server/services/fileService.js', () => ({
  readChapter: vi.fn().mockResolvedValue('张三遇见了李四。'),
}));

vi.mock('../../server/ai/agentFactory.js', () => ({
  completeChat: vi.fn().mockResolvedValue(JSON.stringify({
    relations: [
      { characterA: '张三', characterB: '李四', relationType: '师徒', description: '师徒', confidence: 0.9, keyEvents: [] },
    ],
    factions: [{ name: '正道', members: ['张三'] }],
  })),
}));

vi.mock('../../server/middleware/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('extract-relations endpoint logic', () => {
  it('should extract relationships via AI', async () => {
    const result = await extractRelationships('proj-1');

    expect(result.relations.length).toBe(1);
    expect(result.relations[0].relationType).toBe('师徒');
    expect(result.factions.length).toBe(1);
  });

  it('should accept chapterIds parameter', async () => {
    const result = await extractRelationships('proj-1', ['ch1', 'ch2']);

    expect(result.chaptersProcessed).toBe(2);
  });

  it('should return empty for no characters', async () => {
    const charRepo = await import('../../server/db/repositories/characterRepo.js');
    vi.mocked(charRepo.findByProject).mockReturnValueOnce([]);

    const result = await extractRelationships('proj-empty');
    expect(result.relations).toEqual([]);
  });
});
