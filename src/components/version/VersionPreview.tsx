import { useEffect, useState } from "react";
import { useVersionStore } from "@/stores/versionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { versionService } from "@/services/versionService";

export function VersionPreview() {
  const previewVersion = useVersionStore((s) => s.previewVersion);
  const [content, setContent] = useState<string>("");
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);

  useEffect(() => {
    if (!previewVersion || !currentProject || !activeChapterId) {
      setContent("");
      return;
    }
    versionService.getById(currentProject.id, activeChapterId, previewVersion.id).then((res) => {
      setContent(res.success && res.data ? res.data.content ?? "" : "");
    });
  }, [previewVersion, currentProject, activeChapterId]);

  if (!previewVersion) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-white/20">
        选择一个版本查看内容
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium text-white/60">
          版本 v{previewVersion.versionNumber}
        </span>
        <span className="text-[10px] text-white/20">
          {previewVersion.wordCount} 字
        </span>
        {previewVersion.label && (
          <span className="text-[10px] text-white/30">· {previewVersion.label}</span>
        )}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/50">
        {content}
      </div>
    </div>
  );
}
