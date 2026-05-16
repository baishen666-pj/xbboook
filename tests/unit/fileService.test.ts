import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

// fileService uses DATA_ROOT from process.cwd() + 'data/projects'
// We test with real temp directories to verify actual behavior
const DATA_ROOT = path.resolve(process.cwd(), 'data', 'projects');

describe('fileService', () => {
  const projectId = randomUUID();
  const chapterId = randomUUID();
  const projectDir = path.join(DATA_ROOT, projectId);
  const chapterFile = path.join(projectDir, 'chapters', `${chapterId}.md`);

  beforeEach(async () => {
    // Ensure clean state
    if (existsSync(projectDir)) {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    if (existsSync(projectDir)) {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  // Import dynamically so DATA_ROOT is computed from process.cwd()
  async function getService() {
    return await import('../../server/services/fileService.js');
  }

  describe('readChapter', () => {
    it('returns empty string when file does not exist', async () => {
      const { readChapter } = await getService();
      const content = await readChapter(randomUUID(), randomUUID());
      expect(content).toBe('');
    });

    it('reads content written by writeChapter', async () => {
      const { writeChapter, readChapter } = await getService();
      const pid = randomUUID();
      const cid = randomUUID();

      await writeChapter(pid, cid, 'Hello World');
      const content = await readChapter(pid, cid);
      expect(content).toBe('Hello World');

      // Cleanup
      await fs.rm(path.join(DATA_ROOT, pid), { recursive: true, force: true });
    });
  });

  describe('writeChapter', () => {
    it('creates directories and file', async () => {
      const { writeChapter } = await getService();
      const pid = randomUUID();
      const cid = randomUUID();

      await writeChapter(pid, cid, 'Test content');

      const filePath = path.join(DATA_ROOT, pid, 'chapters', `${cid}.md`);
      expect(existsSync(filePath)).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Test content');

      await fs.rm(path.join(DATA_ROOT, pid), { recursive: true, force: true });
    });
  });

  describe('validateId', () => {
    it('rejects non-UUID project IDs', async () => {
      const { readChapter } = await getService();
      await expect(readChapter('../etc', randomUUID())).rejects.toThrow('Invalid projectId');
    });

    it('rejects non-UUID chapter IDs', async () => {
      const { readChapter } = await getService();
      await expect(readChapter(randomUUID(), '../../../etc/passwd')).rejects.toThrow('Invalid chapterId');
    });

    it('rejects path traversal in project ID', async () => {
      const { writeChapter } = await getService();
      await expect(writeChapter('../../tmp', randomUUID(), 'hack')).rejects.toThrow('Invalid projectId');
    });
  });

  describe('ensureProjectDir', () => {
    it('creates project directory structure', async () => {
      const { ensureProjectDir } = await getService();
      const pid = randomUUID();

      await ensureProjectDir(pid);

      expect(existsSync(path.join(DATA_ROOT, pid, 'chapters'))).toBe(true);

      await fs.rm(path.join(DATA_ROOT, pid), { recursive: true, force: true });
    });
  });

  describe('version files', () => {
    it('writes and reads version content', async () => {
      const { writeVersion, readVersion } = await getService();
      const pid = randomUUID();
      const cid = randomUUID();

      await writeVersion(pid, cid, 1, 'Version 1 content');
      const content = await readVersion(pid, cid, 1);
      expect(content).toBe('Version 1 content');

      await fs.rm(path.join(DATA_ROOT, pid), { recursive: true, force: true });
    });

    it('deletes version file', async () => {
      const { writeVersion, deleteVersionFile, readVersion } = await getService();
      const pid = randomUUID();
      const cid = randomUUID();

      await writeVersion(pid, cid, 1, 'To delete');
      await deleteVersionFile(pid, cid, 1);
      const content = await readVersion(pid, cid, 1);
      expect(content).toBe('');

      await fs.rm(path.join(DATA_ROOT, pid), { recursive: true, force: true });
    });
  });
});
