import { test, expect, Page } from '@playwright/test';

const ADMIN = { id: 'admin@dayflow.local', pw: 'Password123' };
const EMP = { id: 'john.doe@dayflow.local', pw: 'Password123' };

async function signIn(page: Page, who = ADMIN) {
  await page.goto('/signin');
  await page.getByPlaceholder(/OIJODO20220001 or email/).fill(who.id);
  await page.getByPlaceholder('••••••••').fill(who.pw);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/directory/);
}

test.describe('Dayflow smoke', () => {
  test('sign-in hero renders and demo login works', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: /every workday/i })).toBeVisible();
    await signIn(page);
    await expect(page.getByRole('link', { name: 'Employees' })).toBeVisible();
    await expect(page.locator('.card.hover-lift').first()).toBeVisible();
  });

  test('dashboard counters and reports load', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    await expect(page.getByText('Headcount')).toBeVisible();
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.getByText(/Headcount by department/)).toBeVisible();
  });

  test('employee can check in / out and sees the heat-map', async ({ page }) => {
    await signIn(page, EMP);
    await page.goto('/attendance');
    await expect(page.getByText('Month at a glance')).toBeVisible();
    await page.goto('/directory');
    await expect(page.getByRole('button', { name: /check in|check out/i }).first()).toBeVisible();
  });

  test('time-off modal opens via ?new=1, traps focus and closes with Esc', async ({ page }) => {
    await signIn(page, EMP);
    await page.goto('/leave?new=1');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('command palette opens with ⌘K and navigates', async ({ page }) => {
    await signIn(page);
    await page.keyboard.press('Meta+K');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await page.getByPlaceholder(/command or search/i).fill('My team');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/team/);
    await expect(page.getByRole('heading', { name: 'My team' })).toBeVisible();
  });

  test('dark mode toggle persists', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /switch to (dark|light) mode/i }).click();
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.reload();
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(theme);
  });

  test('API health and docs are served', async ({ request }) => {
    const api = process.env.API_URL || 'https://dayflow-api.vercel.app';
    const h = await request.get(`${api}/api/health`);
    expect(h.ok()).toBeTruthy();
    expect((await h.json()).status).toBe('ok');
    expect((await request.get(`${api}/api/openapi.json`)).ok()).toBeTruthy();
  });
});
