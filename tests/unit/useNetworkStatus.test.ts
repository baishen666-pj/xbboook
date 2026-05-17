/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockOfflineState = {
  isOnline: true,
  pendingCount: 0,
  isReplaying: false,
  setOnline: vi.fn(),
  setPendingCount: vi.fn(),
  setReplaying: vi.fn(),
};

vi.mock("../../src/stores/offlineStore", () => ({
  useOfflineStore: Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector(mockOfflineState)),
    { getState: vi.fn(() => mockOfflineState) }
  ),
}));

vi.mock("../../src/services/offlineQueue", () => ({
  offlineQueue: {
    getPendingCount: vi.fn(() => Promise.resolve(0)),
    replayAll: vi.fn(() => Promise.resolve({ succeeded: 0, failed: 0 })),
  },
}));

describe("useNetworkStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOfflineState.isOnline = true;
    mockOfflineState.pendingCount = 0;
  });

  it("returns initial online state", async () => {
    const { useNetworkStatus } = await import("../../src/hooks/useNetworkStatus");
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it("fires online handler on window online event", async () => {
    const { useNetworkStatus } = await import("../../src/hooks/useNetworkStatus");
    renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(mockOfflineState.setOnline).toHaveBeenCalledWith(true);
  });

  it("fires offline handler on window offline event", async () => {
    const { useNetworkStatus } = await import("../../src/hooks/useNetworkStatus");
    renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(mockOfflineState.setOnline).toHaveBeenCalledWith(false);
  });

  it("cleans up event listeners on unmount", async () => {
    const { useNetworkStatus } = await import("../../src/hooks/useNetworkStatus");
    const { unmount } = renderHook(() => useNetworkStatus());

    const removeSpy = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    removeSpy.mockRestore();
  });
});
