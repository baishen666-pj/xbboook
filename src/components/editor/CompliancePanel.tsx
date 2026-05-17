import { useState, useEffect } from 'react';
import { complianceService, type ComplianceRule, type ComplianceReport } from '@/services/complianceService';

interface Props { projectId: string; }

type Tab = 'rules' | 'check';
type Category = 'sensitive' | 'political' | 'violence' | 'adult' | 'platform' | 'custom';
type Severity = 'info' | 'warning' | 'error' | 'block';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'sensitive', label: '敏感词' },
  { value: 'political', label: '政治' },
  { value: 'violence', label: '暴力' },
  { value: 'adult', label: '成人' },
  { value: 'platform', label: '平台' },
  { value: 'custom', label: '自定义' },
];

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: 'info', label: '提示', color: 'text-blue-400' },
  { value: 'warning', label: '警告', color: 'text-yellow-400' },
  { value: 'error', label: '错误', color: 'text-orange-400' },
  { value: 'block', label: '阻断', color: 'text-red-400' },
];

const PLATFORMS = [
  { value: 'all', label: '全部平台' },
  { value: 'qidian', label: '起点' },
  { value: 'fanqie', label: '番茄' },
  { value: 'jinjiang', label: '晋江' },
  { value: 'zongheng', label: '纵横' },
];

const SEVERITY_BG: Record<Severity, string> = {
  info: 'bg-blue-500/10 border-blue-500/20',
  warning: 'bg-yellow-500/10 border-yellow-500/20',
  error: 'bg-orange-500/10 border-orange-500/20',
  block: 'bg-red-500/10 border-red-500/20',
};

const CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
) as Record<Category, string>;

const SEVERITY_COLOR: Record<Severity, string> = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-orange-400',
  block: 'text-red-400',
};

function emptyRule(): { name: string; pattern: string; category: Category; severity: Severity; platform: string } {
  return { name: '', pattern: '', category: 'custom', severity: 'warning', platform: 'all' };
}

export function CompliancePanel({ projectId }: Props) {
  const [tab, setTab] = useState<Tab>('rules');

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1">
        {(['rules', 'check'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${
              tab === t
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            {t === 'rules' ? '规则管理' : '合规检测'}
          </button>
        ))}
      </div>

      {tab === 'rules' ? <RulesTab projectId={projectId} /> : <CheckTab projectId={projectId} />}
    </div>
  );
}

