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
  {
    version: 13,
    name: 'search_cache',
    up: [
      `CREATE TABLE IF NOT EXISTS chapter_search_cache (
        chapter_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        plain_text TEXT NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_search_cache_project ON chapter_search_cache(project_id)',
    ],
  },
  {
    version: 14,
    name: 'ai_memory_and_knowledge',
    up: [
      `CREATE TABLE IF NOT EXISTS ai_memory_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT,
        category TEXT NOT NULL CHECK(category IN ('plot_event','character_state','setting_detail','timeline','foreshadowing_hint','worldbuilding','other')),
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        importance TEXT DEFAULT 'normal' CHECK(importance IN ('critical','high','normal','low')),
        chapter_index INTEGER,
        is_auto_extracted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_ai_memory_project ON ai_memory_entries(project_id, category)',
      'CREATE INDEX IF NOT EXISTS idx_ai_memory_chapter ON ai_memory_entries(chapter_id)',
      `CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('chapter','character','worldview','outline','foreshadowing','memory')),
        source_id TEXT NOT NULL,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER DEFAULT 0,
        token_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks(project_id, source_type, source_id)',
    ],
  },
  {
    version: 15,
    name: 'export_templates',
    up: [
      `CREATE TABLE IF NOT EXISTS export_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL CHECK(platform IN ('wechat','generic_html','custom')),
        description TEXT DEFAULT '',
        css TEXT NOT NULL DEFAULT '',
        header_html TEXT DEFAULT '',
        footer_html TEXT DEFAULT '',
        is_builtin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      'CREATE INDEX IF NOT EXISTS idx_export_templates_platform ON export_templates(platform)',
    ],
  },
  {
    version: 16,
    name: 'publish_targets',
    up: [
      `CREATE TABLE IF NOT EXISTS publish_targets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT NOT NULL CHECK(platform IN ('wechat','zhihu','jianshu','csdn','custom')),
        config TEXT NOT NULL DEFAULT '{}',
        last_published_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_publish_targets_project ON publish_targets(project_id)',
    ],
  },
  {
    version: 17,
    name: 'material_box',
    up: [
      `CREATE TABLE IF NOT EXISTS material_box (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'other',
        tags TEXT NOT NULL DEFAULT '[]',
        source TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_material_box_project ON material_box(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_material_box_category ON material_box(project_id, category)',
    ],
  },
  {
    version: 18,
    name: 'integrations',
    up: [
      `CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, secret TEXT NOT NULL,
        events TEXT NOT NULL DEFAULT '[]', enabled INTEGER DEFAULT 1, project_id TEXT,
        headers TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      'CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id)',
      `CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL, event TEXT NOT NULL,
        status_code INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0, success INTEGER DEFAULT 0,
        error TEXT, created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC)',
      `CREATE TABLE IF NOT EXISTS notion_sync (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE, notion_token TEXT NOT NULL,
        database_id TEXT NOT NULL, sync_mode TEXT DEFAULT 'all', last_sync_at TEXT,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS feishu_sync (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE, app_id TEXT NOT NULL,
        app_secret TEXT NOT NULL, doc_token TEXT NOT NULL, sync_mode TEXT DEFAULT 'all',
        last_sync_at TEXT, created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS automation_rules (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, enabled INTEGER DEFAULT 1,
        trigger_config TEXT NOT NULL DEFAULT '{}', action_config TEXT NOT NULL DEFAULT '{}',
        last_triggered_at TEXT, run_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_automation_rules_project ON automation_rules(project_id)',
      `CREATE TABLE IF NOT EXISTS automation_executions (
        id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, trigger_event TEXT NOT NULL,
        action_type TEXT NOT NULL, success INTEGER DEFAULT 0, error TEXT,
        duration_ms INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON automation_executions(rule_id, created_at DESC)',
    ],
  },
  {
    version: 19,
    name: 'agent_writing',
    up: [
      `CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT,
        status TEXT DEFAULT 'idle' CHECK(status IN ('idle','planning','drafting','reviewing','revising','paused','completed','failed')),
        config TEXT NOT NULL DEFAULT '{}',
        current_step TEXT DEFAULT '',
        draft_content TEXT DEFAULT '',
        iteration INTEGER DEFAULT 0,
        max_iterations INTEGER DEFAULT 3,
        plan TEXT DEFAULT '',
        review_notes TEXT DEFAULT '',
        final_content TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_agent_sessions_project ON agent_sessions(project_id, status)',
      `CREATE TABLE IF NOT EXISTS agent_decisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        iteration INTEGER NOT NULL,
        decision_type TEXT NOT NULL CHECK(decision_type IN ('plan','draft_segment','self_review','revision','accept','reject')),
        input_summary TEXT DEFAULT '',
        output_summary TEXT DEFAULT '',
        reasoning TEXT DEFAULT '',
        token_usage INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_agent_decisions_session ON agent_decisions(session_id, iteration)',
      `CREATE TABLE IF NOT EXISTS style_fingerprints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL UNIQUE,
        sentence_patterns TEXT NOT NULL DEFAULT '[]',
        vocabulary_profile TEXT NOT NULL DEFAULT '{}',
        rhythm_profile TEXT NOT NULL DEFAULT '{}',
        dialogue_signatures TEXT NOT NULL DEFAULT '[]',
        narrative_habits TEXT NOT NULL DEFAULT '{}',
        sample_chapter_ids TEXT NOT NULL DEFAULT '[]',
        sample_size INTEGER DEFAULT 0,
        summary TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS story_plans (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        plan_type TEXT DEFAULT 'arc' CHECK(plan_type IN ('arc','volume','chapter_group','milestone')),
        parent_id TEXT,
        start_chapter_index INTEGER,
        end_chapter_index INTEGER,
        target_data TEXT DEFAULT '{}',
        status TEXT DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','abandoned')),
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES story_plans(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_story_plans_project ON story_plans(project_id, sort_order)',
    ],
  },
  {
    version: 20,
    name: 'prompt_templates',
    up: [
      `CREATE TABLE IF NOT EXISTS prompt_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT 'custom' CHECK(category IN ('custom','writing','analysis','editing','planning','creative')),
        system_prompt TEXT NOT NULL,
        user_prompt_template TEXT DEFAULT '',
        suggested_temperature REAL DEFAULT 0.7,
        suggested_max_tokens INTEGER DEFAULT 2048,
        is_builtin INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      'CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category)',
    ],
  },
  {
    version: 21,
    name: 'agent_workflows',
    up: [
      `CREATE TABLE IF NOT EXISTS agent_workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        steps TEXT NOT NULL DEFAULT '[]',
        is_builtin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 22,
    name: 'writing_goals',
    up: [
      `CREATE TABLE IF NOT EXISTS writing_goals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('daily','weekly','monthly','total')),
        target_words INTEGER NOT NULL,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_writing_goals_project ON writing_goals(project_id, is_active)',
    ],
  },
  {
    version: 23,
    name: 'batch_jobs',
    up: [
      `CREATE TABLE IF NOT EXISTS batch_jobs (
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
      )`,
      'CREATE INDEX IF NOT EXISTS idx_batch_jobs_project ON batch_jobs(project_id, status)',
    ],
  },
  {
    version: 24,
    name: 'scenes',
    up: [
      `CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT DEFAULT '',
        content_start_offset INTEGER DEFAULT 0,
        content_end_offset INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        mood TEXT DEFAULT '',
        location TEXT DEFAULT '',
        time_of_day TEXT DEFAULT '',
        pov_character_id TEXT,
        sort_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','writing','revising','done')),
        word_count INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (pov_character_id) REFERENCES characters(id) ON DELETE SET NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_scenes_chapter ON scenes(chapter_id, sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_scenes_pov ON scenes(pov_character_id)',
    ],
  },
  {
    version: 25,
    name: 'chapter_dependencies',
    up: [
      `CREATE TABLE IF NOT EXISTS chapter_dependencies (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_chapter_id TEXT NOT NULL,
        target_chapter_id TEXT NOT NULL,
        dependency_type TEXT DEFAULT 'plot' CHECK(dependency_type IN ('plot','character','foreshadowing','timeline','worldview')),
        description TEXT DEFAULT '',
        strength TEXT DEFAULT 'normal' CHECK(strength IN ('weak','normal','strong')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (source_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
        FOREIGN KEY (target_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_ch_deps_project ON chapter_dependencies(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_ch_deps_source ON chapter_dependencies(source_chapter_id)',
      'CREATE INDEX IF NOT EXISTS idx_ch_deps_target ON chapter_dependencies(target_chapter_id)',
    ],
  },
  {
    version: 26,
    name: 'plot_turning_points',
    up: [
      `CREATE TABLE IF NOT EXISTS plot_turning_points (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        turn_type TEXT DEFAULT 'reversal' CHECK(turn_type IN ('reversal','revelation','sacrifice','betrayal','growth','crisis','climax','other')),
        severity TEXT DEFAULT 'major' CHECK(severity IN ('minor','moderate','major','critical')),
        foreshadow_planted INTEGER DEFAULT 0,
        foreshadow_resolved INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_turning_pts_project ON plot_turning_points(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_turning_pts_chapter ON plot_turning_points(chapter_id)',
    ],
  },
  {
    version: 27,
    name: 'character_timelines',
    up: [
      `CREATE TABLE IF NOT EXISTS character_timelines (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        chapter_id TEXT,
        event_title TEXT NOT NULL,
        event_description TEXT,
        story_time TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_char_timeline_project ON character_timelines(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_char_timeline_character ON character_timelines(character_id)',
    ],
  },
  {
    version: 28,
    name: 'writing_templates',
    up: [
      `CREATE TABLE IF NOT EXISTS writing_templates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        description TEXT,
        content TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_writing_templates_project ON writing_templates(project_id)',
    ],
  },
  {
    version: 29,
    name: 'compliance',
    up: [
      `CREATE TABLE IF NOT EXISTS compliance_rules (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'sensitive' CHECK(category IN ('sensitive','political','violence','adult','platform','custom')),
        pattern TEXT NOT NULL,
        severity TEXT DEFAULT 'warning' CHECK(severity IN ('info','warning','error','block')),
        replacement TEXT DEFAULT '',
        enabled INTEGER DEFAULT 1,
        platform TEXT DEFAULT 'all' CHECK(platform IN ('all','qidian','fanqie','jinjiang','zongheng','other')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_compliance_rules_project ON compliance_rules(project_id)',
      `CREATE TABLE IF NOT EXISTS compliance_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT,
        platform TEXT DEFAULT 'all',
        total_issues INTEGER DEFAULT 0,
        severity_breakdown TEXT DEFAULT '{}',
        issues TEXT NOT NULL DEFAULT '[]',
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','reviewed','fixed','ignored')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_compliance_reports_project ON compliance_reports(project_id)',
    ],
  },
  {
    version: 30,
    name: 'platform_publish_configs',
    up: [
      `CREATE TABLE IF NOT EXISTS platform_publish_configs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK(platform IN ('qidian','fanqie','jinjiang','zongheng','other')),
        config TEXT NOT NULL DEFAULT '{}',
        last_export_at TEXT,
        chapter_mapping TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, platform)
      )`,
      'CREATE INDEX IF NOT EXISTS idx_platform_publish_project ON platform_publish_configs(project_id)',
    ],
  },
  {
    version: 31,
    name: 'writing_sprints',
    up: [
      `CREATE TABLE IF NOT EXISTS writing_sprints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT DEFAULT 'default',
        type TEXT NOT NULL DEFAULT 'pomodoro' CHECK(type IN ('pomodoro','sprint','marathon','custom')),
        duration_minutes INTEGER NOT NULL DEFAULT 25,
        target_words INTEGER DEFAULT 0,
        actual_words INTEGER DEFAULT 0,
        status TEXT DEFAULT 'planned' CHECK(status IN ('planned','active','paused','completed','abandoned')),
        started_at TEXT,
        ended_at TEXT,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_writing_sprints_project ON writing_sprints(project_id, status)',
      `CREATE TABLE IF NOT EXISTS sprint_stats (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT DEFAULT 'default',
        date TEXT NOT NULL,
        total_sprints INTEGER DEFAULT 0,
        total_minutes INTEGER DEFAULT 0,
        total_words INTEGER DEFAULT 0,
        best_wpm REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id, date)
      )`,
      'CREATE INDEX IF NOT EXISTS idx_sprint_stats_date ON sprint_stats(project_id, date)',
    ],
  },
  {
    version: 32,
    name: 'keyboard_macros',
    up: [
      `CREATE TABLE IF NOT EXISTS keyboard_macros (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        trigger TEXT NOT NULL,
        actions TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        scope TEXT DEFAULT 'global' CHECK(scope IN ('global','project','chapter')),
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_keyboard_macros_project ON keyboard_macros(project_id)',
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
  // Version 13: chapter_search_cache table
  if (migration.version === 13) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_search_cache'").get();
  }
  // Version 14: ai_memory_entries + knowledge_chunks tables
  if (migration.version === 14) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_memory_entries'").get();
  }
  // Version 15: export_templates table
  if (migration.version === 15) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='export_templates'").get();
  }
  // Version 16: publish_targets table
  if (migration.version === 16) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='publish_targets'").get();
  }
  // Version 17: material_box table
  if (migration.version === 17) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='material_box'").get();
  }
  // Version 18: integrations tables
  if (migration.version === 18) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='webhooks'").get();
  }
  // Version 19: agent_writing tables
  if (migration.version === 19) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'").get();
  }
  // Version 20: prompt_templates
  if (migration.version === 20) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prompt_templates'").get();
  }
  // Version 21: agent_workflows
  if (migration.version === 21) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_workflows'").get();
  }
  // Version 22: writing_goals
  if (migration.version === 22) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='writing_goals'").get();
  }
  // Version 23: batch_jobs
  if (migration.version === 23) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='batch_jobs'").get();
  }
  // Version 24: scenes
  if (migration.version === 24) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scenes'").get();
  }
  // Version 25: chapter_dependencies
  if (migration.version === 25) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_dependencies'").get();
  }
  // Version 26: plot_turning_points
  if (migration.version === 26) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plot_turning_points'").get();
  }
  // Version 27: character_timelines
  if (migration.version === 27) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='character_timelines'").get();
  }
  // Version 28: writing_templates
  if (migration.version === 28) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='writing_templates'").get();
  }
  // Version 29: compliance
  if (migration.version === 29) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='compliance_rules'").get();
  }
  // Version 30: platform_publish_configs
  if (migration.version === 30) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='platform_publish_configs'").get();
  }
  // Version 31: writing_sprints
  if (migration.version === 31) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='writing_sprints'").get();
  }
  // Version 32: keyboard_macros
  if (migration.version === 32) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='keyboard_macros'").get();
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