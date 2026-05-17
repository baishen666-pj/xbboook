import { useState, useEffect } from 'react';
import {
  writingTemplateService,
  type WritingTemplate,
} from '@/services/writingTemplateService';

const TEMPLATE_CATEGORIES = ['全部', '开头', '场景', '对话', '过渡', '结尾', '其他'] as const;

interface WritingTemplatePanelProps {
  projectId: string;
  chapters: Array<{ id: string; title: string }>;
}

export function WritingTemplatePanel({ projectId, chapters }: WritingTemplatePanelProps) {
  const [templates, setTemplates] = useState<WritingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('全部');

  // Create/edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('开头');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Apply state
  const [applyTemplateId, setApplyTemplateId] = useState<string | null>(null);
  const [applyChapterId, setApplyChapterId] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [projectId]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await writingTemplateService.list(projectId);
      if (res.success && res.data) {
        setTemplates(res.data);
      } else {
        setError(res.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName('');
    setFormCategory('开头');
    setFormDescription('');
    setFormContent('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (t: WritingTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormCategory(t.category);
    setFormDescription(t.description);
    setFormContent(t.content);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formContent.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        const res = await writingTemplateService.update(projectId, editingId, {
          name: formName.trim(),
          category: formCategory,
          description: formDescription.trim(),
          content: formContent.trim(),
        });
        if (!res.success) {
          setError(res.error || '更新失败');
          return;
        }
      } else {
        const res = await writingTemplateService.create(projectId, {
          name: formName.trim(),
          category: formCategory,
          content: formContent.trim(),
          description: formDescription.trim() || undefined,
        });
        if (!res.success) {
          setError(res.error || '创建失败');
          return;
        }
      }
      resetForm();
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await writingTemplateService.delete(projectId, id);
      if (res.success) {
        await loadTemplates();
      } else {
        setError(res.error || '删除失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    }
  };

  const handleApply = async () => {
    if (!applyTemplateId || !applyChapterId) return;
    setApplying(true);
    setError(null);

    try {
      const res = await writingTemplateService.apply(projectId, applyTemplateId, applyChapterId);
      if (res.success) {
        setApplyTemplateId(null);
        setApplyChapterId('');
      } else {
        setError(res.error || '应用失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setApplying(false);
    }
  };

  const filteredTemplates = filterCategory === '全部'
    ? templates
    : templates.filter((t) => t.category === filterCategory);

  return (
    <div className="space-y-3">
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`rounded px-2 py-0.5 text-[9px] transition-colors ${
              filterCategory === cat
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'text-[var(--color-text-muted)] border border-transparent hover:border-[var(--color-border)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-[10px] text-red-400">{error}</div>}

      {/* Template list */}
      {loading ? (
        <div className="text-[10px] text-[var(--color-text-muted)] text-center py-4">加载中...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-[10px] text-[var(--color-text-muted)] text-center py-4">暂无模板</div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {filteredTemplates.map((t) => (
            <div key={t.id} className="rounded border border-[var(--color-border)] p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--color-primary)] truncate">{t.name}</span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)}
                    className="rounded px-1 py-0.5 text-[9px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                    编辑
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    className="rounded px-1 py-0.5 text-[9px] text-red-400 hover:text-red-300">
                    删除
                  </button>
                </div>
              </div>
              {t.description && (
                <div className="text-[9px] text-[var(--color-text-muted)] truncate">{t.description}</div>
              )}
              <div className="flex items-center justify-between">
                <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[9px] text-[var(--color-primary)]">{t.category}</span>
                <button onClick={() => { setApplyTemplateId(t.id); setApplyChapterId(''); }}
                  className="rounded px-1.5 py-0.5 text-[9px] text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20">
                  应用到章节
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply to chapter */}
      {applyTemplateId && (
        <div className="rounded border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-2 space-y-1.5">
          <div className="text-[10px] text-[var(--color-primary)]">应用到章节</div>
          <select value={applyChapterId} onChange={(e) => setApplyChapterId(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)]">
            <option value="">选择章节</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button onClick={handleApply} disabled={applying || !applyChapterId}
              className="flex-1 rounded bg-[var(--color-primary)] py-1 text-[10px] text-white hover:opacity-90 disabled:opacity-40">
              {applying ? '应用中...' : '确认应用'}
            </button>
            <button onClick={() => setApplyTemplateId(null)}
              className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-muted)]">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit form */}
      {showForm ? (
        <div className="space-y-2 rounded border border-[var(--color-border)] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-muted)]">{editingId ? '编辑模板' : '创建模板'}</span>
            <button onClick={resetForm}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
              关闭
            </button>
          </div>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="模板名称"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50"
          />
          <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)]">
            {TEMPLATE_CATEGORIES.filter((c) => c !== '全部').map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="描述 (可选)"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50"
          />
          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="模板内容..."
            rows={4}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 resize-none"
          />
          <button onClick={handleSubmit} disabled={submitting || !formName.trim() || !formContent.trim()}
            className="w-full rounded bg-[var(--color-primary)] py-1 text-[10px] text-white hover:opacity-90 disabled:opacity-40">
            {submitting ? '保存中...' : editingId ? '更新模板' : '创建模板'}
          </button>
        </div>
      ) : (
        <button onClick={openCreate}
          className="w-full rounded border border-dashed border-[var(--color-border)] py-1.5 text-[10px] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
          + 创建模板
        </button>
      )}
    </div>
  );
}
