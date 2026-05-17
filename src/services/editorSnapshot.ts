import { offlineDb } from "./offlineDb";

export interface EditorSnapshot {
  content: string;
  timestamp: number;
  wordCount: number;
}

const SNAPSHOT_PREFIX = "snapshot:";

function snapshotKey(chapterId: string): string {
  return `${SNAPSHOT_PREFIX}${chapterId}`;
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
  return text.length;
}

export const editorSnapshot = {
  async save(chapterId: string, content: string): Promise<void> {
    const snapshot: EditorSnapshot = {
      content,
      timestamp: Date.now(),
      wordCount: countWords(content),
    };
    await offlineDb.setMeta(snapshotKey(chapterId), snapshot);
  },

  async load(chapterId: string): Promise<EditorSnapshot | null> {
    const val = await offlineDb.getMeta(snapshotKey(chapterId));
    return (val as EditorSnapshot) ?? null;
  },

  async clear(chapterId: string): Promise<void> {
    await offlineDb.setMeta(snapshotKey(chapterId), null);
  },
};
