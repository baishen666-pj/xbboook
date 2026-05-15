import { createHash } from 'crypto';
import * as versionRepo from '../db/repositories/versionRepo.js';
import { readVersion, writeVersion, deleteVersionFile } from './fileService.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';

const MAX_VERSIONS_PER_CHAPTER = 50;

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export async function saveVersion(
  projectId: string,
  chapterId: string,
  content: string,
  snapshotType: 'auto' | 'manual' | 'rollback',
  label?: string,
) {
  const hash = computeHash(content);

  const versions = versionRepo.findByChapter(chapterId, { limit: 1 });
  if (versions.length > 0 && versions[0]!.content_hash === hash) {
    return null;
  }

  const wordCount = content.length;

  const version = versionRepo.create({
    chapterId,
    projectId,
    contentHash: hash,
    wordCount,
    snapshotType,
    label,
  });

  await writeVersion(projectId, chapterId, version.version_number, content);

  const allVersions = versionRepo.findByChapter(chapterId);
  if (allVersions.length > MAX_VERSIONS_PER_CHAPTER) {
    const toDelete = allVersions.slice(MAX_VERSIONS_PER_CHAPTER);
    for (const v of toDelete) {
      await deleteVersionFile(projectId, chapterId, v.version_number);
    }
    versionRepo.deleteOldVersions(chapterId, MAX_VERSIONS_PER_CHAPTER);
  }

  return version;
}

export async function getVersionContent(
  projectId: string,
  chapterId: string,
  versionNumber: number,
): Promise<string> {
  return readVersion(projectId, chapterId, versionNumber);
}

export async function rollbackToVersion(
  projectId: string,
  chapterId: string,
  versionId: string,
) {
  const version = versionRepo.findById(versionId);
  if (!version || version.chapter_id !== chapterId) {
    throw new Error('版本不存在');
  }

  const content = await readVersion(projectId, chapterId, version.version_number);
  if (content === '') {
    throw new Error('版本文件不存在');
  }

  await chapterRepo.updateContent(chapterId, content);

  await saveVersion(projectId, chapterId, content, 'rollback', `回滚到版本 v${version.version_number}`);

  return content;
}

export function listVersions(chapterId: string, opts?: { limit?: number; offset?: number }) {
  return versionRepo.findByChapter(chapterId, opts);
}

export function getVersion(versionId: string) {
  return versionRepo.findById(versionId);
}

export async function deleteVersion(
  projectId: string,
  chapterId: string,
  versionId: string,
) {
  const version = versionRepo.findById(versionId);
  if (!version || version.chapter_id !== chapterId) {
    return false;
  }
  await deleteVersionFile(projectId, chapterId, version.version_number);
  return true;
}
