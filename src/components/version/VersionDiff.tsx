import { useEffect, useState, useMemo } from "react";
import { useVersionStore } from "@/stores/versionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { versionService } from "@/services/versionService";

interface DiffLine {
  type: "same" | "add" | "remove" | "modified";
  oldText: string;
  newText: string;
}

// Simple LCS-based diff
function computeLCS(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;

  const maxA = Math.min(m, 500);
  const maxB = Math.min(n, 500);

  // Build LCS table
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

  // Backtrack to get diff
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

  return result;
}

export function VersionDiff() {
  const versions = useVersionStore((s) => s.versions);
  const previewVersion = useVersionStore((s) => s.previewVersion);
  const compareVersionId = useVersionStore((s) => s.compareVersionId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);

  const [oldContent, setOldContent] = useState("");
  const [newContent, setNewContent] = useState("");

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

  const stats = useMemo(() => {
    let added = 0, removed = 0, same = 0;
    for (const d of diff) {
      if (d.type === "add") added++;
      else if (d.type === "remove") removed++;
      else same++;
    }
    return { added, removed, same };
  }, [diff]);

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
      </div>

      {/* Side-by-side diff */}
      <div className="flex flex-1 overflow-hidden">
        {/* Old (left) */}
        <div className="flex-1 overflow-y-auto border-r border-white/5">
          <div className="font-mono text-xs leading-relaxed">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`px-3 py-px whitespace-pre-wrap ${
                  line.type === "remove" ? "bg-red-500/10 text-red-300/70" :
                  line.type === "add" ? "bg-white/[0.01] text-white/10" :
                  "text-white/30"
                }`}
              >
                <span className="mr-2 inline-block w-4 text-right text-white/10">
                  {line.type === "remove" ? "-" : line.type === "add" ? " " : " "}
                </span>
                {line.oldText}
              </div>
            ))}
          </div>
        </div>

        {/* New (right) */}
        <div className="flex-1 overflow-y-auto">
          <div className="font-mono text-xs leading-relaxed">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`px-3 py-px whitespace-pre-wrap ${
                  line.type === "add" ? "bg-green-500/10 text-green-300/70" :
                  line.type === "remove" ? "bg-white/[0.01] text-white/10" :
                  "text-white/30"
                }`}
              >
                <span className="mr-2 inline-block w-4 text-right text-white/10">
                  {line.type === "add" ? "+" : line.type === "remove" ? " " : " "}
                </span>
                {line.newText}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
