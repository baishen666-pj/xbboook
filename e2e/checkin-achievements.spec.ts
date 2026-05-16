import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Check-in & Achievements Flow', () => {
  test('performs check-in and earns achievements via API', async ({ page }) => {
    const name = `打卡测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    // Create a chapter first
    await page.request.post(`${BASE_URL}/api/projects/${project.id}/chapters`, {
      data: { title: 'Test Chapter' },
    });

    // Check in
    const checkInRes = await page.request.post(`${BASE_URL}/api/projects/${project.id}/checkins`, {
      data: { note: 'E2E test check-in' },
    });
    expect(checkInRes.status()).toBe(200);
    const checkIn = await checkInRes.json();
    expect(checkIn.data.checkIn).toBeDefined();
    expect(checkIn.data.newAchievements.length).toBeGreaterThan(0);

    // Verify stats
    const statsRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/checkins/stats`);
    const stats = await statsRes.json();
    expect(stats.data.totalCheckIns).toBeGreaterThanOrEqual(1);

    // Verify achievements
    const achieveRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/achievements`);
    const achievements = await achieveRes.json();
    expect(achievements.data.earned.length).toBeGreaterThan(0);
    expect(achievements.data.definitions.length).toBeGreaterThanOrEqual(15);
  });

  test('gets calendar data via API', async ({ page }) => {
    const name = `日历测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    const year = new Date().getFullYear();
    const calRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/checkins/calendar?year=${year}`);
    expect(calRes.status()).toBe(200);
    const cal = await calRes.json();
    expect(Array.isArray(cal.data)).toBe(true);
  });
});
