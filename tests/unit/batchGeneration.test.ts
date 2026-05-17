import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      plan_json TEXT NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','paused','completed','failed','cancelled')),
      progress_json TEXT DEFAULT '{}',
      current_chapter_index INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  return db;
}

describe('batchJobRepo', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => db,
    }));

    const id = 'test-project-00000000-0000-0000-0000-000000000002';
    db.prepare(`
      INSERT INTO projects (id, name, status, sort_order, created_at, updated_at)
      VALUES (?, 'Test', 'active', 0, datetime('now'), datetime('now'))
    `).run(id);
    projectId = id;
  });

  afterEach(() => {
    db.close();
    vi.doUnmock('../../server/db/database.js');
    vi.resetModules();
  });

  it('creates and finds a batch job', async () => {
    const { create, findById } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{"chapters":[]}' });

    expect(job.id).toBeTruthy();
    expect(job.project_id).toBe(projectId);
    expect(job.status).toBe('pending');
    expect(job.plan_json).toBe('{"chapters":[]}');

    const found = findById(job.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(job.id);
  });

  it('updates job status', async () => {
    const { create, updateStatus, findById } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });

    const updated = updateStatus(job.id, 'running');
    expect(updated!.status).toBe('running');

    const found = findById(job.id);
    expect(found!.status).toBe('running');
  });

  it('updates job status with error', async () => {
    const { create, updateStatus, findById } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });

    const updated = updateStatus(job.id, 'failed', 'Something went wrong');
    expect(updated!.status).toBe('failed');
    expect(updated!.error).toBe('Something went wrong');
  });

  it('updates job progress', async () => {
    const { create, updateProgress, findById } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });

    const updated = updateProgress(job.id, '{"completed":1}', 1);
    expect(updated!.progress_json).toBe('{"completed":1}');
    expect(updated!.current_chapter_index).toBe(1);
  });

  it('finds active jobs by project', async () => {
    const { create, findActiveByProject } = await import('../../server/db/repositories/batchJobRepo.js');
    create({ projectId, planJson: '{}', status: 'running' });
    create({ projectId, planJson: '{}', status: 'completed' });

    const active = findActiveByProject(projectId);
    expect(active).toBeDefined();
    expect(active!.status).toBe('running');
  });

  it('deletes a job', async () => {
    const { create, deleteById, findById } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });

    expect(deleteById(job.id)).toBe(true);
    expect(findById(job.id)).toBeUndefined();
  });

  it('returns false when deleting nonexistent job', async () => {
    const { deleteById } = await import('../../server/db/repositories/batchJobRepo.js');
    expect(deleteById('nonexistent')).toBe(false);
  });

  it('finds all jobs by project', async () => {
    const { create, findByProject } = await import('../../server/db/repositories/batchJobRepo.js');
    create({ projectId, planJson: '{}' });
    create({ projectId, planJson: '{}' });

    const jobs = findByProject(projectId);
    expect(jobs).toHaveLength(2);
  });
});

