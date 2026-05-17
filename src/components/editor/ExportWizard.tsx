import { useState } from 'react';

const FORMATS = [
  { id: 'txt', label: 'TXT', desc: '纯文本', icon: '📄' },
  { id: 'md', label: 'Markdown', desc: '带格式标记', icon: '📝' },
  { id: 'docx', label: 'Word', desc: 'DOCX 文档', icon: '📘' },
  { id: 'epub', label: 'EPUB', desc: '电子书', icon: '📖' },
  { id: 'pdf', label: 'PDF', desc: '打印排版', icon: '📕' },
  { id: 'wechat', label: '微信', desc: '公众号 HTML', icon: '💬' },
];

interface ExportWizardProps {
  projectId: string;
  onClose: () => void;
}

export function ExportWizard({ projectId, onClose }: ExportWizardProps) {
  const [format, setFormat] = useState<string>('');
  const [includeToc, setIncludeToc] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    if (!format) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (!includeToc) params.set('includeToc', 'false');

    const url = `/api/projects/${projectId}/export/${format}${params.toString() ? `?${params}` : ''}`;

    // Use window.location for file download
    window.open(url, '_blank');
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">导出作品</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-sm">×</button>
        </div>

        {/* Format Selection */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-lg border p-3 text-center transition-colors ${
                format === f.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/30'
              }`}
            >
              <div className="text-lg mb-1">{f.icon}</div>
              <div className="text-xs font-medium text-[var(--color-text-primary)]">{f.label}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{f.desc}</div>
            </button>
          ))}
        </div>

        {/* Options */}
        <div className="flex items-center gap-2 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeToc}
              onChange={(e) => setIncludeToc(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            <span className="text-xs text-[var(--color-text-secondary)]">包含目录</span>
          </label>
        </div>

        {error && (
          <div className="rounded bg-red-500/10 p-2 text-xs text-red-400 mb-3">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]">取消</button>
          <button
            onClick={handleExport}
            disabled={!format || loading}
            className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
          >
            {loading ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
