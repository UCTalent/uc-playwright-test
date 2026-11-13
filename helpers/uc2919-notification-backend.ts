import type { Route } from '@playwright/test';

/**
 * Fake of the UC-2919 notification GraphQL and SSE contract, shared by the ATS and
 * Next.js specs. Operation names match `services/notifications/graphql.ts` in both apps.
 */
export type Item = {
  id: string; type: string; category: 'FYI' | 'ACTION_REQUIRED'; bellLocked: boolean; title: string;
  contextLine: string | null; deepLink: string; itemCount: number; isRead: boolean; readAt: string | null;
  resolvedAt: string | null; lastEventAt: string; createdAt: string; actor: null; jobId: string | null; workspaceName: string | null;
};

const now = Date.now();
export const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
export const makeItem = (id: string, type: string, title: string, minutesAgo: number, extra: Partial<Item> = {}): Item => ({
  id, type, category: type === 'E2_NOTE_MENTIONED' ? 'ACTION_REQUIRED' : 'FYI', bellLocked: false, title,
  contextLine: 'Data Analyst · Career page', deepLink: '/posted-jobs/job-1/candidates?org=org-1', itemCount: 1,
  isRead: false, readAt: null, resolvedAt: null, lastEventAt: iso(minutesAgo), createdAt: iso(minutesAgo),
  actor: null, jobId: 'job-1', workspaceName: 'Acme', ...extra,
});

export class FakeBackend {
  items: Item[] = [
    makeItem('e2', 'E2_NOTE_MENTIONED', 'Linh tagged you in a note', 5),
    makeItem('e1', 'E1_APPLICATION_RECEIVED', '3 candidates applied to Data Analyst', 20, { itemCount: 3 }),
    makeItem('e5', 'E5_TEAM_MEMBER_ADDED', 'You were added to the hiring team of Data Analyst', 60 * 30),
  ];
  extraPages: Item[][] = [];
  calls: { op: string; variables: Record<string, any> }[] = [];
  pushRegistrations: Record<string, any>[] = [];
  settings = { pushEnabled: true, digestTailEnabled: true, updatedAt: null };
  prefs: Record<string, { bell: boolean }> = {};
  mutedJobs = new Set<string>();
  /** Queued while the client is between two stream requests; delivered on the next one. */
  pending: string[] = [];
  /** E4 reminders exist for HR only; talent tests set this to 0. */
  dueReminders = 1;
  streamRequests = 0;
  streamFailures = 0;

  constructor(
    private readonly appOrigin: string,
    private readonly preferenceTypes: string[] = ['E1_APPLICATION_RECEIVED', 'E2_NOTE_MENTIONED', 'E5_TEAM_MEMBER_ADDED', 'T5_UPP_CLAIMABLE'],
  ) {}

  /** Contract 6: every item follows its bell preference and job mute. */
  visible(item: Item) {
    return (this.prefs[item.type]?.bell ?? true) && !(item.jobId && this.mutedJobs.has(item.jobId));
  }

  badge() {
    return { unread: this.items.filter((i) => !i.isRead && this.visible(i)).length, dueReminders: (this.prefs.E4_REMINDER_DUE?.bell ?? true) && !this.mutedJobs.has("job-1") ? this.dueReminders : 0 };
  }

  preference(type: string) {
    return { type, bell: this.prefs[type]?.bell ?? true, bellLocked: false, push: true, pushEligible: true, digest: true, actionRequired: type === 'E2_NOTE_MENTIONED' };
  }

  /** Queued; the client picks it up on its next stream request (`retry: 100`). */
  emit(event: string, data: unknown = {}) {
    this.pending.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  graphql(op: string, v: Record<string, any>): unknown {
    this.calls.push({ op, variables: v });
    const find = (id: string) => this.items.find((i) => i.id === id);
    switch (op) {
      case 'V2Notifications': {
        const f = v.filter ?? {};
        if (f.type === 'E4_REMINDER_DUE') return { v2Notifications: { items: [], nextCursor: null, hasMore: false } };
        if (v.cursor) {
          const index = v.cursor === 'next' ? 0 : Number(String(v.cursor).split(':')[1]);
          const page = this.extraPages[index] ?? [];
          const hasMore = index + 1 < this.extraPages.length;
          return { v2Notifications: { items: page, nextCursor: hasMore ? `next:${index + 1}` : null, hasMore } };
        }
        let items = this.items.filter((i) => this.visible(i));
        if (f.tab === 'action') items = items.filter((i) => i.category === 'ACTION_REQUIRED' && !i.resolvedAt);
        if (f.readState === 'unread') items = items.filter((i) => !i.isRead);
        if (f.type) items = items.filter((i) => i.type === f.type);
        return { v2Notifications: { items, nextCursor: this.extraPages.length ? 'next' : null, hasMore: this.extraPages.length > 0 } };
      }
      case 'V2NotificationBadge':
        return { v2NotificationBadge: this.badge() };
      case 'V2MarkNotificationRead': {
        const item = find(v.id);
        if (item) Object.assign(item, { isRead: true, readAt: iso(0) });
        return { v2MarkNotificationRead: Boolean(item) };
      }
      case 'V2MarkNotificationOpened': {
        const item = find(v.id);
        if (!item) throw new Error('not found');
        Object.assign(item, { isRead: true, readAt: iso(0) });
        if (item.type === 'E2_NOTE_MENTIONED') item.resolvedAt = iso(0); // contract 4
        return { v2MarkNotificationOpened: item.deepLink };
      }
      case 'V2MarkAllNotificationsRead':
        this.items.forEach((i) => Object.assign(i, { isRead: true, readAt: iso(0) })); // E2 stays unresolved (AC-08)
        return { v2MarkAllNotificationsRead: true };
      case 'V2NotificationSettings':
        return { v2NotificationSettings: this.settings };
      case 'V2NotificationPreferences':
        return { v2NotificationPreferences: this.preferenceTypes.map((type) => this.preference(type)) };
      case 'V2NotificationJobMutes':
        return { v2NotificationJobMutes: [...this.mutedJobs].map((jobId) => ({ jobId, jobTitle: 'Data Analyst', workspaceName: 'Acme' })) };
      case 'V2UpdateNotificationPreference': {
        const current = this.prefs[v.type] ?? { bell: true };
        this.prefs[v.type] = { bell: v.input.bell ?? current.bell };
        this.emit('settings');
        return { v2UpdateNotificationPreference: this.preference(v.type) };
      }
      case 'V2MuteJobNotifications': {
        if (v.muted) this.mutedJobs.add(v.jobId);
        else this.mutedJobs.delete(v.jobId);
        this.emit('settings');
        return { v2MuteJobNotifications: true };
      }
      case 'V2NotificationPushPublicKey':
        return { v2NotificationPushPublicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' };
      case 'V2RegisterPushSubscription':
        this.pushRegistrations.push(v);
        return { v2RegisterPushSubscription: true };
      case 'V2UpdateNotificationSettings':
        this.settings = { ...this.settings, ...v.input };
        this.emit('settings');
        return { v2UpdateNotificationSettings: this.settings };
      default:
        return {};
    }
  }

  /** Every stream request answers at once with the queued frames and closes; the client reconnects after `retry`. */
  serveStream(route: Route, headers: Record<string, string>) {
    this.streamRequests++;
    if (this.streamFailures-- > 0) return route.fulfill({ status: 401, headers, body: '' });
    const frames = this.pending.splice(0).join('') || ': ping\n\n';
    return route.fulfill({ status: 200, headers, body: `retry: 100\n${frames}` });
  }
}
