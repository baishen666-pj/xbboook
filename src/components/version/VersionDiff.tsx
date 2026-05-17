import { useEffect, useState, useMemo, useCallback } from "react";
import { useVersionStore } from "@/stores/versionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { versionService } from "@/services/versionService";

// Character-level diff parts for inline highlighting
export interface CharDiffPart {
  type: "same" | "add" | "remove";
  text: string;
}

interface DiffLine {
  type: "same" | "add" | "remove" | "modified";
  oldText: string;
  newText: string;
  charDiff?: CharDiffPart[];
}

// Character-level LCS diff for inline highlighting (capped at 2000 chars)
export function computeCharDiff(oldStr: string, newStr: string): CharDiffPart[] {
  const cap = 2000;
  const a = oldStr.slice(0, cap);
  const b = newStr.slice(0, cap);
  const lenA = a.length;
  const lenB = b.length;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0) as number[]);
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const raw: CharDiffPart[] = [];
  let i = lenA, j = lenB;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.unshift({ type: "same", text: a[i - 1]! });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      raw.unshift({ type: "add", text: b[j - 1]! });
      j--;
    } else {
      raw.unshift({ type: "remove", text: a[i - 1]! });
      i--;
    }
  }

  // Merge adjacent same-type parts
  const merged: CharDiffPart[] = [];
  for (const part of raw) {
    if (merged.length > 0 && merged[merged.length - 1]!.type === part.type) {
      merged[merged.length - 1]!.text += part.text;
    } else {
      merged.push({ ...part });
    }
  }

  return merged;
}

// Line-level LCS diff with character-level refinement
function computeLCS(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;

  const maxA = Math.min(m, 500);
  const maxB = Math.min(n, 500);

  const dp: number[][] = Array.from({ length: maxA + 1 }, () => new Array(maxB + 1).fill(0) as number[]);
  for (let i = 1; i <= maxA; i++) {
    for (let j = 1; j <= maxB; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = maxA, j = maxB;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: "same", oldText: a[i - 1]!, newText: b[j - 1]! });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.unshift({ type: "add", oldText: "", newText: b[j - 1]! });
      j--;
    } else {
      result.unshift({ type: "remove", oldText: a[i - 1]!, newText: "" });
      i--;
    }
  }

  // Append remaining lines beyond the limit
  for (let k = maxA; k < m; k++) {
    if (k < n) {
      if (a[k] === b[k]) result.push({ type: "same", oldText: a[k]!, newText: b[k]! });
      else result.push({ type: "modified", oldText: a[k]!, newText: b[k]! });
    } else {
      result.push({ type: "remove", oldText: a[k]!, newText: "" });
    }
  }
  for (let k = maxB; k < n; k++) {
    if (k >= m) result.push({ type: "add", oldText: "", newText: b[k]! });
  }

  // Post-process: merge adjacent remove+add into modified with char diff
  const processed: DiffLine[] = [];
  for (let k = 0; k < result.length; k++) {
    const curr = result[k]!;
    if (curr.type === "remove" && k + 1 < result.length && result[k + 1]!.type === "add") {
      const next = result[k + 1]!;
      processed.push({
        type: "modified",
        oldText: curr.oldText,
        newText: next.newText,
        charDiff: computeCharDiff(curr.oldText, next.newText),
      });
      k++;
    } else {
      processed.push(curr);
    }
  }

  return processed;
}

function CharDiffView({ parts }: { parts: CharDiffPart[] }) {
  return (
    <>
      {parts.map((part, j) => (
        <span
          key={j}
          className={
            part.type === "add"
              ? "bg-green-500/25 text-green-300"
              : part.type === "remove"
                ? "bg-red-500/25 text-red-300 line-through"
                : ""
          }
        >
          {part.text}
        </span>
      ))}
    </>
  );
}

