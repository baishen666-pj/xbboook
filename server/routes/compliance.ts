import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repositories/complianceRuleRepo.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';
import { validate } from '../middleware/validate.js';

export const complianceRouter = Router({ mergeParams: true });

const ruleSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['sensitive', 'political', 'violence', 'adult', 'platform', 'custom']),
  pattern: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error', 'block']).default('warning'),
  replacement: z.string().default(''),
  platform: z.enum(['all', 'qidian', 'fanqie', 'jinjiang', 'zongheng', 'other']).default('all'),
});

const checkSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  platform: z.enum(['all', 'qidian', 'fanqie', 'jinjiang', 'zongheng', 'other']).default('all'),
});

complianceRouter.get('/rules', (req, res) => {
  const rules = repo.findByProject(req.params.projectId);
  res.json({ success: true, data: rules });
});

complianceRouter.post('/rules', validate(ruleSchema), (req, res) => {
  const rule = repo.create({ id: crypto.randomUUID(), projectId: req.params.projectId, enabled: true, ...req.body });
  res.status(201).json({ success: true, data: rule });
});

complianceRouter.patch('/rules/:ruleId', (req, res) => {
  const rule = repo.update(req.params.ruleId, req.body);
  if (!rule) return res.status(404).json({ success: false, error: '规则不存在' });
  res.json({ success: true, data: rule });
});

complianceRouter.delete('/rules/:ruleId', (req, res) => {
  if (!repo.remove(req.params.ruleId)) return res.status(404).json({ success: false, error: '规则不存在' });
  res.json({ success: true });
});

complianceRouter.post('/check', validate(checkSchema), (req, res) => {
  const { projectId } = req.params;
  const { chapterIds, platform } = req.body;

  const rules = repo.findEnabled(projectId, platform);
  if (rules.length === 0) {
    return res.json({ success: true, data: { totalIssues: 0, severityBreakdown: {}, issues: [] } });
  }

  const chapters = chapterIds?.length
    ? chapterIds.flatMap((id: string) => { const c = chapterRepo.findById(id); return c ? [c] : []; })
    : chapterRepo.findByProject(projectId);

  const allIssues: repo.ComplianceIssue[] = [];
  const breakdown: Record<string, number> = { info: 0, warning: 0, error: 0, block: 0 };

  for (const chapter of chapters) {
    const content = chapter.content || '';
    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        let match;
        while ((match = regex.exec(content)) !== null) {
          allIssues.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            matched: match[0],
            position: match.index,
            suggestion: rule.replacement || `建议修改（${rule.category}规则：${rule.name}）`,
          });
          breakdown[rule.severity] = (breakdown[rule.severity] || 0) + 1;
        }
      } catch { /* invalid regex skip */ }
    }
  }

  const report = repo.saveReport({
    id: crypto.randomUUID(), projectId, platform,
    totalIssues: allIssues.length, severityBreakdown: breakdown, issues: allIssues,
  });

  res.json({ success: true, data: report });
});

complianceRouter.get('/reports', (req, res) => {
  const reports = repo.findReports(req.params.projectId);
  res.json({ success: true, data: reports });
});

complianceRouter.patch('/reports/:reportId', (req, res) => {
  const { status } = req.body;
  if (!['reviewed', 'fixed', 'ignored'].includes(status)) {
    return res.status(400).json({ success: false, error: '无效状态' });
  }
  repo.updateReportStatus(req.params.reportId, status);
  res.json({ success: true });
});
