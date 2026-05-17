export interface QueuedOperation {
  id?: number;
  type: "saveContent" | "updateChapter" | "updateCharacter" | "updateWorldview" | "updateOutline";
  projectId: string;
  targetId: string;
  payload: unknown;
  createdAt: number;
  version: number;
}
