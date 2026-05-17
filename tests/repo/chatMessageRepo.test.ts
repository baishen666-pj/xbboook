import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

describe('chatMessageRepo', () => {
  let projectId: string;
  let chapterId: string;

  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    memDb.exec(SCHEMA_SQL);

    projectId = crypto.randomUUID();
    memDb.prepare("INSERT INTO projects (id, name, sort_order) VALUES (?, 'Test', 0)").run(projectId);

    chapterId = crypto.randomUUID();
    memDb.prepare(
      "INSERT INTO chapters (id, project_id, volume_id, title, word_count, file_path, status, sort_order) VALUES (?, ?, NULL, 'Ch1', 0, ?, 'draft', 0)"
    ).run(chapterId, projectId, `${projectId}/ch/${chapterId}.md`);
  });

  afterEach(() => {
    memDb.close();
  });

  it('creates and finds messages', async () => {
    const { create, findByProject, findById } = await import('../../server/db/repositories/chatMessageRepo.js');

    const msg = create({
      projectId,
      chapterId,
      role: 'user',
      content: '你好',
      skillId: 'continue',
    });

    expect(msg.id).toBeTruthy();
    expect(msg.project_id).toBe(projectId);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('你好');

    const found = findById(msg.id);
    expect(found).toBeTruthy();
    expect(found!.content).toBe('你好');
  });

  it('finds messages by project', async () => {
    const { create, findByProject } = await import('../../server/db/repositories/chatMessageRepo.js');

    create({ projectId, role: 'user', content: 'msg1' });
    create({ projectId, role: 'assistant', content: 'msg2' });

    const messages = findByProject(projectId);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.created_at <= messages[1]!.created_at).toBe(true);
  });

  it('filters by chapterId', async () => {
    const { create, findByProject } = await import('../../server/db/repositories/chatMessageRepo.js');

    create({ projectId, chapterId, role: 'user', content: 'with chapter' });
    create({ projectId, role: 'user', content: 'without chapter' });

    const filtered = findByProject(projectId, chapterId);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.content).toBe('with chapter');
  });

  it('deletes by project', async () => {
    const { create, deleteByProject, findByProject } = await import('../../server/db/repositories/chatMessageRepo.js');

    create({ projectId, role: 'user', content: 'msg' });
    const deleted = deleteByProject(projectId);
    expect(deleted).toBe(1);
    expect(findByProject(projectId)).toHaveLength(0);
  });

  it('deletes by chapter', async () => {
    const { create, deleteByChapter, findByProject } = await import('../../server/db/repositories/chatMessageRepo.js');

    create({ projectId, chapterId, role: 'user', content: 'chapter msg' });
    create({ projectId, role: 'user', content: 'no chapter msg' });

    const deleted = deleteByChapter(projectId, chapterId);
    expect(deleted).toBe(1);
    expect(findByProject(projectId)).toHaveLength(1);
  });
});
