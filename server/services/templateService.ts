import * as templateRepo from '../db/repositories/templateRepo.js';
import * as outlineRepo from '../db/repositories/outlineRepo.js';
import type { TemplateNode } from '../types/index.js';

export function listTemplates(genre?: string) {
  if (genre) return templateRepo.findByGenre(genre);
  return templateRepo.findAll();
}

export function getTemplate(id: string) {
  return templateRepo.findById(id);
}

export function applyTemplate(templateId: string, projectId: string, mode: 'replace' | 'append' = 'append') {
  const template = templateRepo.findById(templateId);
  if (!template) throw new Error('模板不存在');

  const nodes: TemplateNode[] = JSON.parse(template.structure);

  if (mode === 'replace') {
    const existing = outlineRepo.findByProject(projectId);
    for (const outline of existing) {
      outlineRepo.deleteById(outline.id);
    }
  }

  const parentIdMap = new Map<number, string>();
  let currentParentId: string | null = null;

  for (const node of nodes) {
    const created = outlineRepo.create({
      projectId,
      level: node.level,
      parentId: node.level > 0 ? parentIdMap.get(node.level - 1) ?? currentParentId : undefined,
      title: node.title,
      content: node.content,
    });

    if (node.level === 0) {
      currentParentId = created.id;
      parentIdMap.set(0, created.id);
    } else {
      parentIdMap.set(node.level, created.id);
      currentParentId = created.id;
    }
  }

  return outlineRepo.findByProject(projectId);
}

export function createFromProject(projectId: string, name: string, genre: string, description?: string) {
  const outlines = outlineRepo.findByProject(projectId);
  if (outlines.length === 0) throw new Error('该项目暂无大纲可保存为模板');

  const structure: TemplateNode[] = outlines.map((o) => ({
    title: o.title,
    content: o.content ?? undefined,
    level: o.level,
  }));

  return templateRepo.create({
    name,
    genre,
    description,
    sourceProjectId: projectId,
    structure: JSON.stringify(structure),
  });
}

export function createUserTemplate(data: { name: string; genre: string; description?: string; structure: string }) {
  return templateRepo.create({
    name: data.name,
    genre: data.genre,
    description: data.description,
    structure: data.structure,
  });
}

export function updateUserTemplate(id: string, data: Record<string, unknown>) {
  const template = templateRepo.findById(id);
  if (!template) throw new Error('模板不存在');
  if (template.is_builtin) throw new Error('内置模板不可编辑');
  return templateRepo.update(id, data);
}

export function deleteTemplate(id: string) {
  return templateRepo.deleteById(id);
}
