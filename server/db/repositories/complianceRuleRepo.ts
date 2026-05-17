import { getDb } from '../database.js';
import { logger } from '../../middleware/logger.js';

export interface ComplianceRule {
  id: string;
  projectId: string;
  name: string;
  category: 'sensitive' | 'political' | 'violence' | 'adult' | 'platform' | 'custom';
  pattern: string;
  severity: 'info' | 'warning' | 'error' | 'block';
  replacement: string;
  enabled: boolean;
  platform: 'all' | 'qidian' | 'fanqie' | 'jinjiang' | 'zongheng' | 'other';
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceReport {
  id: string;
  projectId: string;
  chapterId: string | null;
  platform: string;
  totalIssues: number;
  severityBreakdown: Record<string, number>;
  issues: ComplianceIssue[];
  status: 'pending' | 'reviewed' | 'fixed' | 'ignored';
  createdAt: string;
}

export interface ComplianceIssue {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: string;
  matched: string;
  position: number;
  suggestion: string;
}

const RULE_FIELDS = 'id, project_id, name, category, pattern, severity, replacement, enabled, platform, created_at, updated_at';

function mapRule(row: Record<string, unknown>): ComplianceRule {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    category: row.category as ComplianceRule['category'],
    pattern: row.pattern as string,
    severity: row.severity as ComplianceRule['severity'],
    replacement: row.replacement as string,
    enabled: !!row.enabled,
    platform: row.platform as ComplianceRule['platform'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function findByProject(projectId: string): ComplianceRule[] {
  const db = getDb();
  return (db.prepare(`SELECT ${RULE_FIELDS} FROM compliance_rules WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Record<string, unknown>[]).map(mapRule);
}

export function findById(id: string): ComplianceRule | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT ${RULE_FIELDS} FROM compliance_rules WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapRule(row) : undefined;
}

export function findEnabled(projectId: string, platform?: string): ComplianceRule[] {
  const db = getDb();
  if (platform && platform !== 'all') {
    return (db.prepare(`SELECT ${RULE_FIELDS} FROM compliance_rules WHERE project_id = ? AND enabled = 1 AND (platform = 'all' OR platform = ?) ORDER BY category, severity DESC`).all(projectId, platform) as Record<string, unknown>[]).map(mapRule);
  }
  return (db.prepare(`SELECT ${RULE_FIELDS} FROM compliance_rules WHERE project_id = ? AND enabled = 1 ORDER BY category, severity DESC`).all(projectId) as Record<string, unknown>[]).map(mapRule);
}

export function create(data: Omit<ComplianceRule, 'createdAt' | 'updatedAt'>): ComplianceRule {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO compliance_rules (id, project_id, name, category, pattern, severity, replacement, enabled, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data.id, data.projectId, data.name, data.category, data.pattern, data.severity, data.replacement, data.enabled ? 1 : 0, data.platform, now, now,
  );
  logger.info({ ruleId: data.id, projectId: data.projectId }, 'compliance rule created');
  return mapRule(db.prepare(`SELECT ${RULE_FIELDS} FROM compliance_rules WHERE id = ?`).get(data.id) as Record<string, unknown>);
}

export function update(id: string, data: Partial<Pick<ComplianceRule, 'name' | 'category' | 'pattern' | 'severity' | 'replacement' | 'enabled' | 'platform'>>): ComplianceRule | undefined {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.category !== undefined) { sets.push('category = ?'); values.push(data.category); }
  if (data.pattern !== undefined) { sets.push('pattern = ?'); values.push(data.pattern); }
  if (data.severity !== undefined) { sets.push('severity = ?'); values.push(data.severity); }
  if (data.replacement !== undefined) { sets.push('replacement = ?'); values.push(data.replacement); }
  if (data.enabled !== undefined) { sets.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
  if (data.platform !== undefined) { sets.push('platform = ?'); values.push(data.platform); }
  if (sets.length === 0) return findById(id);
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE compliance_rules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function remove(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM compliance_rules WHERE id = ?').run(id).changes > 0;
}

export function saveReport(data: { id: string; projectId: string; chapterId?: string; platform: string; totalIssues: number; severityBreakdown: Record<string, number>; issues: ComplianceIssue[]; status?: string }): ComplianceReport {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO compliance_reports (id, project_id, chapter_id, platform, total_issues, severity_breakdown, issues, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data.id, data.projectId, data.chapterId ?? null, data.platform, data.totalIssues, JSON.stringify(data.severityBreakdown), JSON.stringify(data.issues), data.status ?? 'pending', now,
  );
  return {
    id: data.id, projectId: data.projectId, chapterId: data.chapterId ?? null,
    platform: data.platform, totalIssues: data.totalIssues, severityBreakdown: data.severityBreakdown,
    issues: data.issues, status: (data.status ?? 'pending') as ComplianceReport['status'], createdAt: now,
  };
}

export function findReports(projectId: string): ComplianceReport[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM compliance_reports WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string, projectId: r.project_id as string, chapterId: r.chapter_id as string | null,
    platform: r.platform as string, totalIssues: r.total_issues as number,
    severityBreakdown: JSON.parse(r.severity_breakdown as string || '{}'),
    issues: JSON.parse(r.issues as string || '[]'),
    status: r.status as ComplianceReport['status'], createdAt: r.created_at as string,
  }));
}

export function updateReportStatus(id: string, status: string): boolean {
  const db = getDb();
  return db.prepare('UPDATE compliance_reports SET status = ? WHERE id = ?').run(status, id).changes > 0;
}
