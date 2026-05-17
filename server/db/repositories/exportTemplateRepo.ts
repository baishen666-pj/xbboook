import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface ExportTemplate {
  id: string;
  name: string;
  platform: string;
  description: string;
  css: string;
  header_html: string;
  footer_html: string;
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

export function findAll(): ExportTemplate[] {
  const db = getDb();
  return db.prepare('SELECT * FROM export_templates ORDER BY platform, name ASC').all() as ExportTemplate[];
}

export function findByPlatform(platform: string): ExportTemplate[] {
  const db = getDb();
  return db.prepare('SELECT * FROM export_templates WHERE platform = ? ORDER BY name ASC').all(platform) as ExportTemplate[];
}

export function findById(id: string): ExportTemplate | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM export_templates WHERE id = ?').get(id) as ExportTemplate | undefined;
}

export function create(data: {
  name: string;
  platform: string;
  description?: string;
  css: string;
  headerHtml?: string;
  footerHtml?: string;
}): ExportTemplate {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO export_templates (id, name, platform, description, css, header_html, footer_html, is_builtin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, data.name, data.platform, data.description ?? '', data.css, data.headerHtml ?? '', data.footerHtml ?? '', now, now);

  const created = findById(id);
  if (!created) throw new Error(`Failed to create export template: ${id}`);
  return created;
}

export function update(id: string, data: Partial<{
  name: string;
  description: string;
  css: string;
  header_html: string;
  footer_html: string;
}>): ExportTemplate | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE export_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing || existing.is_builtin) return false;
  db.prepare('DELETE FROM export_templates WHERE id = ?').run(id);
  return true;
}

export function seedBuiltins(): void {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as cnt FROM export_templates WHERE is_builtin = 1").get() as { cnt: number };
  if (count.cnt > 0) return;

  const now = new Date().toISOString();
  const builtins: ExportTemplate[] = [
    {
      id: uuid(),
      name: '微信默认',
      platform: 'wechat',
      description: '适配微信公众号编辑器的经典排版',
      css: `
body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif; color: #333; line-height: 1.75; font-size: 15px; }
h1 { text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0; color: #111; }
h2 { font-size: 18px; font-weight: bold; margin: 16px 0; color: #222; border-left: 4px solid #1a73e8; padding-left: 10px; }
p { text-indent: 2em; margin: 10px 0; letter-spacing: 0.5px; }
.dialogue { text-indent: 0; }
strong { color: #1a73e8; }
em { color: #666; }
blockquote { border-left: 3px solid #ddd; padding-left: 15px; color: #666; margin: 10px 0; }
hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
`.trim(),
      header_html: '',
      footer_html: '',
      is_builtin: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuid(),
      name: '微信文艺',
      platform: 'wechat',
      description: '文艺清新风格的微信公众号排版',
      css: `
body { font-family: "Georgia", "Noto Serif SC", "Source Han Serif SC", "STSong", serif; color: #2c3e50; line-height: 2; font-size: 15px; background: #fefefe; }
h1 { text-align: center; font-size: 20px; font-weight: normal; margin: 30px 0; letter-spacing: 3px; color: #2c3e50; }
h2 { font-size: 17px; font-weight: normal; margin: 20px 0; color: #34495e; text-align: center; }
h2::before { content: "· "; }
h2::after { content: " ·"; }
p { text-indent: 2em; margin: 12px 0; letter-spacing: 1px; }
strong { color: #8e44ad; font-weight: normal; border-bottom: 1px solid #8e44ad; }
em { color: #7f8c8d; font-style: normal; }
blockquote { border-left: 2px solid #bdc3c7; padding: 10px 15px; color: #7f8c8d; background: #f9f9f9; margin: 15px 0; }
hr { border: none; text-align: center; margin: 25px 0; }
hr::after { content: "◆ ◆ ◆"; color: #bdc3c7; font-size: 12px; letter-spacing: 5px; }
`.trim(),
      header_html: '',
      footer_html: '',
      is_builtin: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuid(),
      name: '通用 HTML',
      platform: 'generic_html',
      description: '通用 HTML 页面导出，适合博客和网页',
      css: `
body { max-width: 800px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #333; line-height: 1.8; }
h1 { font-size: 28px; margin: 30px 0 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
h2 { font-size: 22px; margin: 25px 0 15px; color: #444; }
p { text-indent: 2em; margin: 10px 0; }
blockquote { border-left: 4px solid #ddd; padding: 10px 20px; margin: 15px 0; background: #f9f9f9; color: #666; }
code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
`.trim(),
      header_html: '',
      footer_html: '',
      is_builtin: 1,
      created_at: now,
      updated_at: now,
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO export_templates (id, name, platform, description, css, header_html, footer_html, is_builtin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of builtins) {
    stmt.run(t.id, t.name, t.platform, t.description, t.css, t.header_html, t.footer_html, t.is_builtin, t.created_at, t.updated_at);
  }
}
