import { useEffect, useState, useMemo } from "react";
import { useVersionStore } from "@/stores/versionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { versionService } from "@/services/versionService";

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] ?? "";
    const newLine = newLines[i] ?? "";

    if (i >= oldLines.length) {
      result.push({ type: "add", text: newLine });
    } else if (i >= newLines.length) {
      result.push({ type: "remove", text: oldLine });
    } else if (oldLine === newLine) {
      result.push({ type: "same", text: oldLine });
    } else {
      result.push({ type: "remove", text: oldLine });
      result.push({ type: "add", text: newLine });
    }
  }

  return result;
}

interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
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
    () => computeDiff(oldContent.split("\n"), newContent.split("\n")),
    [oldContent, newContent],
  );

  if (!previewVersion || !compareVersion) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-white/20">
        选择两个版本进行对比
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-2 flex items-center gap-3 border-b border-white/5 px-4 py-2">
        <span className="text-[10px] text-red-400/60">v{compareVersion.versionNumber}（旧）</span>
        <span className="text-[10px] text-white/10">→</span>
        <span className="text-[10px] text-green-400/60">v{previewVersion.versionNumber}（新）</span>
      </div>
      <div className="font-mono text-xs leading-relaxed">
        {diff.map((line, i) => (
          <div
            key={i}
            className={[
              "px-4 py-px",
              line.type === "add"
                ? "bg-green-500/10 text-green-300/70"
                : line.type === "remove"
                  ? "bg-red-500/10 text-red-300/70"
                  : "text-white/30",
            ].join(" ")}
          >
            <span className="mr-2 inline-block w-4 text-right text-white/15">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
