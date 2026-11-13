import { expect, type BrowserContext, type Page, test } from '@playwright/test';

import { FakeBackend, makeItem } from '../helpers/uc2919-notification-backend';

/**
 * UC-2919 Notification Center, Next.js (talent) side.
 *
 * Evidence on a MOCKED API: uc-frontend-nextjs-v1 runs on :3101
 * against `context.route` fakes for the auth session, the NestJS profile check, GraphQL
 * (matched by operation name) and the SSE stream. Backend behaviour is covered by the Jest
 * integration tests in uc-talent-backend.
 *
 * Run the app first on :3101. Local verification may use `pnpm exec next dev -p 3101`.
 */
const APP = 'http://localhost:3101';
const API = 'http://localhost:3001';
const USER = 'talent-user-1';

const now = Date.now();
const session = {
  sessionId: 's-2', userId: USER, provider: 'google', roles: ['talent'], name: 'Talent One',
  email: 'talent@example.com', issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 3_600_000).toISOString(),
};

const TALENT_TYPES = ['T1_APPLICATION_STATUS', 'T3_REFERRAL_SUBMITTED', 'T8_JOB_MATCH'];

function talentBackend() {
  const backend = new FakeBackend(APP, TALENT_TYPES);
  backend.dueReminders = 0;
  backend.items = [
    makeItem('t1', 'T1_APPLICATION_STATUS', 'Your application moved to interview', 5, { workspaceName: null, contextLine: null, deepLink: '/my-applications?highlight=job-1' }),
    makeItem('t3', 'T3_REFERRAL_SUBMITTED', 'Your referral was submitted', 20, { workspaceName: null, contextLine: null, deepLink: '/my-referrals?highlight=job-1' }),
    makeItem('r1', 'T1_APPLICATION_STATUS', 'Your application was closed', 2, { bellLocked: false, workspaceName: null, contextLine: null, deepLink: '/my-applications?highlight=job-1' }),
  ];
  return backend;
}

async function mockNext(context: BrowserContext, backend: FakeBackend) {
  await context.route(/^https?:\/\/(?!localhost:(3101|3001))/, (route) => route.abort());
  await context.route(`${APP}/api/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = /session|refresh/.test(path) ? session : {};
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': APP, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  });
  await context.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = { 'access-control-allow-origin': APP, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

    if (url.pathname === '/api/notifications/stream') {
      return backend.serveStream(route, { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    }
    if (url.pathname === '/api/v2/talents/me') return json({ talentMe: { id: 'talent-1', username: 'talent-one', hasValidProfile: true } });
    if (url.pathname === '/graphql') {
      const { query, variables } = request.postDataJSON() as { query: string; variables?: Record<string, any> };
      const op = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '';
      try {
        if (op === "TalentMe") return json({ data: { talentMe: { id: "talent-1", name: "Talent One", phoneCode: "+84", phoneNumber: "900000000" } } });
        return json({ data: backend.graphql(op, variables ?? {}) });
      } catch (error) {
        return json({ errors: [{ message: (error as Error).message }], data: null });
      }
    }
    return json({ data: {} });
  });
}

async function openNext(page: Page, path: string) {
  page.on('pageerror', (error) => console.log('PAGEERROR', error.message));
  await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole("button", { name: "Reject non-essential" });
  if (await reject.isVisible({ timeout: 1500 }).catch(() => false)) await reject.click();
}

const bell = (page: Page) => page.getByRole('button', { name: 'Notifications' }).first();

test.describe('UC-2919 notification center (Next.js, mocked API)', () => {
  let backend: FakeBackend;

  test.beforeEach(async ({ context }) => {
    backend = talentBackend();
    await mockNext(context, backend);
  });

  test('settings page lists the talent types only (BOTH-1.8, Next.js)', async ({ page }) => {
    await openNext(page, '/en/notifications/settings');
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Application status bell' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Tagged in a note bell' })).toHaveCount(0);
  });

  test('a badge event on the stream updates the bell without a reload (BOTH-1.7, Next.js)', async ({ page }) => {
    await openNext(page, '/en/notifications');
    await expect(bell(page).getByText('3', { exact: true })).toBeVisible();
    backend.items.push(...Array.from({ length: 6 }, (_, i) => makeItem(`live-${i}`, 'T1_APPLICATION_STATUS', `Live status ${i}`, 0)));
    backend.emit('badge', backend.badge());
    await expect(bell(page).getByText('9', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('a push clicked with no tab open lands on its link and marks the item read (AC-24, Next.js)', async ({ page }) => {
    await openNext(page, '/en/notifications?notification=t3');
    await expect.poll(() => backend.calls.some((c) => c.op === 'V2MarkNotificationOpened' && c.variables.id === 't3')).toBe(true);
  });

  test('a changed setting refreshes the bell; a muted job hides items and T1 REJECTED follows its preference (BOTH-1.6, Next.js)', async ({ page }) => {
    await openNext(page, '/en/notifications/settings');
    await expect(bell(page).getByText('3', { exact: true })).toBeVisible();

    const typeSwitch = page.getByRole('checkbox', { name: 'Application status bell' });
    await typeSwitch.click();
    await expect(typeSwitch).not.toBeChecked();
    await expect(bell(page).getByText('1', { exact: true })).toBeVisible({ timeout: 10000 }); // the settings event refetched the badge

    await bell(page).click();
    const panel = page.locator('.MuiPopover-paper');
    await expect(panel.getByText('Your application moved to interview')).toHaveCount(0);
    await expect(panel.getByText('Your application was closed')).toHaveCount(0);
    await expect(panel.getByText('Your referral was submitted')).toBeVisible();
    const referralRow = panel.getByText('Your referral was submitted').locator('xpath=ancestor::div[.//button[@aria-haspopup="menu"]][1]');
    await referralRow.hover();
    await referralRow.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Mute notifications for this job' }).click();
    await expect.poll(() => backend.calls.some((c) => c.op === 'V2MuteJobNotifications')).toBe(true);
    await expect(panel.getByText('Your referral was submitted')).toHaveCount(0);
    await expect(panel.getByText('Your application was closed')).toHaveCount(0);
    await page.mouse.click(5, 300); // the Next.js panel closes on an outside click, not on Escape
    await expect(panel).toBeHidden();
    await expect(bell(page).getByText('1', { exact: true })).toHaveCount(0);
  });
});
