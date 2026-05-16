import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('Story Arc CRUD', () => {
  let db: Database.Database;
  const projectId = 'test-project';

  beforeEach(() => {
    db = createTestDb();
    db.prepare('INSERT INTO projects (id, name, genre) VALUES (?, ?, ?)').run(projectId, '测试', '玄幻');
  });

  afterEach(() => {
    db.close();
  });

  it('creates a story arc', () => {
    db.prepare(`
      INSERT INTO story_arcs (id, project_id, name, description, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('arc-1', projectId, '主线', '主角成长', 'planned', 0);

    const arc = db.prepare('SELECT * FROM story_arcs WHERE id = ?').get('arc-1') as any;
    expect(arc).toBeTruthy();
    expect(arc.name).toBe('主线');
    expect(arc.status).toBe('planned');
    expect(arc.project_id).toBe(projectId);
  });

  it('lists arcs by project', () => {
    db.prepare(`INSERT INTO story_arcs (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)`).run('arc-1', projectId, '主线', 0);
    db.prepare(`INSERT INTO story_arcs (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)`).run('arc-2', projectId, '支线', 1);

    const arcs = db.prepare('SELECT * FROM story_arcs WHERE project_id = ? ORDER BY sort_order').all(projectId) as any[];
    expect(arcs).toHaveLength(2);
    expect(arcs[0].name).toBe('主线');
  });

  it('updates arc status', () => {
    db.prepare(`INSERT INTO story_arcs (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)`).run('arc-1', projectId, '主线', 0);
    db.prepare(`UPDATE story_arcs SET status = 'active' WHERE id = ?`).run('arc-1');

    const arc = db.prepare('SELECT * FROM story_arcs WHERE id = ?').get('arc-1') as any;
    expect(arc.status).toBe('active');
  });

  it('deletes arc and cascades to threads', () => {
    db.prepare(`INSERT INTO story_arcs (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)`).run('arc-1', projectId, '主线', 0);
    db.prepare(`INSERT INTO plot_threads (id, project_id, arc_id, name, sort_order) VALUES (?, ?, ?, ?, ?)`).run('t-1', projectId, 'arc-1', '线索1', 0);

    db.prepare('DELETE FROM story_arcs WHERE id = ?').run('arc-1');

    const arc = db.prepare('SELECT * FROM story_arcs WHERE id = ?').get('arc-1');
    expect(arc).toBeFalsy();

    const thread = db.prepare('SELECT * FROM plot_threads WHERE id = ?').get('t-1') as any;
    expect(thread.arc_id).toBeNull();
  });
});

describe('Plot Thread CRUD', () => {
  let db: Database.Database;
  const projectId = 'test-project';

  beforeEach(() => {
    db = createTestDb();
    db.prepare('INSERT INTO projects (id, name, genre) VALUES (?, ?, ?)').run(projectId, '测试', '玄幻');
  });

  afterEach(() => {
    db.close();
  });

  it('creates a plot thread', () => {
    db.prepare(`
      INSERT INTO plot_threads (id, project_id, name, description, status, priority, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('t-1', projectId, '身世之谜', '主角的真实身份', 'open', 'high', 0);

    const thread = db.prepare('SELECT * FROM plot_threads WHERE id = ?').get('t-1') as any;
    expect(thread).toBeTruthy();
    expect(thread.name).toBe('身世之谜');
    expect(thread.priority).toBe('high');
  });

  it('lists threads by project', () => {
    db.prepare(`INSERT INTO plot_threads (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)`).run('t-1', projectId, '线索1', 0);
    db.prepare(`INSERT INTO plot_threads (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)`).run('t-2', projectId, '线索2', 1);

    const threads = db.prepare('SELECT * FROM plot_threads WHERE project_id = ? ORDER BY sort_order').all(projectId) as any[];
    expect(threads).toHaveLength(2);
  });

  it('updates thread status', () => {
    db.prepare(`INSERT INTO plot_threads (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)`).run('t-1', projectId, '线索1', 0);
    db.prepare(`UPDATE plot_threads SET status = 'resolved' WHERE id = ?`).run('t-1');

    const thread = db.prepare('SELECT * FROM plot_threads WHERE id = ?').get('t-1') as any;
    expect(thread.status).toBe('resolved');
  });

  it('validates status enum', () => {
    expect(() => {
      db.prepare(`INSERT INTO plot_threads (id, project_id, name, status, sort_order) VALUES (?, ?, ?, ?, ?)`).run('t-1', projectId, '线索1', 'invalid', 0);
    }).toThrow();
  });

  it('validates priority enum', () => {
    expect(() => {
      db.prepare(`INSERT INTO plot_threads (id, project_id, name, priority, sort_order) VALUES (?, ?, ?, ?, ?)`).run('t-1', projectId, '线索1', 'invalid', 0);
    }).toThrow();
  });
});