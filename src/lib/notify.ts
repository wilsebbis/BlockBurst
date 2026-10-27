/**
 * Notification policy ("Notifications, widgets, interface and unlocks"), following its "Do" list and none of its
 * "Avoid" list:
 *  - asked only after a positive moment, behind our own pre-permission card, never on first launch;
 *  - every message is tied to something real: the gift box is full, today's Daily Board is out, your crew reached
 *    a milestone, an event you can see on the calendar has started, or (for a lapsed player) a gift is waiting;
 *  - never loss warnings ("your streak ends at midnight"), offers, guilt, fake urgency or "your clan needs you";
 *  - the player's own time zone, never in quiet hours (22:00–08:00), timed to their usual play hour;
 *  - at most one a day, suppressed while they're playing or on vacation, and stopped after 3 go unopened;
 *  - templates rotate (the least recently used one is picked), and win-backs are three gentle steps that then stop
 *    for good. Nothing is sent to someone who has clearly lapsed (three weeks away).
 * Pure functions here; the browser side lives in useNotifications.ts.
 */
export type NotifyKind = 'giftBoxFull' | 'dailyReady' | 'crewMilestone' | 'event' | 'winBack';

export const NOTIFY_KINDS: { kind: NotifyKind; label: string }[] = [
  { kind: 'dailyReady', label: "Today's Daily Board is out" },
  { kind: 'giftBoxFull', label: 'Your gift box is full' },
  { kind: 'crewMilestone', label: 'Your crew reached a milestone' },
  { kind: 'event', label: 'A calendar event has started' },
  { kind: 'winBack', label: 'A welcome-back gift is waiting (after a long break)' },
];

export interface NotifyPrefs {
  enabled: boolean;
  /** Whether our pre-permission card has been answered (we only ever ask once on our own). */
  asked: boolean;
  quietStartHour: number;
  quietEndHour: number;
  kinds: Record<NotifyKind, boolean>;
}

export const defaultPrefs = (): NotifyPrefs => ({
  enabled: false,
  asked: false,
  quietStartHour: 22,
  quietEndHour: 8,
  kinds: { dailyReady: true, giftBoxFull: true, crewMilestone: true, event: true, winBack: true },
});

export interface NotifyLog {
  /** Local date key -> count sent that day. */
  sentOn: Record<string, number>;
  /** Sent since the player last opened the game. */
  unopened: number;
  /** Recent session-start hours (local), to learn the usual play time. */
  sessionHours: number[];
  /** Index of the last template used per kind, for rotation. */
  lastTemplate: Partial<Record<NotifyKind, number>>;
  /** Win-back steps already sent since the player last played. */
  winBackSent: number;
}

export const emptyLog = (): NotifyLog => ({ sentOn: {}, unopened: 0, sessionHours: [], lastTemplate: {}, winBackSent: 0 });

export const MAX_PER_DAY = 1;
export const STOP_AFTER_UNOPENED = 3;
export const WIN_BACK_DAYS = [3, 7, 14];
/** After this long away, the player has made their choice; we stop entirely. */
export const LAPSED_DAYS = 21;

const DAY = 86_400_000;

export const localDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function inQuietHours(hour: number, prefs: NotifyPrefs): boolean {
  const { quietStartHour: s, quietEndHour: e } = prefs;
  return s > e ? hour >= s || hour < e : hour >= s && hour < e;
}

