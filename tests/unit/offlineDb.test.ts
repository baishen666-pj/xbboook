import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";

describe("offlineDb", () => {
  let offlineDb: typeof import("../../src/services/offlineDb")["offlineDb"];

  beforeEach(async () => {
    // Re-import to reset the DB connection
    const mod = await import("../../src/services/offlineDb");
    offlineDb = mod.offlineDb;
    await offlineDb.clearAll();
  });

  it("stores and retrieves a chapter", async () => {
    const chapter = { id: "ch-1", title: "Test Chapter", projectId: "p-1" };
    await offlineDb.putChapter(chapter);
    const retrieved = await offlineDb.getChapter("ch-1");
    expect(retrieved).toEqual(chapter);
  });

  it("returns undefined for non-existent chapter", async () => {
    const result = await offlineDb.getChapter("non-existent");
    expect(result).toBeUndefined();
  });

  it("lists chapters by project", async () => {
    await offlineDb.putChapter({ id: "ch-1", projectId: "p-1" });
    await offlineDb.putChapter({ id: "ch-2", projectId: "p-1" });
    await offlineDb.putChapter({ id: "ch-3", projectId: "p-2" });
    const chapters = await offlineDb.getChaptersByProject("p-1");
    expect(chapters).toHaveLength(2);
  });

  it("stores and retrieves a project", async () => {
    const project = { id: "p-1", name: "Test Project" };
    await offlineDb.putProject(project);
    const retrieved = await offlineDb.getProject("p-1");
    expect(retrieved).toEqual(project);
  });

  it("lists all projects", async () => {
    await offlineDb.putProject({ id: "p-1", name: "A" });
    await offlineDb.putProject({ id: "p-2", name: "B" });
    const projects = await offlineDb.getAllProjects();
    expect(projects).toHaveLength(2);
  });

  it("stores and retrieves characters by project", async () => {
    await offlineDb.putCharacter({ id: "c-1", projectId: "p-1", name: "Alice" });
    await offlineDb.putCharacter({ id: "c-2", projectId: "p-1", name: "Bob" });
    await offlineDb.putCharacter({ id: "c-3", projectId: "p-2", name: "Charlie" });
    const chars = await offlineDb.getCharactersByProject("p-1");
    expect(chars).toHaveLength(2);
  });

  it("stores and retrieves worldviews by project", async () => {
    await offlineDb.putWorldview({ id: "w-1", projectId: "p-1", title: "魔法系统" });
    const wvs = await offlineDb.getWorldviewsByProject("p-1");
    expect(wvs).toHaveLength(1);
  });

  it("stores and retrieves outlines by project", async () => {
    await offlineDb.putOutline({ id: "o-1", projectId: "p-1", title: "起" });
    const outlines = await offlineDb.getOutlinesByProject("p-1");
    expect(outlines).toHaveLength(1);
  });

  it("queues and retrieves edits", async () => {
    await offlineDb.queueEdit({
      type: "saveContent",
      projectId: "p-1",
      targetId: "ch-1",
      payload: { content: "test" },
      createdAt: Date.now(),
      version: 1,
    });
    const edits = await offlineDb.getPendingEdits();
    expect(edits).toHaveLength(1);
    expect(edits[0].type).toBe("saveContent");
  });

  it("removes an edit by id", async () => {
    await offlineDb.queueEdit({
      type: "saveContent",
      projectId: "p-1",
      targetId: "ch-1",
      payload: { content: "test" },
      createdAt: Date.now(),
      version: 1,
    });
    const edits = await offlineDb.getPendingEdits();
    expect(edits).toHaveLength(1);
    await offlineDb.removeEdit(edits[0].id!);
    const after = await offlineDb.getPendingEdits();
    expect(after).toHaveLength(0);
  });

  it("counts pending edits", async () => {
    await offlineDb.queueEdit({
      type: "saveContent",
      projectId: "p-1",
      targetId: "ch-1",
      payload: {},
      createdAt: 1,
      version: 1,
    });
    await offlineDb.queueEdit({
      type: "updateChapter",
      projectId: "p-1",
      targetId: "ch-2",
      payload: {},
      createdAt: 2,
      version: 1,
    });
    const count = await offlineDb.getPendingCount();
    expect(count).toBe(2);
  });

  it("clears edit queue", async () => {
    await offlineDb.queueEdit({
      type: "saveContent",
      projectId: "p-1",
      targetId: "ch-1",
      payload: {},
      createdAt: 1,
      version: 1,
    });
    await offlineDb.clearEditQueue();
    const count = await offlineDb.getPendingCount();
    expect(count).toBe(0);
  });

  it("stores and retrieves meta values", async () => {
    await offlineDb.setMeta("cache:test", { data: "hello" });
    const val = await offlineDb.getMeta("cache:test");
    expect(val).toEqual({ data: "hello" });
  });

  it("returns undefined for non-existent meta", async () => {
    const val = await offlineDb.getMeta("non-existent");
    expect(val).toBeUndefined();
  });

  it("clears all stores", async () => {
    await offlineDb.putChapter({ id: "ch-1", projectId: "p-1" });
    await offlineDb.putProject({ id: "p-1", name: "Test" });
    await offlineDb.setMeta("key", "val");
    await offlineDb.clearAll();
    expect(await offlineDb.getAllProjects()).toHaveLength(0);
    expect(await offlineDb.getChapter("ch-1")).toBeUndefined();
    expect(await offlineDb.getMeta("key")).toBeUndefined();
  });
});
