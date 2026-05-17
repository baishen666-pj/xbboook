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
  {
    version: 7,
    name: 'chat_messages',
    up: [
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT,
        role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        skill_id TEXT DEFAULT '',
        token_usage INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON chat_messages(project_id, created_at ASC)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_chapter ON chat_messages(chapter_id, created_at ASC)',
    ],
  },
  {
    version: 8,
    name: 'pipeline_jobs',
    up: [
      `CREATE TABLE IF NOT EXISTS pipeline_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_ids TEXT NOT NULL,
        current_step INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','paused','completed','failed')),
        error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
    ],
  },
  {
    version: 9,
    name: 'user_preferences',
    up: [
      `CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    ],
  },
  {
    version: 10,
    name: 'chapter_tags',
    up: [
      `ALTER TABLE chapters ADD COLUMN tags TEXT DEFAULT '[]'`,
    ],
  },
  {
    version: 11,
    name: 'project_templates',
    up: [
      `CREATE TABLE IF NOT EXISTS project_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        genre TEXT,
        description TEXT,
        is_builtin INTEGER DEFAULT 0,
        structure TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 12,
    name: 'consistency_issues',
    up: [
      `CREATE TABLE IF NOT EXISTS consistency_issues (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT,
        type TEXT NOT NULL CHECK(type IN ('character_conflict','timeline_error','setting_conflict','plot_logic','detail_omission','foreshadowing_conflict','name_mismatch')),
        severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical','high','medium','low')),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        suggestion TEXT DEFAULT '',
        status TEXT DEFAULT 'open' CHECK(status IN ('open','acknowledged','fixed','dismissed')),
        source TEXT DEFAULT 'ai' CHECK(source IN ('ai','name_scanner','manual')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_consistency_issues_project ON consistency_issues(project_id, status)',
    ],
  },
];

// Check if a migration's effects already exist in the database
function isMigrationApplied(db: ReturnType<typeof getDb>, migration: Migration): boolean {
  // Migration 1 is the base schema — check for projects table
  if (migration.version === 1) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get();
  }
  // Version 2: daily_target column on projects
  if (migration.version === 2) {
    const cols = (db.prepare('PRAGMA table_info(projects)').all() as { name: string }[]).map(c => c.name);
    return cols.includes('daily_target');
  }
  // Version 3: publish_status + scheduled_at on chapters
  if (migration.version === 3) {
    const cols = (db.prepare('PRAGMA table_info(chapters)').all() as { name: string }[]).map(c => c.name);
    return cols.includes('publish_status');
  }
  // Version 4: speech_style on characters
  if (migration.version === 4) {
    const cols = (db.prepare('PRAGMA table_info(characters)').all() as { name: string }[]).map(c => c.name);
    return cols.includes('speech_style');
  }
  // Version 5: story_arcs table
  if (migration.version === 5) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='story_arcs'").get();
  }
  // Version 6: ai_summary on chapters
  if (migration.version === 6) {
    const cols = (db.prepare('PRAGMA table_info(chapters)').all() as { name: string }[]).map(c => c.name);
    return cols.includes('ai_summary');
  }
  // Version 7: chat_messages table
  if (migration.version === 7) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'").get();
  }
  // Version 8: pipeline_jobs table
  if (migration.version === 8) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pipeline_jobs'").get();
  }
  // Version 9: user_preferences table
  if (migration.version === 9) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'").get();
  }
  // Version 10: tags column on chapters
  if (migration.version === 10) {
    const cols = (db.prepare('PRAGMA table_info(chapters)').all() as { name: string }[]).map(c => c.name);
    return cols.includes('tags');
  }
  // Version 11: project_templates table
  if (migration.version === 11) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_templates'").get();
  }
  // Version 12: consistency_issues table
  if (migration.version === 12) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consistency_issues'").get();
  }
  return false;
}

export function runMigrations(): void {
  const db = getDb();

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);

  const applied = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
  const appliedVersions = new Set(applied.map(r => r.version));

  // Reconcile: detect migrations whose effects already exist but aren't tracked
  const insertStmt = db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (?, ?)');
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version) && isMigrationApplied(db, migration)) {
      insertStmt.run(migration.version, migration.name);
      appliedVersions.add(migration.version);
    }
  }

  // Run unapplied migrations
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