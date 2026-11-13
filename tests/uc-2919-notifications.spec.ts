import { expect, type BrowserContext, type Page, test } from '@playwright/test';

import { FakeBackend, makeItem } from '../helpers/uc2919-notification-backend';

/**
 * UC-2919 Notification Center, ATS side.
 *
 * Evidence on a MOCKED API: the built ATS runs against `context.route` fakes for
 * the REST session/organization endpoints, GraphQL (matched by operation name) and
 * the SSE stream. This does not exercise the real backend; backend behaviour is
 * covered by the Jest integration tests in uc-talent-backend.
 *
 * Run the built ATS first: `pnpm exec vite preview --port 3210 --strictPort`.
 */
const API = 'http://localhost:3001';
const APP = 'http://localhost:3210';
const ORG = 'org-1';
const USER = 'user-1';

const now = Date.now();

const session = {
  sessionId: 's-1', userId: USER, provider: 'google', roles: ['recruiter'], name: 'Recruiter One',
  email: 'owner@example.com', issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 3_600_000).toISOString(),
};
const organization = {
  id: ORG, name: 'Acme', slug: 'acme', status: 'active', organizationKind: 'BUSINESS', logo: { url: 'https://example.invalid/logo.png' },
  membership: { id: 'm-1', role: 'OWNER', status: 'ACTIVE', userId: USER, organizationId: ORG },
};

