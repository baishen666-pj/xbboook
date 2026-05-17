import { test, expect, BASE_URL } from './helpers/testFixtures';

test.describe('Backup Flow', () => {
  test('creates a backup and returns info', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/backups`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('filename');
    expect(body.data).toHaveProperty('size');
    expect(body.data).toHaveProperty('createdAt');
  });

  test('lists backups', async ({ page }) => {
    await page.request.post(`${BASE_URL}/api/backups`);

    const res = await page.request.get(`${BASE_URL}/api/backups`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const first = body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('filename');
    expect(first).toHaveProperty('size');
  });

  test('deletes a backup', async ({ page }) => {
    const createRes = await page.request.post(`${BASE_URL}/api/backups`);
    const { data } = await createRes.json();

    const delRes = await page.request.delete(`${BASE_URL}/api/backups/${data.id}`);
    expect(delRes.ok()).toBe(true);

    const listRes = await page.request.get(`${BASE_URL}/api/backups`);
    const list = await listRes.json();
    const ids = list.data.map((b: { id: string }) => b.id);
    expect(ids).not.toContain(data.id);
  });
});
