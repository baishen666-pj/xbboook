import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState = {
  isReplaying: false,
  setReplaying: vi.fn(((val: boolean) => { mockState.isReplaying = val; })),
  setPendingCount: vi.fn(),
};

vi.mock("../../src/stores/offlineStore", () => ({
  useOfflineStore: {
    getState: vi.fn(() => mockState),
  },
}));

vi.mock("../../src/stores/toastStore", () => ({
  toast: vi.fn(),
}));

vi.mock("../../src/services/chapterService", () => ({
  chapterService: {
    saveContent: vi.fn(() => Promise.resolve({ success: true })),
    update: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock("../../src/services/characterService", () => ({
  characterService: {
    update: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock("../../src/services/worldviewService", () => ({
  worldviewService: {
    update: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock("../../src/services/offlineDb", () => ({
  offlineDb: {
    queueEdit: vi.fn(() => Promise.resolve()),
    getPendingEdits: vi.fn(() => Promise.resolve([])),
    removeEdit: vi.fn(() => Promise.resolve()),
    clearEditQueue: vi.fn(() => Promise.resolve()),
    getPendingCount: vi.fn(() => Promise.resolve(0)),
  },
}));

import { offlineQueue } from "../../src/services/offlineQueue";
import { offlineDb } from "../../src/services/offlineDb";
import { chapterService } from "../../src/services/chapterService";
import { useOfflineStore } from "../../src/stores/offlineStore";

describe("offlineQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.isReplaying = false;
  });

  it("enqueue writes to offlineDb and updates pending count", async () => {
    (offlineDb.getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    await offlineQueue.enqueue({
      type: "saveContent",
      projectId: "p-1",
      targetId: "ch-1",
      payload: { content: "test" },
      version: 1,
    });
    expect(offlineDb.queueEdit).toHaveBeenCalled();
    expect(useOfflineStore.getState().setPendingCount).toHaveBeenCalledWith(1);
  });

  it("replayAll returns early if already replaying", async () => {
    mockState.isReplaying = true;
    const result = await offlineQueue.replayAll();
    expect(result).toEqual({ succeeded: 0, failed: 0 });
  });

  it("replayAll replays pending edits and removes succeeded ones", async () => {
    const edits = [
      { id: 1, type: "saveContent" as const, projectId: "p-1", targetId: "ch-1", payload: { content: "hello" }, createdAt: 1, version: 1 },
    ];
    (offlineDb.getPendingEdits as ReturnType<typeof vi.fn>).mockResolvedValue(edits);
    (offlineDb.getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (chapterService.saveContent as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const result = await offlineQueue.replayAll();
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(offlineDb.removeEdit).toHaveBeenCalledWith(1);
  });

  it("replayAll counts failures when replay fails", async () => {
    const edits = [
      { id: 2, type: "saveContent" as const, projectId: "p-1", targetId: "ch-1", payload: { content: "fail" }, createdAt: 1, version: 1 },
    ];
    (offlineDb.getPendingEdits as ReturnType<typeof vi.fn>).mockResolvedValue(edits);
    (chapterService.saveContent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));

    const result = await offlineQueue.replayAll();
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("clear clears edit queue and resets count", async () => {
    await offlineQueue.clear();
    expect(offlineDb.clearEditQueue).toHaveBeenCalled();
    expect(useOfflineStore.getState().setPendingCount).toHaveBeenCalledWith(0);
  });

  it("getPendingCount delegates to offlineDb", async () => {
    (offlineDb.getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    const count = await offlineQueue.getPendingCount();
    expect(count).toBe(5);
  });
});
