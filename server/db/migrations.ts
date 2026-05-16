import { getDb } from './database.js';
import { SCHEMA_SQL } from './schemaDefinitions.js';
import { logger } from '../middleware/logger.js';

interface Migration {
  version: number;
  name: string;
  up: string[];
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'base_schema',
    up: [SCHEMA_SQL],
  },
  {
    version: 2,
    name: 'daily_target',
    up: ['ALTER TABLE projects ADD COLUMN daily_target INTEGER DEFAULT 0'],
  },
  {
    version: 3,
    name: 'publish_status',
    up: [
      "ALTER TABLE chapters ADD COLUMN publish_status TEXT DEFAULT 'draft' CHECK(publish_status IN ('draft','scheduled','published','archived'))",
      'ALTER TABLE chapters ADD COLUMN scheduled_at TEXT',
    ],
  },
  {
    version: 4,
    name: 'character_voice_fields',
    up: [
      'ALTER TABLE characters ADD COLUMN speech_style TEXT DEFAULT \'\'',
      'ALTER TABLE characters ADD COLUMN verbal_tics TEXT DEFAULT \'\'',
      "ALTER TABLE characters ADD COLUMN vocabulary_level TEXT DEFAULT 'common'",
      "ALTER TABLE characters ADD COLUMN sentence_length_pref TEXT DEFAULT 'medium'",
      "ALTER TABLE characters ADD COLUMN emotional_expressiveness TEXT DEFAULT 'moderate'",
      'ALTER TABLE characters ADD COLUMN voice_examples TEXT DEFAULT \'[]\'',
    ],
  },
  {
    version: 5,
    name: 'story_arcs_and_threads',
    up: [
      `CREATE TABLE IF NOT EXISTS story_arcs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        start_chapter INTEGER,
        end_chapter INTEGER,
        status TEXT DEFAULT 'planned' CHECK(status IN ('planned','active','completed','abandoned')),
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS plot_threads (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        arc_id TEXT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','dormant','abandoned')),
        priority TEXT DEFAULT 'normal' CHECK(priority IN ('critical','high','normal','low')),
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (arc_id) REFERENCES story_arcs(id) ON DELETE SET NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_story_arcs_project ON story_arcs(project_id, sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_plot_threads_project ON plot_threads(project_id, arc_id)',
    ],
  },
  {
    version: 6,
    name: 'chapter_auto_summary',
    up: [
      'ALTER TABLE chapters ADD COLUMN ai_summary TEXT DEFAULT \'\'',
    ],
  },
];

export function runMigrations(): void {
  const db = getDb();

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);

  const applied = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
  const appliedVersions = new Set(applied.map(r => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    const run = db.transaction(() => {
      for (const sql of migration.up) {
        db.exec(sql);
      }
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
    });

    run();
    logger.info({ version: migration.version, name: migration.name }, 'migration applied');
  }
}

export { MIGRATIONS };