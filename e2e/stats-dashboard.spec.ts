import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Stats & Dashboard Flow', () => {
  test('returns dashboard data for a project', async ({ page }) => {
    const name = `统计测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    const dashRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/stats/dashboard`);
    expect(dashRes.status()).toBe(200);
    const dash = await dashRes.json();
    expect(dash.data.summary).toBeDefined();
    expect(dash.data.streak).toBeDefined();
    expect(dash.data.target).toBeDefined();
  });

  test('creates and retrieves daily stats', async ({ page }) => {
    const name = `每日统计${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    const today = new Date().toISOString().slice(0, 10);
    const statRes = await page.request.post(`${BASE_URL}/api/projects/${project.id}/stats`, {
      data: { date: today, wordsAdded: 1500 },
    });
    expect(statRes.status()).toBe(200);

    const recentRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/stats/recent?days=7`);
    expect(recentRes.status()).toBe(200);
    const recent = await recentRes.json();
    expect(recent.data.length).toBeGreaterThanOrEqual(1);
  });
});
