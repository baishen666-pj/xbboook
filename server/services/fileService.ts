import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const DATA_ROOT = path.resolve(process.cwd(), 'data', 'projects');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateId(id: string, label: string): void {
  if (!UUID_RE.test(id)) {
    throw new Error(`Invalid ${label} format`);
  }
}

function ensureContained(resolvedPath: string): void {
  if (!resolvedPath.startsWith(DATA_ROOT + path.sep) && resolvedPath !== DATA_ROOT) {
    throw new Error('Path traversal detected');
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

function chapterFilePath(projectId: string, chapterId: string): string {
  validateId(projectId, 'projectId');
  validateId(chapterId, 'chapterId');
  const filePath = path.resolve(DATA_ROOT, projectId, 'chapters', `${chapterId}.md`);
  ensureContained(filePath);
  return filePath;
}

function projectDirPath(projectId: string): string {
  validateId(projectId, 'projectId');
  const dirPath = path.resolve(DATA_ROOT, projectId);
  ensureContained(dirPath);
  return dirPath;
}

export async function readChapter(projectId: string, chapterId: string): Promise<string> {
  const filePath = chapterFilePath(projectId, chapterId);
  if (!existsSync(filePath)) return '';
  return fs.readFile(filePath, 'utf-8');
}

export async function writeChapter(projectId: string, chapterId: string, content: string): Promise<void> {
  const filePath = chapterFilePath(projectId, chapterId);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function deleteChapter(projectId: string, chapterId: string): Promise<void> {
  const filePath = chapterFilePath(projectId, chapterId);
  if (existsSync(filePath)) {
    await fs.unlink(filePath);
  }
}

export async function ensureProjectDir(projectId: string): Promise<void> {
  const dirPath = projectDirPath(projectId);
  await ensureDir(path.join(dirPath, 'chapters'));
}

export async function deleteProjectDir(projectId: string): Promise<void> {
  const dirPath = projectDirPath(projectId);
  if (existsSync(dirPath)) {
    await fs.rm(dirPath, { recursive: true, force: true });
  }
}

function versionFilePath(projectId: string, chapterId: string, versionNumber: number): string {
  validateId(projectId, 'projectId');
  validateId(chapterId, 'chapterId');
  const filePath = path.resolve(DATA_ROOT, projectId, 'versions', chapterId, `v${versionNumber}.md`);
  ensureContained(filePath);
  return filePath;
}

function versionDirPath(projectId: string, chapterId: string): string {
  validateId(projectId, 'projectId');
  validateId(chapterId, 'chapterId');
  const dirPath = path.resolve(DATA_ROOT, projectId, 'versions', chapterId);
  ensureContained(dirPath);
  return dirPath;
}

export async function writeVersion(
  projectId: string,
  chapterId: string,
  versionNumber: number,
  content: string,
): Promise<void> {
  const filePath = versionFilePath(projectId, chapterId, versionNumber);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function readVersion(
  projectId: string,
  chapterId: string,
  versionNumber: number,
): Promise<string> {
  const filePath = versionFilePath(projectId, chapterId, versionNumber);
  if (!existsSync(filePath)) return '';
  return fs.readFile(filePath, 'utf-8');
}

export async function deleteVersionFile(
  projectId: string,
  chapterId: string,
  versionNumber: number,
): Promise<void> {
  const filePath = versionFilePath(projectId, chapterId, versionNumber);
  if (existsSync(filePath)) {
    await fs.unlink(filePath);
  }
}

export async function deleteVersionDir(projectId: string, chapterId: string): Promise<void> {
  const dirPath = versionDirPath(projectId, chapterId);
  if (existsSync(dirPath)) {
    await fs.rm(dirPath, { recursive: true, force: true });
  }
}
