import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { setupTestDb } from './setup.js';

// Override getDb to use in-memory database
let testDb: Database.Database;

export function getTestDb(): Database.Database {
  if (!testDb) {
    testDb = setupTestDb();
  }
  return testDb;
}

export function resetTestDb(): void {
  if (testDb) {
    testDb.close();
  }
  testDb = setupTestDb();
}

// Mock the database module
export function installDbMock(): void {
  // We'll use a different approach: create a test server with injected db
}

// Seed a project and return its id
export function seedProject(db: Database.Database, name = 'Test Project'): string {
  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, name, description, genre, writing_mode, sort_order, created_at, updated_at)
    VALUES (?, ?, NULL, 'fantasy', 'webnovel', 0, ?, ?)
  `).run(id, name, now, now);
  return id;
}

// Seed a chapter and return its id
export function seedChapter(db: Database.Database, projectId: string, title = 'Test Chapter'): string {
  const id = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO chapters (id, project_id, volume_id, title, summary, word_count, file_path, status, sort_order, created_at, updated_at)
    VALUES (?, ?, NULL, ?, NULL, 0, ?, 'draft', 0, ?, ?)
  `).run(id, projectId, title, `${projectId}/chapters/${id}.md`, now, now);
  return id;
}
