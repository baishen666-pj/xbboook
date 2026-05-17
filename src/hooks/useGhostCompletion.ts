import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import { fetchCompletion } from '@/services/aiService';
import { versionService } from '@/services/versionService';

const DEBOUNCE_MS = 1500;
const CURSOR_CONTEXT_CHARS = 300;

export function useGhostCompletion() {
  const editor = useEditorStore((s) => s.editorInstance);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchingRef = useRef(false);

  const triggerCompletion = useCallback(() => {
    if (!editor || !activeChapterId || !currentProject) return;

    const { from } = editor.state.selection;
    const docSize = editor.state.doc.content.size;
    if (from < 5 || docSize - from < 5) return;

    const before = editor.state.doc.textBetween(
      Math.max(0, from - CURSOR_CONTEXT_CHARS),
      from,
      '\n',
    );

    if (before.trim().length < 20) return;

    // Clear any existing ghost text first
    editor.commands.removeAllGhost();

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    debounceRef.current = setTimeout(async () => {
      if (fetchingRef.current || controller.signal.aborted) return;
      fetchingRef.current = true;

      try {
        const completion = await fetchCompletion({
          projectId: currentProject.id,
          chapterId: activeChapterId,
          cursorContext: before,
        });

        if (controller.signal.aborted) return;
        if (!completion.trim()) return;

        // Insert ghost text at current cursor position
        editor.commands.insertGhostText(completion);
      } catch {
        // Silently ignore completion errors
      } finally {
        fetchingRef.current = false;
      }
    }, DEBOUNCE_MS);
  }, [editor, activeChapterId, currentProject]);

  // Tab to accept, Esc to reject
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if ghost text exists near cursor
      const { from } = editor.state.selection;
      const $pos = editor.state.doc.resolve(from);
      const hasGhost = $pos.marks().some((m) => m.type.name === 'ghostText');

      // Also check the next position for ghost mark
      let ghostNearby = hasGhost;
      if (!ghostNearby && from + 1 <= editor.state.doc.content.size) {
        try {
          const $next = editor.state.doc.resolve(from + 1);
          ghostNearby = $next.marks().some((m) => m.type.name === 'ghostText');
        } catch {
          // position may be out of bounds
        }
      }

      if (!ghostNearby) return;

      if (event.key === 'Tab') {
        event.preventDefault();
        // Create pre-AI snapshot before accepting ghost text
        const pid = useProjectStore.getState().currentProject?.id;
        const cid = useEditorStore.getState().activeChapterId;
        if (pid && cid) {
          versionService.create(pid, cid, { label: 'AI编辑前快照' })
            .then((res) => {
              if (res.success && res.data) {
                useEditorStore.getState().setAiEditSnapshot(res.data.id);
              }
            })
            .catch(() => {});
        }
        editor.commands.acceptAllGhost();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        editor.commands.removeAllGhost();
      }
    };

    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener('keydown', handleKeyDown);
    return () => dom.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  // Auto-trigger on cursor idle after typing
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      triggerCompletion();
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [editor, triggerCompletion]);
}
