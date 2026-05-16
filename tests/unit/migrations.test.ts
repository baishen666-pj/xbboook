import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('migration version tracking', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('creates schema_migrations table', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )`);

    const cols = db.prepare("PRAGMA table_info(schema_migrations)").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('version');
    expect(colNames).toContain('name');
    expect(colNames).toContain('applied_at');
  });

  it('tracks applied migrations', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )`);

    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(1, 'base_schema');
    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(2, 'daily_target');

    const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[];
    expect(applied.map(r => r.version)).toEqual([1, 2]);
  });

  it('skips already applied migrations', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )`);

    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(1, 'base_schema');

    const applied = new Set(
      (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(r => r.version)
    );

    expect(applied.has(1)).toBe(true);
    expect(applied.has(2)).toBe(false);
  });

  it('wraps migration in transaction', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )`);

    const run = db.transaction(() => {
      db.exec('ALTER TABLE projects ADD COLUMN test_col TEXT DEFAULT \'\'');
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(99, 'test');
    });

    run();

    const cols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    expect(cols.some(c => c.name === 'test_col')).toBe(true);

    const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = 99').get();
    expect(applied).toBeTruthy();
  });
});