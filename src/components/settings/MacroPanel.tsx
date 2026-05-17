import { useState, useEffect } from 'react';
import { keyboardMacroService } from '@/services/keyboardMacroService';
import type { KeyboardMacro } from '@/services/keyboardMacroService';

interface MacroPanelProps {
  projectId: string;
}

const SCOPE_OPTIONS = [
  { value: 'global', label: '全局' },
  { value: 'project', label: '项目' },
  { value: 'chapter', label: '章节' },
];

const ACTION_TYPE_OPTIONS = [
  { value: 'insert', label: '插入' },
  { value: 'replace', label: '替换' },
  { value: 'command', label: '命令' },
  { value: 'format', label: '格式化' },
];

interface ActionForm {
  type: string;
  value: string;
}

const EMPTY_ACTION: ActionForm = { type: 'insert', value: '' };

export function MacroPanel({ projectId }: MacroPanelProps) {
  const [macros, setMacros] = useState<KeyboardMacro[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [scope, setScope] = useState('project');
  const [actions, setActions] = useState<ActionForm[]>([EMPTY_ACTION]);

  const loadMacros = async () => {
    setIsLoading(true);
    try {
      const res = await keyboardMacroService.list(projectId);
      if (res.success && res.data) setMacros(res.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMacros();
  }, [projectId]);

  const resetForm = () => {
    setName('');
    setTrigger('');
    setScope('project');
    setActions([{ type: 'insert', value: '' }]);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !trigger.trim()) return;
    await keyboardMacroService.create(projectId, {
      name: name.trim(),
      trigger: trigger.trim(),
      actions: actions.filter((a) => a.value.trim()),
      scope,
    });
    resetForm();
    loadMacros();
  };

  const handleToggle = async (macro: KeyboardMacro) => {
    await keyboardMacroService.update(projectId, macro.id, { enabled: !macro.enabled });
    loadMacros();
  };

  const handleDelete = async (macroId: string) => {
    await keyboardMacroService.delete(projectId, macroId);
    setConfirmDeleteId(null);
    loadMacros();
  };

  const addAction = () => setActions([...actions, { ...EMPTY_ACTION }]);
  const removeAction = (index: number) => setActions(actions.filter((_, i) => i !== index));
  const updateAction = (index: number, field: keyof ActionForm, value: string) =>
    setActions(actions.map((a, i) => i === index ? { ...a, [field]: value } : a));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] p-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">键盘宏</span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs text-white hover:opacity-90 transition-opacity"
        >
          {showForm ? '取消' : '新建'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border-b border-[var(--color-border)] p-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="宏名称"
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
            />
            <input
              type="text"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="快捷键 (ctrl+shift+k)"
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Actions editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-muted)]">动作列表</span>
              <button onClick={addAction} className="text-[10px] text-[var(--color-primary)] hover:opacity-80">
                + 添加动作
              </button>
            </div>
            {actions.map((action, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <select
                  value={action.type}
                  onChange={(e) => updateAction(idx, 'type', e.target.value)}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-1 py-0.5 text-[10px] text-[var(--color-text-primary)] focus:outline-none"
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <textarea
                  value={action.value}
                  onChange={(e) => updateAction(idx, 'value', e.target.value)}
                  placeholder="动作值"
                  rows={1}
                  className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50 resize-none"
                />
                {actions.length > 1 && (
                  <button onClick={() => removeAction(idx)} className="text-[10px] text-red-400 hover:opacity-80">
                    x
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim() || !trigger.trim()}
            className="w-full rounded bg-[var(--color-primary)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            创建宏
          </button>
        </div>
      )}

      {/* Macro list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading && (
          <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">加载中...</div>
        )}

        {!isLoading && macros.length === 0 && (
          <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">暂无宏</div>
        )}

        {macros.map((macro) => (
          <div key={macro.id} className="rounded border border-[var(--color-border)] p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{macro.name}</span>
              <div className="flex items-center gap-2">
                {/* Enable/Disable toggle */}
                <button
                  onClick={() => handleToggle(macro)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    macro.enabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {macro.enabled ? '启用' : '禁用'}
                </button>
                {/* Delete */}
                {confirmDeleteId === macro.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(macro.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] px-1.5 py-0.5 rounded text-[var(--color-text-muted)]"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(macro.id)}
                    className="text-[10px] text-red-400 hover:opacity-80"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
              <span className="rounded bg-[var(--color-surface-1)] px-1.5 py-0.5 font-mono">{macro.trigger}</span>
              <span>{SCOPE_OPTIONS.find((s) => s.value === macro.scope)?.label ?? macro.scope}</span>
            </div>
            {macro.actions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {macro.actions.map((action, i) => (
                  <span key={i} className="rounded bg-[var(--color-surface-1)] px-1 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                    {ACTION_TYPE_OPTIONS.find((t) => t.value === action.type)?.label ?? action.type}: {action.value.length > 20 ? action.value.slice(0, 20) + '...' : action.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
