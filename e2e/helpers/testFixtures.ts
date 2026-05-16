import { test as base, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5210';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Create a test user
    const username = `e2e_${Date.now().toString(36)}`;
    const res = await page.request.post(`${BASE_URL}/api/users/identify`, {
      data: { username, displayName: 'E2E Tester' },
    });
    const body = await res.json();
    if (!body?.data?.id) {
      throw new Error(`User creation failed: ${JSON.stringify(body)}`);
    }

    await page.addInitScript((uid) => {
      localStorage.setItem('xbboook_user_id', uid);
    }, body.data.id);

    await use(page);
  },
});

export { expect };
export { BASE_URL };
