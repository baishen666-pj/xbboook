import { offlineDb } from "./offlineDb";
import { useOfflineStore } from "@/stores/offlineStore";
import { toast } from "@/stores/toastStore";
import { chapterService } from "./chapterService";
import { characterService } from "./characterService";
import { worldviewService } from "./worldviewService";
import type { QueuedOperation } from "@/types/offline";

export const offlineQueue = {
  async enqueue(
    operation: Omit<QueuedOperation, "id" | "createdAt">
  ): Promise<void> {
    await offlineDb.queueEdit({
      ...operation,
      createdAt: Date.now(),
    });
    const count = await offlineDb.getPendingCount();
    useOfflineStore.getState().setPendingCount(count);
    toast("info", "已保存到本地");
  },

  async replayAll(): Promise<{ succeeded: number; failed: number }> {
    const { isReplaying, setReplaying, setPendingCount } =
      useOfflineStore.getState();
    if (isReplaying) return { succeeded: 0, failed: 0 };

    setReplaying(true);
    let succeeded = 0;
    let failed = 0;

    try {
      const edits = await offlineDb.getPendingEdits();

      for (const edit of edits) {
        try {
          await replayEdit(edit);
          if (edit.id != null) {
            await offlineDb.removeEdit(edit.id);
          }
          succeeded++;
        } catch {
          failed++;
        }
      }

      const remaining = await offlineDb.getPendingCount();
      setPendingCount(remaining);

      if (succeeded > 0) {
        toast("success", `已同步 ${succeeded} 项更改`);
      }
    } finally {
      setReplaying(false);
    }

    return { succeeded, failed };
  },

  async getPendingCount(): Promise<number> {
    return offlineDb.getPendingCount();
  },

  async clear(): Promise<void> {
    await offlineDb.clearEditQueue();
    useOfflineStore.getState().setPendingCount(0);
  },
};

async function replayEdit(edit: QueuedOperation): Promise<void> {
  const { type, projectId, targetId, payload } = edit;

  switch (type) {
    case "saveContent": {
      const data = payload as { content: string };
      const res = await chapterService.saveContent(
        projectId,
        targetId,
        data.content
      );
      if (!res.success) throw new Error(res.error ?? "save failed");
      break;
    }
    case "updateChapter": {
      const res = await chapterService.update(
        projectId,
        targetId,
        payload as Record<string, unknown>
      );
      if (!res.success) throw new Error(res.error ?? "update failed");
      break;
    }
    case "updateCharacter": {
      const res = await characterService.update(
        projectId,
        targetId,
        payload as Record<string, unknown>
      );
      if (!res.success) throw new Error(res.error ?? "update failed");
      break;
    }
    case "updateWorldview": {
      const res = await worldviewService.update(
        projectId,
        targetId,
        payload as Record<string, unknown>
      );
      if (!res.success) throw new Error(res.error ?? "update failed");
      break;
    }
    case "updateOutline": {
      const res = await worldviewService.update(
        projectId,
        targetId,
        payload as Record<string, unknown>
      );
      if (!res.success) throw new Error(res.error ?? "update failed");
      break;
    }
    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
}