function RulesTab({ projectId }: { projectId: string }) {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyRule());

  useEffect(() => {
    loadRules();
  }, [projectId]);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await complianceService.getRules(projectId);
      if (res.success && res.data) {
        setRules(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.pattern.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const res = await complianceService.updateRule(projectId, editingId, form);
        if (!res.success) { setError(res.error || '更新失败'); return; }
      } else {
        const res = await complianceService.createRule(projectId, { ...form, enabled: true });
        if (!res.success) { setError(res.error || '创建失败'); return; }
      }
      setForm(emptyRule());
      setShowForm(false);
      setEditingId(null);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await complianceService.deleteRule(projectId, ruleId);
      if (res.success) {
        await loadRules();
      } else {
        setError(res.error || '删除失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (rule: ComplianceRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      pattern: rule.pattern,
      category: rule.category as Category,
      severity: rule.severity as Severity,
      platform: rule.platform,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-3">
      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyRule()); }}
          className="w-full rounded border border-dashed border-[var(--color-border)] py-1.5 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"
        >
          + 添加规则
        </button>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2">
          <div className="text-xs font-medium text-[var(--color-text-primary)]">
            {editingId ? '编辑规则' : '新建规则'}
          </div>

          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="规则名称"
            className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
          />
          <input
            value={form.pattern}
            onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
            placeholder="匹配模式（正则表达式）"
            className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
          />

          {/* Category */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  form.category === c.value
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Severity */}
          <div className="flex gap-1">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                onClick={() => setForm((f) => ({ ...f, severity: s.value }))}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  form.severity === s.value
                    ? `${SEVERITY_BG[s.value]} ${s.color}`
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Platform */}
          <div className="flex gap-1 flex-wrap">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setForm((f) => ({ ...f, platform: p.value }))}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  form.platform === p.value
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <button
              onClick={handleSubmit}
              disabled={loading || !form.name.trim() || !form.pattern.trim()}
              className="flex-1 rounded bg-[var(--color-primary)] py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
            >
              {loading ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyRule()); }}
              className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 && !showForm && (
        <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
          暂无规则，点击上方添加
        </div>
      )}

      <div className="space-y-1.5">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded border border-[var(--color-border)] p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-medium ${SEVERITY_COLOR[rule.severity as Severity] ?? ''}`}>
                {SEVERITIES.find((s) => s.value === rule.severity)?.label ?? rule.severity}
              </span>
              <span className="rounded bg-[var(--color-primary)]/10 px-1 py-0.5 text-[10px] text-[var(--color-primary)]">
                {CATEGORY_LABELS[rule.category as Category] ?? rule.category}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {PLATFORMS.find((p) => p.value === rule.platform)?.label ?? rule.platform}
              </span>
            </div>
            <div className="text-xs text-[var(--color-text-primary)]">{rule.name}</div>
            <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-mono">{rule.pattern}</div>
            <div className="flex gap-1 mt-1.5">
              <button
                onClick={() => startEdit(rule)}
                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                编辑
              </button>
              <button
                onClick={() => handleDelete(rule.id)}
                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-red-400"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckTab({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ComplianceReport | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await complianceService.check(projectId, {
        platform: platform === 'all' ? undefined : platform,
      });
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || '检测失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Platform selector */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">目标平台</div>
        <div className="flex gap-1 flex-wrap">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlatform(p.value)}
              className={`rounded px-2 py-1 text-[10px] transition-colors ${
                platform === p.value
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleCheck}
        disabled={loading}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '检测中...' : '开始合规检测'}
      </button>

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      {report && (
        <div className="space-y-2">
          {/* Score header */}
          <div className="flex items-center justify-between rounded bg-[var(--color-surface-1)] p-2">
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {PLATFORMS.find((p) => p.value === (report.platform || 'all'))?.label ?? report.platform}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${
                report.totalIssues === 0 ? 'text-green-400' : report.totalIssues <= 3 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {report.totalIssues}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">问题总数</div>
            </div>
          </div>

          {/* Severity breakdown */}
          <div className="grid grid-cols-4 gap-1">
            {SEVERITIES.map((s) => {
              const count = report.severityBreakdown[s.value] ?? 0;
              return (
                <div key={s.value} className={`rounded border p-1.5 text-center ${SEVERITY_BG[s.value]}`}>
                  <div className={`text-xs font-medium ${s.color}`}>{count}</div>
                  <div className="text-[9px] text-[var(--color-text-muted)]">{s.label}</div>
                </div>
              );
            })}
          </div>

          {/* Issues list */}
          {report.issues.length === 0 ? (
            <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
              未发现问题
            </div>
          ) : (
            <div className="space-y-1.5">
              {report.issues.map((issue, i) => (
                <div
                  key={`${issue.ruleId}-${i}`}
                  className={`rounded border p-2 ${SEVERITY_BG[issue.severity as Severity] ?? ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-medium ${SEVERITY_COLOR[issue.severity as Severity] ?? ''}`}>
                      {SEVERITIES.find((s) => s.value === issue.severity)?.label ?? issue.severity}
                    </span>
                    <span className="rounded bg-[var(--color-primary)]/10 px-1 py-0.5 text-[10px] text-[var(--color-primary)]">
                      {CATEGORY_LABELS[issue.category as Category] ?? issue.category}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-text-primary)]">{issue.ruleName}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-mono">
                    匹配: {issue.matched}
                  </div>
                  {issue.suggestion && (
                    <div className="mt-0.5 text-[10px] text-green-400">建议: {issue.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
