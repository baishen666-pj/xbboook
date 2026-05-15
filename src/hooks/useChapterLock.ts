import { useCallback } from "react";
import { useCollabStore } from "@/stores/collabStore";
import { useProjectStore } from "@/stores/projectStore";
import { collabService } from "@/services/collabService";

export function useChapterLock() {
  const currentUser = useCollabStore((s) => s.currentUser);
  const currentProject = useProjectStore((s) => s.currentProject);
  const locks = useCollabStore((s) => s.locks);

  const acquireLock = useCallback(async (chapterId: string): Promise<boolean> => {
    if (!currentUser || !currentProject) return false;

    const existing = locks.find((l) => l.chapterId === chapterId);
    if (existing && existing.userId === currentUser.id) return true;
    if (existing) return false;

    const res = await collabService.acquireLock(currentProject.id, chapterId, currentUser.id);
    return res.success;
  }, [currentUser, currentProject, locks]);

  const releaseLock = useCallback(async (chapterId: string): Promise<void> => {
    if (!currentUser || !currentProject) return;
    await collabService.releaseLock(currentProject.id, chapterId, currentUser.id);
  }, [currentUser, currentProject]);

  const isLockedByOther = useCallback((chapterId: string): boolean => {
    if (!currentUser) return false;
    const lock = locks.find((l) => l.chapterId === chapterId);
    return lock !== undefined && lock.userId !== currentUser.id;
  }, [currentUser, locks]);

  return { acquireLock, releaseLock, isLockedByOther };
}
