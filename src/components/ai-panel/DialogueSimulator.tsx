import { useState, useRef } from "react";
import { useAiStore } from "@/stores/aiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { streamAi } from "@/services/aiService";
import { versionService } from "@/services/versionService";

interface DialogueLine {
  character: string;
  content: string;
}

export function DialogueSimulator() {
  const characters = useProjectStore((s) => s.characters);
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const editor = useEditorStore((s) => s.editorInstance);
  const character1Id = useAiStore((s) => s.dialogueCharacter1Id);
  const character2Id = useAiStore((s) => s.dialogueCharacter2Id);
  const [scene, setScene] = useState("");
  const [lines, setLines] = useState<DialogueLine[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const char1 = characters.find((c) => c.id === character1Id);
  const char2 = characters.find((c) => c.id === character2Id);

  async function handleGenerate() {
    if (!currentProject || !activeChapterId || !character1Id || !character2Id) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setLines([]);

    const prompt = scene.trim()
      ? `场景：${scene}\n请模拟${char1?.name ?? "角色A"}和${char2?.name ?? "角色B"}的对话`
      : `请模拟${char1?.name ?? "角色A"}和${char2?.name ?? "角色B"}的对话场景`;

    let fullContent = "";
    try {
      for await (const event of streamAi({
        projectId: currentProject.id,
        skillId: "character-dialogue",
        chapterId: activeChapterId,
        character1Id,
        character2Id,
        question: prompt,
      }, controller.signal)) {
        if (controller.signal.aborted) break;
        if (event.type === "chunk") {
          fullContent += event.content;
          // Parse dialogue lines from streaming content
          const parsed = parseDialogue(fullContent, char1?.name ?? "A", char2?.name ?? "B");
          setLines(parsed);
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        // ignore
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsGenerating(false);
  }

  async function handleInsert() {
    if (!editor || !currentProject || !activeChapterId) return;
    // Create pre-AI snapshot
    try {
      const res = await versionService.create(currentProject.id, activeChapterId, { label: "AI编辑前快照" });
      if (res.success && res.data) {
        useEditorStore.getState().setAiEditSnapshot(res.data.id);
      }
    } catch { /* best-effort */ }
    const html = lines
      .map((line) => `<p><span class="ghost-text">${line.character}：${line.content}</span></p>`)
      .join("");
    editor.chain().focus().insertContent(html).run();
  }

  if (characters.length < 2) {
    return (
      <div className="p-4 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">
        至少需要 2 个角色才能使用对话模拟器
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
        对话模拟器
      </h3>

      {/* Scene input */}
      <textarea
        value={scene}
        onChange={(e) => setScene(e.target.value)}
        placeholder="描述对话场景（如：两人在酒馆相遇）"
        rows={2}
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-[var(--text-xs)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-primary)]/50"
      />

      {/* Generate / Stop button */}
      <div className="flex gap-2">
        <button
          onClick={() => void (isGenerating ? handleStop() : handleGenerate())}
          disabled={!character1Id || !character2Id || !activeChapterId}
          className={`flex-1 rounded px-3 py-1.5 text-[var(--text-xs)] font-medium transition-colors disabled:opacity-50 ${
            isGenerating
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {isGenerating ? "停止" : "生成对话"}
        </button>
      </div>

      {/* Dialogue bubbles */}
      {lines.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {lines.map((line, i) => {
            const isChar1 = line.character === (char1?.name ?? "A");
            return (
              <div
                key={i}
                className={`flex ${isChar1 ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-2.5 py-1.5 ${
                    isChar1
                      ? "bg-blue-500/10 text-blue-300 rounded-bl-sm"
                      : "bg-emerald-500/10 text-emerald-300 rounded-br-sm"
                  }`}
                >
                  <span className="text-[10px] font-medium opacity-60">
                    {line.character}
                  </span>
                  <p className="text-[var(--text-xs)] mt-0.5">{line.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Insert button */}
      {lines.length > 0 && !isGenerating && editor && (
        <button
          onClick={() => void handleInsert()}
          className="w-full rounded px-3 py-1.5 text-[var(--text-xs)] font-medium bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
        >
          插入编辑器
        </button>
      )}
    </div>
  );
}

function parseDialogue(text: string, _name1: string, _name2: string): DialogueLine[] {
  const lines: DialogueLine[] = [];
  // Match patterns like "角色名：content" or "角色名:content"
  const regex = /([^\n：:]+)[：:]\s*([^\n]*)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]!.trim();
    const content = match[2]!.trim();
    if (content.length > 0) {
      lines.push({ character: name, content });
    }
  }
  return lines;
}
