import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { chatHistoryService } from "../../src/services/chatHistoryService";
import { apiClient } from "../../src/services/apiClient";

describe("chatHistoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getHistory fetches messages for a project", async () => {
    const messages = [{ id: "1", projectId: "p-1", content: "hello" }];
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: messages,
    });

    const result = await chatHistoryService.getHistory("p-1");
    expect(result).toEqual(messages);
    expect(apiClient.get).toHaveBeenCalledWith("/ai/chat-history/p-1");
  });

  it("getHistory passes chapterId as query param", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });

    await chatHistoryService.getHistory("p-1", "ch-1");
    expect(apiClient.get).toHaveBeenCalledWith("/ai/chat-history/p-1?chapterId=ch-1");
  });

  it("getHistory returns empty array on failure", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "not found",
    });

    const result = await chatHistoryService.getHistory("p-1");
    expect(result).toEqual([]);
  });

  it("saveMessages posts messages to the API", async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: null,
    });

    await chatHistoryService.saveMessages("p-1", [
      { role: "user", content: "test", skillId: "continue" },
    ]);

    expect(apiClient.post).toHaveBeenCalledWith("/ai/chat-history/p-1", {
      messages: [{ role: "user", content: "test", skillId: "continue" }],
    });
  });

  it("clearHistory deletes project history", async () => {
    (apiClient.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: null,
    });

    await chatHistoryService.clearHistory("p-1");
    expect(apiClient.delete).toHaveBeenCalledWith("/ai/chat-history/p-1");
  });

  it("clearHistory passes chapterId when provided", async () => {
    (apiClient.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: null,
    });

    await chatHistoryService.clearHistory("p-1", "ch-1");
    expect(apiClient.delete).toHaveBeenCalledWith("/ai/chat-history/p-1?chapterId=ch-1");
  });
});