describe('batchGeneration service', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => db,
    }));
    vi.doMock('../../server/ai/agentFactory.js', () => ({
      completeChat: vi.fn().mockResolvedValue('Generated content that is sufficient length for testing purposes and exceeds the minimum threshold of one hundred characters.'),
      isConfigured: vi.fn().mockReturnValue(true),
    }));
    vi.doMock('../../server/ai/contextBuilder.js', () => ({
      buildContext: vi.fn().mockResolvedValue([]),
      contextToString: vi.fn().mockReturnValue(''),
    }));
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn().mockResolvedValue(''),
      writeChapter: vi.fn().mockResolvedValue(undefined),
      deleteChapter: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../server/db/repositories/searchCacheRepo.js', () => ({
      upsert: vi.fn(),
      removeByChapter: vi.fn(),
    }));

    const id = 'test-project-00000000-0000-0000-0000-000000000003';
    db.prepare(`
      INSERT INTO projects (id, name, status, sort_order, created_at, updated_at)
      VALUES (?, 'Test', 'active', 0, datetime('now'), datetime('now'))
    `).run(id);
    projectId = id;
  });

  afterEach(() => {
    db.close();
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ai/agentFactory.js');
    vi.doUnmock('../../server/ai/contextBuilder.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.resetModules();
  });

  it('generateBatchPlan returns chapters for outlines without matching chapters', async () => {
    db.prepare(`
      INSERT INTO outlines (id, project_id, level, title, content, sort_order, created_at, updated_at)
      VALUES (?, ?, 1, 'Chapter A', 'Outline A', 0, datetime('now'), datetime('now'))
    `).run('outline-a', projectId);

    db.prepare(`
      INSERT INTO outlines (id, project_id, level, title, content, sort_order, created_at, updated_at)
      VALUES (?, ?, 1, 'Chapter B', 'Outline B', 1, datetime('now'), datetime('now'))
    `).run('outline-b', projectId);

    const { generateBatchPlan } = await import('../../server/services/batchGeneration.js');
    const plan = await generateBatchPlan(projectId);

    expect(plan.chapters).toHaveLength(2);
    expect(plan.chapters[0]!.title).toBe('Chapter A');
    expect(plan.chapters[1]!.title).toBe('Chapter B');
    expect(plan.projectId).toBe(projectId);
    expect(plan.temperature).toBe(0.8);
  });

  it('generateBatchPlan respects temperature option', async () => {
    const { generateBatchPlan } = await import('../../server/services/batchGeneration.js');
    const plan = await generateBatchPlan(projectId, { temperature: 0.5 });

    expect(plan.temperature).toBe(0.5);
  });

  it('generateBatchPlan filters out outlines that already have chapters', async () => {
    db.prepare(`
      INSERT INTO outlines (id, project_id, level, title, content, sort_order, created_at, updated_at)
      VALUES (?, ?, 1, 'Existing Chapter', 'Outline', 0, datetime('now'), datetime('now'))
    `).run('outline-existing', projectId);

    // Mock chapterRepo to return a chapter with matching title
    vi.doMock('../../server/db/repositories/chapterRepo.js', () => ({
      create: vi.fn().mockReturnValue({ id: 'ch-new', title: 'Test' }),
      updateContent: vi.fn(),
      findByProject: vi.fn().mockReturnValue([{ id: 'ch-existing', title: 'Existing Chapter' }]),
    }));

    const { generateBatchPlan } = await import('../../server/services/batchGeneration.js');
    const plan = await generateBatchPlan(projectId);

    expect(plan.chapters).toHaveLength(0);
  });

  it('runBatchGeneration yields events and completes', async () => {
    db.prepare(`
      INSERT INTO outlines (id, project_id, level, title, content, sort_order, created_at, updated_at)
      VALUES (?, ?, 1, 'Test Chapter', 'Test outline', 0, datetime('now'), datetime('now'))
    `).run('outline-test', projectId);

    const { create } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });

    const { runBatchGeneration } = await import('../../server/services/batchGeneration.js');
    const plan = {
      chapters: [{ outlineNodeId: 'outline-test', title: 'Test Chapter', synopsis: 'Test', sortOrder: 0 }],
      projectId,
      temperature: 0.8,
    };

    const events: Array<{ type: string }> = [];
    for await (const event of runBatchGeneration(job.id, plan)) {
      events.push(event);
    }

    const types = events.map(e => e.type);
    expect(types).toContain('chapter_start');
    expect(types).toContain('chapter_done');
    expect(types).toContain('batch_done');
  });

  it('runBatchGeneration handles empty plan', async () => {
    const { create } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });

    const { runBatchGeneration } = await import('../../server/services/batchGeneration.js');
    const plan = { chapters: [], projectId, temperature: 0.8 };

    const events: Array<{ type: string }> = [];
    for await (const event of runBatchGeneration(job.id, plan)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('batch_done');
  });

  it('pauseBatch updates status to paused', async () => {
    const { create, updateStatus } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });
    updateStatus(job.id, 'running');

    const { pauseBatch } = await import('../../server/services/batchGeneration.js');
    const paused = pauseBatch(job.id);
    expect(paused!.status).toBe('paused');
  });

  it('resumeBatch updates status to running', async () => {
    const { create, updateStatus } = await import('../../server/db/repositories/batchJobRepo.js');
    const job = create({ projectId, planJson: '{}' });
    updateStatus(job.id, 'paused');

    const { resumeBatch } = await import('../../server/services/batchGeneration.js');
    const resumed = resumeBatch(job.id);
    expect(resumed!.status).toBe('running');
  });
});
