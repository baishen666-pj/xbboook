import { create } from "zustand";
import type { ScheduleItem, PublishStatus } from "@/types/project";
import { chapterService } from "@/services/chapterService";

interface ScheduleState {
  scheduleItems: ScheduleItem[];
  loading: boolean;
  projectId: string | null;
}

interface ScheduleActions {
  fetchSchedule: (projectId: string) => Promise<void>;
  updatePublishStatus: (
    chapterId: string,
    status: PublishStatus,
    scheduledAt?: string | null
  ) => Promise<void>;
  clear: () => void;
}

export const useScheduleStore = create<ScheduleState & ScheduleActions>(
  (set, get) => ({
    scheduleItems: [],
    loading: false,
    projectId: null,

    fetchSchedule: async (projectId) => {
      set({ loading: true, projectId });
      const res = await chapterService.fetchSchedule(projectId);
      set({
        scheduleItems: res.success && res.data ? res.data : [],
        loading: false,
      });
    },

    updatePublishStatus: async (chapterId, status, scheduledAt) => {
      const { projectId } = get();
      if (!projectId) return;

      const res = await chapterService.updatePublishStatus(projectId, chapterId, {
        publish_status: status,
        scheduled_at: scheduledAt,
      });
      if (res.success && res.data) {
        set((state) => ({
          scheduleItems: state.scheduleItems.map((item) =>
            item.id === chapterId
              ? {
                  ...item,
                  publishStatus: res.data!.publishStatus,
                  scheduledAt: res.data!.scheduledAt,
                }
              : item
          ),
        }));
      }
    },

    clear: () => set({ scheduleItems: [], loading: false, projectId: null }),
  })
);