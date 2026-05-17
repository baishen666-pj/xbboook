import { v4 as uuid } from 'uuid';
import * as projectTemplateRepo from '../db/repositories/projectTemplateRepo.js';
import * as projectRepo from '../db/repositories/projectRepo.js';
import * as characterRepo from '../db/repositories/characterRepo.js';
import * as worldviewRepo from '../db/repositories/worldviewRepo.js';
import * as outlineRepo from '../db/repositories/outlineRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { writeChapter } from '../services/fileService.js';

export function listProjectTemplates(genre?: string) {
  return genre ? projectTemplateRepo.findByGenre(genre) : projectTemplateRepo.findAll();
}

export function getProjectTemplate(id: string) {
  return projectTemplateRepo.findById(id);
}

export function applyProjectTemplate(templateId: string) {
  const template = projectTemplateRepo.findById(templateId);
  if (!template) throw new Error('模板不存在');

  const structure = JSON.parse(template.structure) as projectTemplateRepo.ProjectTemplateStructure;
  const projectId = uuid();

  // Create project
  projectRepo.create({
    id: projectId,
    name: `${template.name}作品`,
    genre: structure.project.genre ?? template.genre ?? undefined,
    writingMode: structure.project.writingMode,
    writingStyle: structure.project.writingStyle,
    targetWords: structure.project.targetWords,
    dailyTarget: structure.project.dailyTarget,
  });

  // Create characters
  for (const char of structure.characters) {
    characterRepo.create({
      id: uuid(),
      projectId,
      name: char.name,
      roleType: char.roleType,
      gender: char.gender,
      personality: char.personality,
      background: char.background,
    });
  }

  // Create worldviews
  for (const wv of structure.worldview) {
    worldviewRepo.create({
      id: uuid(),
      projectId,
      category: wv.category,
      title: wv.title,
      content: wv.content,
    });
  }

  // Create outlines
  const outlineIdMap = new Map<string, string>();
  for (const ol of structure.outlines) {
    const olId = uuid();
    outlineIdMap.set(ol.title, olId);
    outlineRepo.create({
      id: olId,
      projectId,
      level: ol.level,
      parentId: undefined,
      title: ol.title,
      content: ol.content,
    });
  }

  // Create chapters with content
  for (let i = 0; i < structure.chapters.length; i++) {
    const ch = structure.chapters[i];
    const chId = uuid();
    chapterRepo.create({
      id: chId,
      projectId,
      title: ch.title,
      filePath: `${chId}.md`,
      sortOrder: i,
    });
    writeChapter(projectId, chId, ch.content);
  }

  return projectRepo.findById(projectId);
}

export function createFromProject(projectId: string, name: string, description?: string) {
  const project = projectRepo.findById(projectId);
  if (!project) throw new Error('项目不存在');

  const characters = characterRepo.findByProject(projectId);
  const worldviews = worldviewRepo.findByProject(projectId);
  const outlines = outlineRepo.findByProject(projectId);
  const chapters = chapterRepo.findByProject(projectId);

  const structure: projectTemplateRepo.ProjectTemplateStructure = {
    project: {
      genre: project.genre ?? undefined,
      writingMode: project.writing_mode ?? undefined,
      writingStyle: project.writing_style ?? undefined,
      targetWords: project.target_words ?? undefined,
      dailyTarget: project.daily_target ?? undefined,
    },
    characters: characters.map((c) => ({
      name: c.name,
      roleType: c.role_type,
      gender: c.gender ?? undefined,
      personality: c.personality ?? undefined,
      background: c.background ?? undefined,
    })),
    worldview: worldviews.map((w) => ({
      category: w.category,
      title: w.title,
      content: w.content ?? undefined,
    })),
    outlines: outlines.map((o) => ({
      title: o.title,
      content: o.content ?? undefined,
      level: o.level,
    })),
    chapters: chapters.slice(0, 3).map((ch) => ({
      title: ch.title,
      content: '',
    })),
  };

  return projectTemplateRepo.create({
    name,
    genre: project.genre ?? undefined,
    description,
    structure: JSON.stringify(structure),
  });
}

export function createUserTemplate(data: { name: string; genre?: string; description?: string; structure: string }) {
  JSON.parse(data.structure); // validate JSON
  return projectTemplateRepo.create(data);
}

export function deleteProjectTemplate(id: string) {
  return projectTemplateRepo.deleteById(id);
}
