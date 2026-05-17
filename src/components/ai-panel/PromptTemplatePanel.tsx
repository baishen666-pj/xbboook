import { useState, useCallback, useEffect } from 'react';
import * as ptService from '@/services/promptTemplateService';

interface Props {
  onSelectTemplate: (systemPrompt: string, temperature: number, maxTokens: number) => void;
}

const CATEGORIES = [
  { value: '', label: '全部' },
  { value: 'writing', label: '写作' },
  { value: 'editing', label: '编辑' },
  { value: 'analysis', label: '分析' },
  { value: 'planning', label: '规划' },
  { value: 'creative', label: '创意' },
  { value: 'custom', label: '自定义' },
];

export function PromptTemplatePanel({ onSelectTemplate }: Props) {
  const [templates, setTemplates] = useState<ptService.PromptTemplate[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCategory, setNewCategory] = useState('custom');

  const load = useCallback(async () => {
    try {
      let data = await ptService.getTemplates(category || undefined, search || undefined);
      if (data.length === 0) {
        await ptService.initBuiltinTemplates();
        data = await ptService.getTemplates(category || undefined, search || undefined);
      }
      setTemplates(data);
    } catch { /* ignore */ }
  }, [category, search]);

  useEffect(() => { load(); }, [load]);

  const handleUse = useCallback(async (t: ptService.PromptTemplate) => {
    await ptService.useTemplate(t.id);
    onSelectTemplate(t.system_prompt, t.suggested_temperature, t.suggested_max_tokens);
  }, [onSelectTemplate]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    await ptService.createTemplate({ name: newName, systemPrompt: newPrompt, category: newCategory });
    setNewName('');
    setNewPrompt('');
    setShowCreate(false);
    load();
  }, [newName, newPrompt, newCategory, load]);

  const handleDelete = useCallback(async (id: string) => {
    await ptService.deleteTemplate(id);
    load();
  }, [load]);

  return (
    <div className="p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Prompt 模板</h4>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90"
        >
          {showCreate ? '取消' : '创建模板'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="space-y-2 rounded bg-white/5 p-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="模板名称"
            className="w-full rounded bg-black/20 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-white/20"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded bg-black/20 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)]"
          >
            {CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="System prompt..."
            className="w-full rounded bg-black/20 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-white/20"
            rows={4}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newPrompt.trim()}
            className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
          >
            保存
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded px-2 py-0.5 text-xs ${category === c.value ? 'bg-[var(--color-primary)] text-white' : 'bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10'}`}
          >
            {c.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索..."
          className="ml-auto rounded bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-[var(--color-text-primary)] placeholder-white/20 w-24"
        />
      </div>

      {/* Template list */}
      <div className="space-y-1">
        {templates.map(t => (
          <div
            key={t.id}
            className="rounded bg-white/5 p-2 hover:bg-white/10 cursor-pointer group"
            onClick={() => handleUse(t)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-primary)] font-medium">{t.name}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{t.category}</span>
              {t.is_builtin ? (
                <span className="text-[10px] text-blue-400">内置</span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                  className="ml-auto text-[10px] text-red-400 opacity-0 group-hover:opacity-100"
                >
                  删除
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{t.description}</p>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-2">暂无模板</p>
        )}
      </div>
    </div>
  );
}
