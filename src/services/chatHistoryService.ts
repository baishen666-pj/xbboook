import { apiClient } from "./apiClient";

export interface ChatHistoryMessage {
  id: string;
  projectId: string;
  chapterId: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  skillId: string;
  tokenUsage: number | null;
  createdAt: string;
}

export const chatHistoryService = {
  async getHistory(projectId: string, chapterId?: string): Promise<ChatHistoryMessage[]> {
    const query = chapterId ? `?chapterId=${chapterId}` : "";
    const res = await apiClient.get<ChatHistoryMessage[]>(`/ai/chat-history/${projectId}${query}`);
    return res.success && res.data ? res.data : [];
  },

  async saveMessages(
    projectId: string,
    messages: Array<{
      chapterId?: string;
      role: string;
      content: string;
      skillId?: string;
      tokenUsage?: number;
    }>,
  ): Promise<void> {
    await apiClient.post<void>(`/ai/chat-history/${projectId}`, { messages });
  },

  async clearHistory(projectId: string, chapterId?: string): Promise<void> {
    const query = chapterId ? `?chapterId=${chapterId}` : "";
    await apiClient.delete<void>(`/ai/chat-history/${projectId}${query}`);
  },
};
