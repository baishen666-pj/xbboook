import { useState, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';

const SUPPORTED_FORMATS = [
  { ext: '.txt', label: '纯文本', desc: '自动检测章节标题' },
  { ext: '.md', label: 'Markdown', desc: '按标题拆分章节' },
  { ext: '.docx', label: 'Word 文档', desc: '保留基本格式' },
  { ext: '.epub', label: 'EPUB 电子书', desc: '按章节导入' },
];

interface ImportWizardProps {
  projectId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function ImportWizard({ projectId, onComplete, onCancel }: ImportWizardProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ imported: number; chapters: Array<{ id: string; title: string; words: number }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setStep('importing');
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/projects/${projectId}/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? '导入失败');
        setStep('preview');
        return;
      }

      setPreview(data.data);
      setStep('done');

      // Reload chapters in project store
      const loadProjects = useProjectStore.getState().loadProjects;
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
      setStep('preview');
    }
  };

  const fileExt = file?.name.split('.').pop()?.toLowerCase();
  const formatInfo = SUPPORTED_FORMATS.find((f) => f.ext === `.${fileExt}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">导入文件</h3>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Supported formats */}
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_FORMATS.map((f) => (
                <div key={f.ext} className="rounded border border-[var(--color-border)] p-2">
                  <div className="text-xs font-medium text-[var(--color-text-primary)]">{f.ext} {f.label}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">{f.desc}</div>
                </div>
              ))}
            </div>

            {/* File input */}
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-border)] p-6 cursor-pointer hover:border-[var(--color-primary)] transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              <span className="text-xs text-[var(--color-text-muted)]">
                {file ? file.name : '点击选择文件或拖拽到此处'}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                支持 .txt .md .docx .epub，最大 20MB
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.docx,.epub"
              onChange={handleFileChange}
              className="hidden"
            />

            {error && (
              <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onCancel} className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]">
                取消
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!file}
                className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && file && (
          <div className="space-y-4">
            <div className="rounded border border-[var(--color-border)] p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-secondary)]">文件名</span>
                <span className="text-xs text-[var(--color-text-primary)]">{file.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-secondary)]">格式</span>
                <span className="text-xs text-[var(--color-text-primary)]">{formatInfo?.label ?? fileExt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-secondary)]">大小</span>
                <span className="text-xs text-[var(--color-text-primary)]">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            <div className="rounded bg-[var(--color-surface-1)] p-3 text-[10px] text-[var(--color-text-muted)]">
              {formatInfo?.desc ?? '将自动检测章节标题并拆分导入'}
            </div>

            {error && (
              <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setStep('upload')} className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]">
                返回
              </button>
              <button onClick={handleImport} className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90">
                开始导入
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            <span className="text-xs text-[var(--color-text-muted)]">正在导入...</span>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && preview && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                导入成功！共 {preview.imported} 章
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1">
              {preview.chapters.map((ch, i) => (
                <div key={ch.id} className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">{i + 1}. {ch.title}</span>
                  <span className="text-[var(--color-text-muted)]">{ch.words} 字</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={onComplete} className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90">
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
