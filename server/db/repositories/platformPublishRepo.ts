import { getDb } from '../database.js';

export interface PlatformPublishConfig {
  id: string;
  projectId: string;
  platform: 'qidian' | 'fanqie' | 'jinjiang' | 'zongheng' | 'other';
  config: Record<string, unknown>;
  lastExportAt: string | null;
  chapterMapping: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const FIELDS = 'id, project_id, platform, config, last_export_at, chapter_mapping, created_at, updated_at';

function map(row: Record<string, unknown>): PlatformPublishConfig {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    platform: row.platform as PlatformPublishConfig['platform'],
    config: JSON.parse(row.config as string || '{}'),
    lastExportAt: row.last_export_at as string | null,
    chapterMapping: JSON.parse(row.chapter_mapping as string || '{}'),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function findByProject(projectId: string): PlatformPublishConfig[] {
  const db = getDb();
  return (db.prepare(`SELECT ${FIELDS} FROM platform_publish_configs WHERE project_id = ? ORDER BY platform`).all(projectId) as Record<string, unknown>[]).map(map);
}

export function findByPlatform(projectId: string, platform: string): PlatformPublishConfig | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT ${FIELDS} FROM platform_publish_configs WHERE project_id = ? AND platform = ?`).get(projectId, platform) as Record<string, unknown> | undefined;
  return row ? map(row) : undefined;
}

export function upsert(data: { id: string; projectId: string; platform: string; config?: Record<string, unknown>; chapterMapping?: Record<string, unknown> }): PlatformPublishConfig {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM platform_publish_configs WHERE project_id = ? AND platform = ?').get(data.projectId, data.platform);
  if (existing) {
    db.prepare('UPDATE platform_publish_configs SET config = ?, chapter_mapping = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(data.config ?? {}), JSON.stringify(data.chapterMapping ?? {}), now, (existing as { id: string }).id,
    );
  } else {
    db.prepare('INSERT INTO platform_publish_configs (id, project_id, platform, config, chapter_mapping, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      data.id, data.projectId, data.platform, JSON.stringify(data.config ?? {}), JSON.stringify(data.chapterMapping ?? {}), now, now,
    );
  }
  return map(db.prepare(`SELECT ${FIELDS} FROM platform_publish_configs WHERE project_id = ? AND platform = ?`).get(data.projectId, data.platform) as Record<string, unknown>);
}

export function updateLastExport(projectId: string, platform: string): void {
  const db = getDb();
  db.prepare('UPDATE platform_publish_configs SET last_export_at = ?, updated_at = ? WHERE project_id = ? AND platform = ?').run(
    new Date().toISOString(), new Date().toISOString(), projectId, platform,
  );
}

export function remove(projectId: string, platform: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM platform_publish_configs WHERE project_id = ? AND platform = ?').run(projectId, platform).changes > 0;
}
