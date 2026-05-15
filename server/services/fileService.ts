import fs from 'fs';
import path from 'path';

const DATA_ROOT = path.join(process.cwd(), 'data', 'projects');

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function chapterFilePath(projectId: string, chapterId: string): string {
  return path.join(DATA_ROOT, projectId, 'chapters', `${chapterId}.md`);
}

export function readChapter(projectId: string, chapterId: string): string {
  const filePath = chapterFilePath(projectId, chapterId);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeChapter(projectId: string, chapterId: string, content: string): void {
  const filePath = chapterFilePath(projectId, chapterId);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function deleteChapter(projectId: string, chapterId: string): void {
  const filePath = chapterFilePath(projectId, chapterId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function ensureProjectDir(projectId: string): void {
  const chaptersDir = path.join(DATA_ROOT, projectId, 'chapters');
  ensureDir(chaptersDir);
}

export function deleteProjectDir(projectId: string): void {
  const projectDir = path.join(DATA_ROOT, projectId);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}
