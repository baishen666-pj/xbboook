import { openDB, type IDBPDatabase } from "idb";
import type { QueuedOperation } from "@/types/offline";

const DB_NAME = "xbboook-offline";
const DB_VERSION = 1;

interface XbboookDB {
  chapters: { key: string; value: Record<string, unknown>; indexes: { projectId: string } };
  projects: { key: string; value: Record<string, unknown> };
  characters: { key: string; value: Record<string, unknown>; indexes: { projectId: string } };
  worldviews: { key: string; value: Record<string, unknown>; indexes: { projectId: string } };
  outlines: { key: string; value: Record<string, unknown>; indexes: { projectId: string } };
  editQueue: { key: number; value: QueuedOperation; indexes: { projectId: string; createdAt: string } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<XbboookDB>> | null = null;

function getDb(): Promise<IDBPDatabase<XbboookDB>> {
  if (!dbPromise) {
    dbPromise = openDB<XbboookDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("chapters")) {
          const s = db.createObjectStore("chapters", { keyPath: "id" });
          s.createIndex("projectId", "projectId");
        }
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("characters")) {
          const s = db.createObjectStore("characters", { keyPath: "id" });
          s.createIndex("projectId", "projectId");
        }
        if (!db.objectStoreNames.contains("worldviews")) {
          const s = db.createObjectStore("worldviews", { keyPath: "id" });
          s.createIndex("projectId", "projectId");
        }
        if (!db.objectStoreNames.contains("outlines")) {
          const s = db.createObjectStore("outlines", { keyPath: "id" });
          s.createIndex("projectId", "projectId");
        }
        if (!db.objectStoreNames.contains("editQueue")) {
          const s = db.createObjectStore("editQueue", { keyPath: "id", autoIncrement: true });
          s.createIndex("projectId", "projectId");
          s.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export const offlineDb = {
  // --- Chapters ---
  async putChapter(chapter: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.put("chapters", chapter);
  },
  async getChapter(id: string): Promise<Record<string, unknown> | undefined> {
    const db = await getDb();
    return db.get("chapters", id);
  },
  async getChaptersByProject(projectId: string): Promise<Record<string, unknown>[]> {
    const db = await getDb();
    return db.getAllFromIndex("chapters", "projectId", projectId);
  },

  // --- Projects ---
  async putProject(project: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.put("projects", project);
  },
  async getProject(id: string): Promise<Record<string, unknown> | undefined> {
    const db = await getDb();
    return db.get("projects", id);
  },
  async getAllProjects(): Promise<Record<string, unknown>[]> {
    const db = await getDb();
    return db.getAll("projects");
  },

  // --- Characters ---
  async putCharacter(character: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.put("characters", character);
  },
  async getCharactersByProject(projectId: string): Promise<Record<string, unknown>[]> {
    const db = await getDb();
    return db.getAllFromIndex("characters", "projectId", projectId);
  },

  // --- Worldviews ---
  async putWorldview(worldview: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.put("worldviews", worldview);
  },
  async getWorldviewsByProject(projectId: string): Promise<Record<string, unknown>[]> {
    const db = await getDb();
    return db.getAllFromIndex("worldviews", "projectId", projectId);
  },

  // --- Outlines ---
  async putOutline(outline: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.put("outlines", outline);
  },
  async getOutlinesByProject(projectId: string): Promise<Record<string, unknown>[]> {
    const db = await getDb();
    return db.getAllFromIndex("outlines", "projectId", projectId);
  },

  // --- Edit Queue ---
  async queueEdit(operation: Omit<QueuedOperation, "id">): Promise<void> {
    const db = await getDb();
    await db.put("editQueue", operation as QueuedOperation);
  },
  async getPendingEdits(): Promise<QueuedOperation[]> {
    const db = await getDb();
    const all = await db.getAll("editQueue");
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  async removeEdit(id: number): Promise<void> {
    const db = await getDb();
    await db.delete("editQueue", id);
  },
  async clearEditQueue(): Promise<void> {
    const db = await getDb();
    await db.clear("editQueue");
  },
  async getPendingCount(): Promise<number> {
    const db = await getDb();
    return db.count("editQueue");
  },

  // --- Meta ---
  async setMeta<T>(key: string, value: T): Promise<void> {
    const db = await getDb();
    await db.put("meta", { key, value });
  },
  async getMeta<T>(key: string): Promise<T | undefined> {
    const db = await getDb();
    const entry = await db.get("meta", key);
    return entry?.value as T | undefined;
  },

  // --- Clear ---
  async clearAll(): Promise<void> {
    const db = await getDb();
    await Promise.all([
      db.clear("chapters"),
      db.clear("projects"),
      db.clear("characters"),
      db.clear("worldviews"),
      db.clear("outlines"),
      db.clear("editQueue"),
      db.clear("meta"),
    ]);
  },
};
