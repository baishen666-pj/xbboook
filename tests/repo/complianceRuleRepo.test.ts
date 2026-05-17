import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

vi.mock('../../server/middleware/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as repo from '../../server/db/repositories/complianceRuleRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE compliance_rules (
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
    );
    CREATE TABLE compliance_reports (
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
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('complianceRuleRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('create + findByProject', () => {
    it('creates a rule and retrieves it', () => {
      const pid = seedProject();
      const rule = repo.create({ id: randomUUID(), projectId: pid, name: 'Sensitive Word', category: 'sensitive', pattern: '敏感词', severity: 'warning', replacement: '***', enabled: true, platform: 'all' });
      expect(rule.name).toBe('Sensitive Word');
      expect(rule.category).toBe('sensitive');

      const rules = repo.findByProject(pid);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe(rule.id);
    });

    it('returns empty array for project with no rules', () => {
      const pid = seedProject();
      expect(repo.findByProject(pid)).toEqual([]);
    });
  });

  describe('findEnabled', () => {
    it('returns only enabled rules', () => {
      const pid = seedProject();
      repo.create({ id: randomUUID(), projectId: pid, name: 'Enabled', category: 'sensitive', pattern: 'test', severity: 'warning', replacement: '', enabled: true, platform: 'all' });
      repo.create({ id: randomUUID(), projectId: pid, name: 'Disabled', category: 'sensitive', pattern: 'test2', severity: 'warning', replacement: '', enabled: false, platform: 'all' });
      expect(repo.findEnabled(pid)).toHaveLength(1);
      expect(repo.findEnabled(pid)[0].name).toBe('Enabled');
    });

    it('filters by platform', () => {
      const pid = seedProject();
      repo.create({ id: randomUUID(), projectId: pid, name: 'All', category: 'sensitive', pattern: 'test', severity: 'warning', replacement: '', enabled: true, platform: 'all' });
      repo.create({ id: randomUUID(), projectId: pid, name: 'Qidian', category: 'sensitive', pattern: 'test2', severity: 'warning', replacement: '', enabled: true, platform: 'qidian' });
      expect(repo.findEnabled(pid, 'qidian')).toHaveLength(2);
      expect(repo.findEnabled(pid, 'fanqie')).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('updates a rule', () => {
      const pid = seedProject();
      const rule = repo.create({ id: randomUUID(), projectId: pid, name: 'Old', category: 'sensitive', pattern: 'old', severity: 'warning', replacement: '', enabled: true, platform: 'all' });
      const updated = repo.update(rule.id, { name: 'New', severity: 'error' });
      expect(updated!.name).toBe('New');
      expect(updated!.severity).toBe('error');
    });

    it('returns undefined for non-existent', () => {
      expect(repo.update('non-existent', { name: 'X' })).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('deletes a rule', () => {
      const pid = seedProject();
      const rule = repo.create({ id: randomUUID(), projectId: pid, name: 'Delete', category: 'sensitive', pattern: 'x', severity: 'warning', replacement: '', enabled: true, platform: 'all' });
      expect(repo.remove(rule.id)).toBe(true);
      expect(repo.findByProject(pid)).toHaveLength(0);
    });

    it('returns false for non-existent', () => {
      expect(repo.remove('non-existent')).toBe(false);
    });
  });

  describe('reports', () => {
    it('saves and retrieves reports', () => {
      const pid = seedProject();
      const report = repo.saveReport({
        id: randomUUID(), projectId: pid, platform: 'qidian',
        totalIssues: 3, severityBreakdown: { warning: 2, error: 1 },
        issues: [{ ruleId: 'r1', ruleName: 'Test', category: 'sensitive', severity: 'warning', matched: 'xxx', position: 10, suggestion: 'fix' }],
      });
      expect(report.totalIssues).toBe(3);

      const reports = repo.findReports(pid);
      expect(reports).toHaveLength(1);
      expect(reports[0].issues).toHaveLength(1);
    });

    it('updates report status', () => {
      const pid = seedProject();
      const report = repo.saveReport({ id: randomUUID(), projectId: pid, platform: 'all', totalIssues: 0, severityBreakdown: {}, issues: [] });
      expect(repo.updateReportStatus(report.id, 'fixed')).toBe(true);
      const reports = repo.findReports(pid);
      expect(reports[0].status).toBe('fixed');
    });
  });
});