/** Median of recent session-start hours, or 18:00 if we don't know yet. */
export function usualHour(log: NotifyLog): number {
  if (!log.sessionHours.length) return 18;
  const sorted = [...log.sessionHours].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Short, true, one emoji at most, in the game's own voice, and each deep-links to its screen. */
export const TEMPLATES: Record<NotifyKind, { title: string; body: string }[]> = {
  dailyReady: [
    { title: 'Daily Board', body: "🧱 Today's board is out. Same start for everyone." },
    { title: 'Daily Board', body: 'A fresh board is ready whenever you are.' },
    { title: 'Daily Board', body: "Today's board has a nice pattern. Have a look when you like." },
  ],
  giftBoxFull: [
    { title: 'Gift box', body: '🎁 Your gift box is full. It will wait for you.' },
    { title: 'Gift box', body: 'The gift box filled up while you were away.' },
  ],
  crewMilestone: [
    { title: 'Your crew', body: '🎉 Your crew reached a milestone. A reward is waiting for everyone.' },
    { title: 'Your crew', body: 'Milestone reached together. Your share is ready to claim.' },
  ],
  event: [
    { title: 'Event', body: '{name} has started. See the calendar for details.' },
    { title: 'Event', body: '{name} is on now.' },
  ],
  winBack: [
    { title: 'Block Burst', body: '🎁 A welcome-back gift is waiting, whenever you like.' },
    { title: 'Block Burst', body: 'Your collection and your days-played total are just as you left them.' },
    { title: 'Block Burst', body: "This is the last reminder we'll send. Come back any time." },
  ],
};

export const DEEP_LINK: Record<NotifyKind, string> = { dailyReady: '/?go=daily', giftBoxFull: '/?go=home', crewMilestone: '/?go=crew', event: '/?go=events', winBack: '/?go=home' };

export interface NotifyFacts {
  /** When the gift box fills (ms epoch), if it isn't full yet or hasn't been collected. */
  boxFullAt: number | null;
  dailyUnplayed: boolean;
  crewMilestoneReady: boolean;
  /** An event that started (or starts) today, by name. */
  eventToday: string | null;
  lastPlayedAt: number;
  appVisible: boolean;
  vacation: boolean;
}

export interface PlannedNotification {
  at: number;
  kind: NotifyKind;
  title: string;
  body: string;
  url: string;
  template: number;
}

/** Push `t` forward out of quiet hours. */
function afterQuiet(t: Date, prefs: NotifyPrefs): Date {
  const d = new Date(t);
  for (let i = 0; i < 24 && inQuietHours(d.getHours(), prefs); i++) d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

/** The next time at the player's usual hour, on or after `from`. */
function atUsualHour(from: Date, log: NotifyLog): Date {
  const at = new Date(from);
  at.setHours(usualHour(log), 0, 0, 0);
  if (at.getTime() < from.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/** Rotate: the template after the last one used. */
export const nextTemplate = (kind: NotifyKind, log: NotifyLog) => ((log.lastTemplate[kind] ?? -1) + 1) % TEMPLATES[kind].length;

/** The next notification worth sending, or null. */
export function planNext(now: Date, prefs: NotifyPrefs, log: NotifyLog, facts: NotifyFacts): PlannedNotification | null {
  if (!prefs.enabled || facts.vacation || facts.appVisible) return null;
  if (log.unopened >= STOP_AFTER_UNOPENED) return null;
  const away = (now.getTime() - facts.lastPlayedAt) / DAY;
  if (away > LAPSED_DAYS) return null;
  const candidates: { at: number; kind: NotifyKind; name?: string }[] = [];
  const add = (kind: NotifyKind, at: Date, name?: string) => prefs.kinds[kind] && candidates.push({ kind, at: afterQuiet(at, prefs).getTime(), name });

  if (facts.boxFullAt !== null) add('giftBoxFull', new Date(Math.max(now.getTime(), facts.boxFullAt)));
  if (facts.dailyUnplayed) add('dailyReady', atUsualHour(now, log));
  if (facts.crewMilestoneReady) add('crewMilestone', atUsualHour(now, log));
  if (facts.eventToday) add('event', atUsualHour(now, log), facts.eventToday);
  if (log.winBackSent < WIN_BACK_DAYS.length) {
    const due = facts.lastPlayedAt + WIN_BACK_DAYS[log.winBackSent] * DAY;
    if (due <= now.getTime() + DAY) add('winBack', atUsualHour(new Date(Math.max(now.getTime(), due)), log));
  }

  candidates.sort((a, b) => a.at - b.at);
  for (const c of candidates) {
    const day = localDayKey(new Date(c.at));
    if ((log.sentOn[day] ?? 0) >= MAX_PER_DAY) continue;
    // Away for a while, only the win-back step speaks: fewer, bigger reasons rather than daily nagging.
    if (away >= WIN_BACK_DAYS[0] && c.kind !== 'winBack' && c.kind !== 'event') continue;
    const template = c.kind === 'winBack' ? Math.min(log.winBackSent, TEMPLATES.winBack.length - 1) : nextTemplate(c.kind, log);
    const t = TEMPLATES[c.kind][template];
    return { at: c.at, kind: c.kind, title: t.title, body: t.body.replace('{name}', c.name ?? 'An event'), url: DEEP_LINK[c.kind], template };
  }
  return null;
}

/** Record that a notification was sent. */
export function markSent(log: NotifyLog, n: PlannedNotification): NotifyLog {
  const day = localDayKey(new Date(n.at));
  return {
    ...log,
    sentOn: { ...log.sentOn, [day]: (log.sentOn[day] ?? 0) + 1 },
    unopened: log.unopened + 1,
    lastTemplate: { ...log.lastTemplate, [n.kind]: n.template },
    winBackSent: n.kind === 'winBack' ? log.winBackSent + 1 : log.winBackSent,
  };
}

/** The player opened the game: reset the unopened count and win-back steps, and learn their usual hour. */
export function markOpened(log: NotifyLog, now: Date): NotifyLog {
  return { ...log, unopened: 0, winBackSent: 0, sessionHours: [...log.sessionHours, now.getHours()].slice(-14) };
}
