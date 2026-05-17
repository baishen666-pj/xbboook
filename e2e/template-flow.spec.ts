import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Template Flow', () => {
  test('lists built-in project templates', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/project-templates`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(4);

    const names = body.data.map((t: { name: string }) => t.name);
    expect(names).toContain('玄幻修仙');
    expect(names).toContain('都市逆袭');
  });

  test('lists templates filtered by genre', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/project-templates?genre=玄幻`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    body.data.forEach((t: { genre: string | null }) => {
      expect(t.genre).toBe('玄幻');
    });
  });

  test('applies project template creating full project', async ({ page }) => {
    const listRes = await page.request.get(`${BASE_URL}/api/project-templates?genre=玄幻`);
    const { data: templates } = await listRes.json();
    const tpl = templates.find((t: { name: string }) => t.name === '玄幻修仙');
    expect(tpl).toBeTruthy();

    const applyRes = await page.request.post(
      `${BASE_URL}/api/project-templates/${tpl.id}/apply`,
      { data: {} }
    );
    const body = await applyRes.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();

    const projectId = body.data.id;

    const charsRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/characters`);
    const chars = await charsRes.json();
    expect(chars.data.length).toBeGreaterThanOrEqual(1);

    const wvRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/worldviews`);
    const wv = await wvRes.json();
    expect(wv.data.length).toBeGreaterThanOrEqual(1);

    const chRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/chapters`);
    const ch = await chRes.json();
    expect(ch.data.length).toBeGreaterThanOrEqual(1);
  });

  test('outline templates list and apply', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/templates`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(4);
  });

  test('creates template from existing project', async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `模板提取${uid()}`, genre: '玄幻' },
    });
    const { data: project } = await projRes.json();

    const tplRes = await page.request.post(`${BASE_URL}/api/project-templates/from-project`, {
      data: { projectId: project.id, name: `提取模板${uid()}`, description: 'E2E test' },
    });
    const tplBody = await tplRes.json();
    expect(tplBody.success).toBe(true);
    expect(tplBody.data.id).toBeTruthy();
    expect(tplBody.data.isBuiltin).toBe(false);

    const delRes = await page.request.delete(`${BASE_URL}/api/project-templates/${tplBody.data.id}`);
    expect(delRes.ok()).toBe(true);
  });
});