async function mockApi(context: BrowserContext, backend: FakeBackend) {
  await context.route(/^https?:\/\/(?!localhost:(3210|3001))/, (route) => route.abort());
  await context.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = { 'access-control-allow-origin': APP, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

    if (url.pathname === '/api/notifications/stream') {
      return backend.serveStream(route, { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    }
    if (url.pathname === '/graphql') {
      const { query, variables } = request.postDataJSON() as { query: string; variables?: Record<string, any> };
      const op = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '';
      try {
        return json({ data: backend.graphql(op, variables ?? {}) });
      } catch (error) {
        return json({ errors: [{ message: (error as Error).message }], data: null });
      }
    }
    if (url.pathname.startsWith('/auth/session')) return json(session);
    if (url.pathname === '/auth/refresh') return json(session);
    if (url.pathname.endsWith('/users/me')) return json({ data: { id: USER, username: 'khoi_dev', name: 'Recruiter One', email: 'owner@example.com' } });
    if (url.pathname.endsWith('/organizations/me')) return json({ data: { currentOrganizationId: ORG, organizations: [organization] } });
    if (url.pathname.includes('/access')) {
      return json({ data: { organizationId: ORG, role: 'OWNER', permissions: ['JOB_MANAGE_ALL', 'JOB_CREATE', 'COMPANY_PROFILE', 'COMPANY_SETTINGS'] } });
    }
    return json({ data: {} });
  });
}

async function openApp(page: Page, path: string) {
  page.on('pageerror', (error) => console.log('PAGEERROR', error.message));
  await page.addInitScript(() => {
    localStorage.setItem('ats.language', 'en');
  });
  await page.goto(`${APP}${path}`);
  const reject = page.getByRole('button', { name: /reject|decline/i });
  if (await reject.first().isVisible({ timeout: 1500 }).catch(() => false)) await reject.first().click();
}

const bell = (page: Page) => page.getByRole('button', { name: 'Notifications' }).first();

test.describe('UC-2919 notification center (ATS, mocked API)', () => {
  let backend: FakeBackend;

  test.beforeEach(async ({ context }) => {
    backend = new FakeBackend(APP);
    await mockApi(context, backend);
  });

  test('bell shows unread + due reminders and opens the panel (AC-01, AC-04, AC-05)', async ({ page }) => {
    await openApp(page, `/posted-jobs?org=${ORG}`);
    await expect(bell(page)).toBeVisible();
    await expect(bell(page).getByText('4')).toBeVisible(); // 3 unread + 1 due reminder
    await bell(page).click();
    const panel = page.getByRole('dialog').or(page.locator('.MuiPopover-paper'));
    await expect(panel.getByText('Linh tagged you in a note')).toBeVisible();
    await expect(panel.getByText('3 candidates applied to Data Analyst')).toBeVisible();
    await expect(panel.getByText('New', { exact: true })).toBeVisible(); // P-1 group
    await expect(panel.getByText('Earlier', { exact: true })).toBeVisible();
  });

  test('mark as read keeps position; mark all read does not close E2 (AC-07, AC-08)', async ({ page }) => {
    await openApp(page, `/posted-jobs?org=${ORG}`);
    await bell(page).click();
    const panel = page.locator('.MuiPopover-paper');
    await panel.getByText('3 candidates applied to Data Analyst').hover();
    await panel.getByRole('button', { name: 'Mark as read' }).first().click({ trial: false }).catch(async () => {
      await panel.getByLabel(/more/i).first().click();
      await page.getByRole('menuitem', { name: 'Mark as read' }).click();
    });
    await expect.poll(() => backend.calls.some((c) => c.op === 'V2MarkNotificationRead')).toBe(true);

    await panel.getByLabel(/more|options/i).first().click();
    await page.getByRole('menuitem', { name: 'Mark all as read' }).click();
    await expect.poll(() => backend.calls.some((c) => c.op === 'V2MarkAllNotificationsRead')).toBe(true);
    expect(backend.items.find((i) => i.id === 'e2')).toMatchObject({ isRead: true, resolvedAt: null });
  });

  test('opening an E2 closes it; the Action required tab no longer lists it (AC-06, AC-10)', async ({ page }) => {
    await openApp(page, `/posted-jobs?org=${ORG}`);
    await bell(page).click();
    const panel = page.locator('.MuiPopover-paper');
    await panel.getByRole('tab', { name: 'Action required' }).click();
    await expect(panel.getByText('Linh tagged you in a note')).toBeVisible();
    await panel.getByText('Linh tagged you in a note').click();
    await expect.poll(() => backend.items.find((i) => i.id === 'e2')?.resolvedAt).not.toBeNull();
    await expect(page).toHaveURL(/posted-jobs\/job-1\/candidates/);
    await bell(page).click();
    await page.locator('.MuiPopover-paper').getByRole('tab', { name: 'Action required' }).click();
    await expect(page.locator('.MuiPopover-paper').getByText('Linh tagged you in a note')).toHaveCount(0);
  });

  test('history page filters from the URL and loads more by cursor (AC-09)', async ({ page }) => {
    backend.extraPages = [[makeItem('old-1', 'E6_NOTE_TAG_ADDED', 'Older tag item', 60 * 72)]];
    await openApp(page, `/notifications?org=${ORG}&read=unread`);
    await expect(page.getByText('3 candidates applied to Data Analyst')).toBeVisible();
    const first = backend.calls.find((c) => c.op === 'V2Notifications');
    expect(first?.variables.filter).toMatchObject({ readState: 'unread', tab: 'all' });
    // The sentinel is already in view, so the next page loads by itself (infinite scroll); the button is the fallback.
    await expect(page.getByText('Older tag item')).toBeVisible();
    expect(backend.calls.filter((c) => c.op === 'V2Notifications').some((c) => c.variables.cursor === 'next')).toBe(true);
    await page.getByRole('button', { name: 'Action required', exact: true }).click();
    await expect(page).toHaveURL(/tab=action/);
    await expect(page).toHaveURL(/read=unread/); // filters survive in the URL
  });

  test('push opt-in only on click; registers the subscription and turns the switch on (AC-22)', async ({ page, context }) => {
    await context.addInitScript(() => {
      let permission = 'default';
      const fakeSubscription = { toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p256', auth: 'authsecret' } }) };
      (window as any).__permissionRequests = 0;
      class FakeNotification {
        static get permission() { return permission; }
        static requestPermission() { (window as any).__permissionRequests++; permission = 'granted'; return Promise.resolve('granted'); }
      }
      (window as any).Notification = FakeNotification;
      (window as any).PushManager = class {};
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          register: () => Promise.resolve({ pushManager: { subscribe: () => Promise.resolve(fakeSubscription) } }),
          ready: Promise.resolve({}),
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
      });
    });
    await openApp(page, `/posted-jobs?org=${ORG}`);
    expect(await page.evaluate(() => (window as any).__permissionRequests)).toBe(0); // never asked on login
    await bell(page).click();
    await page.getByRole('button', { name: 'Turn on browser alerts' }).click();
    await expect.poll(() => backend.pushRegistrations.length).toBe(1);
    expect(backend.pushRegistrations[0]).toMatchObject({ app: 'ats', endpoint: 'https://push.example/abc', p256dh: 'p256', auth: 'authsecret' });
    expect(backend.calls.some((c) => c.op === 'V2UpdateNotificationSettings' && c.variables.input.pushEnabled === true)).toBe(true);
    await expect(page.getByRole('button', { name: 'Turn on browser alerts' })).toHaveCount(0);
  });

  test('denied permission removes the opt-in button (AC-22)', async ({ page, context }) => {
    await context.addInitScript(() => {
      (window as any).Notification = class { static permission = 'denied'; static requestPermission() { return Promise.resolve('denied'); } };
      (window as any).PushManager = class {};
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { addEventListener: () => undefined, removeEventListener: () => undefined } });
    });
    await openApp(page, `/posted-jobs?org=${ORG}`);
    await bell(page).click();
    await expect(page.getByRole('button', { name: 'Turn on browser alerts' })).toHaveCount(0);
  });

  test('a badge event on the stream updates the bell without a reload (BOTH-1.7)', async ({ page }) => {
    await openApp(page, `/posted-jobs?org=${ORG}`);
    await expect(bell(page).getByText('4', { exact: true })).toBeVisible({ timeout: 10000 });
    backend.items.push(...Array.from({ length: 6 }, (_, i) => makeItem(`live-${i}`, 'E1_APPLICATION_RECEIVED', `Live application ${i}`, 0)));
    backend.emit('badge', backend.badge());
    await expect(bell(page).getByText('10', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('a changed setting refreshes the bell; a muted job hides its items including REJECTED (BOTH-1.6)', async ({ page }) => {
    backend.items.push(makeItem('t1', 'T1_APPLICATION_STATUS', 'Your application was closed', 2, { bellLocked: false, category: 'FYI' }));
    await openApp(page, `/notifications/settings?org=${ORG}`);
    await expect(bell(page).getByText('5', { exact: true })).toBeVisible(); // 4 unread + 1 due reminder

    const badgeCalls = () => backend.calls.filter((c) => c.op === 'V2NotificationBadge').length;
    const before = badgeCalls();
    const bellSwitch = page.getByRole('checkbox', { name: 'Tagged in a note bell' });
    await bellSwitch.click();
    await expect(bellSwitch).not.toBeChecked();
    await expect(bell(page).getByText('4', { exact: true })).toBeVisible({ timeout: 10000 }); // the settings event refetched the badge
    expect(badgeCalls()).toBeGreaterThan(before);

    await bell(page).click();
    const panel = page.locator('.MuiPopover-paper');
    await expect(panel.getByText('Linh tagged you in a note')).toHaveCount(0);
    const e1Row = panel.getByText('3 candidates applied to Data Analyst').locator('xpath=ancestor::div[.//button[@aria-haspopup="menu"]][1]');
    await e1Row.hover();
    await e1Row.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Mute notifications for this job' }).click();
    await expect.poll(() => backend.calls.some((c) => c.op === 'V2MuteJobNotifications')).toBe(true);
    await expect(panel.getByText('3 candidates applied to Data Analyst')).toHaveCount(0);
    await expect(panel.getByText('Your application was closed')).toHaveCount(0);
    const bellButton = page.locator('button[aria-haspopup="dialog"][aria-label="Notifications"]');
    await expect(bellButton.getByText('2', { exact: true })).toHaveCount(0);
  });

  test('settings page lists the HR types and the muted-jobs section (BOTH-1.8, ATS)', async ({ page }) => {
    await openApp(page, `/notifications/settings?org=${ORG}`);
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Tagged in a note bell' })).toBeVisible();
    await expect(page.getByText('No muted jobs')).toBeVisible();
  });

  test('a push clicked with no tab open lands on its link and marks the item read (AC-24)', async ({ page }) => {
    await openApp(page, `/posted-jobs?org=${ORG}&notification=e2`);
    await expect.poll(() => backend.calls.some((c) => c.op === 'V2MarkNotificationOpened' && c.variables.id === 'e2')).toBe(true);
    await expect.poll(() => backend.items.find((i) => i.id === 'e2')?.resolvedAt).not.toBeNull();
    await expect(page).toHaveURL(/posted-jobs/);
  });

  test('a T5 reward opens the Earn UPP dialog in ATS instead of the talent page (UPP)', async ({ page }) => {
    backend.items.push(makeItem('t5', 'T5_UPP_CLAIMABLE', 'Reward ready to claim', 3, { jobId: null, deepLink: '/quests', workspaceName: null, contextLine: null }));
    await openApp(page, `/posted-jobs?org=${ORG}`);
    await bell(page).click();
    await page.locator('.MuiPopover-paper').getByText('Reward ready to claim').click();

    await expect(page.getByRole('dialog').getByText('Earn UPP', { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/quests/);
  });

  test('a 401 stream recovers after authenticated badge recovery', async ({ page }) => {
    backend.streamFailures = 1;
    await openApp(page, `/notifications?org=${ORG}`);
    await expect.poll(() => backend.streamRequests).toBeGreaterThan(1);
    expect(backend.calls.filter(c => c.op === 'V2NotificationBadge').length).toBeGreaterThan(1);
    backend.dueReminders = 0;
    backend.items.push(...Array.from({ length: 5 }, (_, i) => makeItem(`recovered-${i}`, 'E1_APPLICATION_RECEIVED', `Recovered application ${i}`, 0)));
    backend.emit('badge', backend.badge());
    await expect(bell(page).getByText('8', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('settings includes T5 rewards', async ({ page }) => {
    await openApp(page, `/notifications/settings?org=${ORG}`);
    await expect(page.getByRole('checkbox', { name: 'UPP rewards bell' })).toBeVisible();
  });

  test('T5 in history opens Earn UPP', async ({ page }) => {
    backend.items.push(makeItem('t5', 'T5_UPP_CLAIMABLE', 'You earned 25 UPP', 3, { jobId: null, deepLink: '/quests', contextLine: 'Lan submitted their first application' }));
    await openApp(page, `/notifications?org=${ORG}`);
    await page.getByText('You earned 25 UPP').click();
    await expect(page.getByRole('dialog').getByText('Earn UPP', { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/quests/);
  });

  test('T5 push opens Earn UPP', async ({ page }) => {
    backend.items.push(makeItem('t5', 'T5_UPP_CLAIMABLE', 'You earned 25 UPP', 3, { deepLink: '/quests', jobId: null }));
    await openApp(page, `/notifications?org=${ORG}&notification=t5`);
    await expect(page.getByRole('dialog').getByText('Earn UPP', { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/quests/);
  });

  test('T5 service-worker message opens Earn UPP in the existing tab', async ({ page }) => {
    backend.items.push(makeItem('t5', 'T5_UPP_CLAIMABLE', 'You earned 25 UPP', 3, { deepLink: '/quests', jobId: null }));
    await openApp(page, `/notifications?org=${ORG}`);
    await expect(bell(page)).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'notification-opened', id: 't5' } })));
    await expect(page.getByRole('dialog').getByText('Earn UPP', { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/quests/);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('T5 in the mobile sheet opens Earn UPP', async ({ page }) => {
      backend.items.push(makeItem('t5', 'T5_UPP_CLAIMABLE', 'You earned 25 UPP', 3, { deepLink: '/quests', jobId: null }));
      await openApp(page, `/posted-jobs?org=${ORG}`);
      await bell(page).click();
      await page.getByRole('dialog').getByText('You earned 25 UPP').click();
      await expect(page.getByRole('dialog').getByText('Earn UPP', { exact: true })).toBeVisible();
      await expect(page).not.toHaveURL(/quests/);
    });

    test('the bell opens a full-screen sheet with both tabs (AC-18)', async ({ page }) => {
      await openApp(page, `/posted-jobs?org=${ORG}`);
      await bell(page).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('tab', { name: 'Action required' })).toBeVisible();
      await expect(sheet.getByText('3 candidates applied to Data Analyst')).toBeVisible();
      const box = await sheet.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(389);
    });
  });
});