export function VersionDiff() {
  const versions = useVersionStore((s) => s.versions);
  const previewVersion = useVersionStore((s) => s.previewVersion);
  const compareVersionId = useVersionStore((s) => s.compareVersionId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);

  const [oldContent, setOldContent] = useState("");
  const [newContent, setNewContent] = useState("");
  const [currentChange, setCurrentChange] = useState(0);

  const compareVersion = useMemo(
    () => versions.find((v) => v.id === compareVersionId) ?? null,
    [versions, compareVersionId],
  );

  useEffect(() => {
    if (!currentProject || !activeChapterId) return;

    if (previewVersion) {
      versionService.getById(currentProject.id, activeChapterId, previewVersion.id).then((res) => {
        setNewContent(res.success && res.data ? res.data.content ?? "" : "");
      });
    }

    if (compareVersion) {
      versionService.getById(currentProject.id, activeChapterId, compareVersion.id).then((res) => {
        setOldContent(res.success && res.data ? res.data.content ?? "" : "");
      });
    }
  }, [previewVersion, compareVersion, currentProject, activeChapterId]);

  const diff = useMemo(
    () => computeLCS(oldContent.split("\n"), newContent.split("\n")),
    [oldContent, newContent],
  );

  const changeIndices = useMemo(
    () => diff.map((d, i) => (d.type !== "same" ? i : -1)).filter((i) => i >= 0),
    [diff],
  );

  const stats = useMemo(() => {
    let added = 0, removed = 0, same = 0;
    for (const d of diff) {
      if (d.type === "add") added++;
      else if (d.type === "remove") removed++;
      else if (d.type === "modified") { added++; removed++; }
      else same++;
    }
    return { added, removed, same };
  }, [diff]);

  // Reset currentChange when diff changes
  useEffect(() => {
    setCurrentChange(0);
  }, [diff]);

  // Scroll to current change
  useEffect(() => {
    if (changeIndices.length === 0) return;
    const targetLine = changeIndices[currentChange];
    if (targetLine === undefined) return;
    const el = document.getElementById(`diff-line-${targetLine}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentChange, changeIndices]);

  const prevChange = useCallback(
    () => setCurrentChange((c) => Math.max(0, c - 1)),
    [],
  );
  const nextChange = useCallback(
    () => setCurrentChange((c) => Math.min(changeIndices.length - 1, c + 1)),
    [changeIndices.length],
  );

  if (!previewVersion || !compareVersion) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-white/20">
        选择两个版本进行对比
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-white/5 px-4 py-2 text-[10px]">
        <span className="text-red-400/70">v{compareVersion.versionNumber}（旧）</span>
        <span className="text-white/10">→</span>
        <span className="text-green-400/70">v{previewVersion.versionNumber}（新）</span>
        <div className="flex-1" />
        <span className="text-green-400/50">+{stats.added}</span>
        <span className="text-red-400/50">-{stats.removed}</span>
        <span className="text-white/20">{stats.same} unchanged</span>

        {/* Change navigation */}
        {changeIndices.length > 0 && (
          <div className="ml-2 flex items-center gap-1">
            <button
              onClick={prevChange}
              disabled={currentChange <= 0}
              className="rounded px-1 text-white/30 hover:text-white/60 disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-white/20">
              {currentChange + 1}/{changeIndices.length} 处变更
            </span>
            <button
              onClick={nextChange}
              disabled={currentChange >= changeIndices.length - 1}
              className="rounded px-1 text-white/30 hover:text-white/60 disabled:opacity-30"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Side-by-side diff */}
      <div className="flex flex-1 overflow-hidden">
        {/* Old (left) */}
        <div className="flex-1 overflow-y-auto border-r border-white/5">
          <div className="font-mono text-xs leading-relaxed">
            {diff.map((line, i) => {
              const isCurrent = changeIndices[currentChange] === i;
              return (
                <div
                  id={`diff-old-${i}`}
                  key={i}
                  className={`px-3 py-px whitespace-pre-wrap ${
                    line.type === "remove" ? "bg-red-500/10 text-red-300/70" :
                    line.type === "modified" ? "bg-yellow-500/5 text-yellow-200/70" :
                    line.type === "add" ? "bg-white/[0.01] text-white/10" :
                    "text-white/30"
                  } ${isCurrent ? "ring-1 ring-inset ring-yellow-500/30" : ""}`}
                >
                  <span className="mr-2 inline-block w-4 text-right text-white/10">
                    {line.type === "remove" ? "-" : line.type === "modified" ? "~" : " "}
                  </span>
                  {line.type === "modified" && line.charDiff ? (
                    <CharDiffView parts={line.charDiff.filter((p) => p.type !== "add")} />
                  ) : (
                    line.oldText
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* New (right) */}
        <div className="flex-1 overflow-y-auto">
          <div className="font-mono text-xs leading-relaxed">
            {diff.map((line, i) => {
              const isCurrent = changeIndices[currentChange] === i;
              return (
                <div
                  id={`diff-new-${i}`}
                  key={i}
                  className={`px-3 py-px whitespace-pre-wrap ${
                    line.type === "add" ? "bg-green-500/10 text-green-300/70" :
                    line.type === "modified" ? "bg-yellow-500/5 text-yellow-200/70" :
                    line.type === "remove" ? "bg-white/[0.01] text-white/10" :
                    "text-white/30"
                  } ${isCurrent ? "ring-1 ring-inset ring-yellow-500/30" : ""}`}
                >
                  <span className="mr-2 inline-block w-4 text-right text-white/10">
                    {line.type === "add" ? "+" : line.type === "modified" ? "~" : " "}
                  </span>
                  {line.type === "modified" && line.charDiff ? (
                    <CharDiffView parts={line.charDiff.filter((p) => p.type !== "remove")} />
                  ) : (
                    line.newText
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
