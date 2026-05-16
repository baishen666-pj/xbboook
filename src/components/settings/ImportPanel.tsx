import { useState, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";

interface ImportResult {
  imported: number;
  chapters: Array<{ id: string; title: string; words: number }>;
  warnings?: string[];
}

export function ImportPanel({ onClose }: { onClose?: () => void }) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!currentProject || !file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/projects/${currentProject.id}/import`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.success) {
        setResult({ ...json.data, warnings: json.warnings });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(json.error || "导入失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">导入作品</h3>
        {onClose && (
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xs">
            ×
          </button>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center">
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFile(f ?? null);
            setResult(null);
            setError(null);
          }}
          className="hidden"
          id="import-file-input"
        />
        <label
          htmlFor="import-file-input"
          className="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
        >
          {file ? (
            <div>
              <div className="text-sm font-medium">{file.name}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm">点击选择文件</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                支持 .txt, .md, .docx
              </div>
            </div>
          )}
        </label>
      </div>

      <button
        onClick={handleImport}
        disabled={!file || importing}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {importing ? "导入中..." : "开始导入"}
      </button>

      {error && (
        <div className="rounded-lg bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-[var(--color-success)]/10 px-3 py-3">
          {result.warnings && result.warnings.length > 0 && (
            <div className="mb-2 rounded bg-[var(--color-warning)]/10 px-2 py-1.5 text-[11px] text-[var(--color-warning)]">
              <div className="font-medium mb-1">导入警告</div>
              {result.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
          <div className="text-xs font-medium text-[var(--color-success)] mb-2">
            成功导入 {result.imported} 个章节
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.chapters.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
                <span className="truncate">{ch.title}</span>
                <span className="shrink-0 ml-2 text-[var(--color-text-muted)]">{ch.words} 字</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
