/**
 * Crews: co-op clans of up to 10 (Cluck Crossing's Coops and Bark Battle's Dog Pack).
 *
 *  - Whenever you earn XP, 20% is *mirrored* into the crew's weekly pool. It is never taken from you.
 *  - Weekly pool milestones reward every member the same. Reached milestones never expire: anything unclaimed is
 *    paid out when the week rolls over.
 *  - No contribution leaderboard inside a crew, no kicking, no minimums, no "you let the team down". Standings
 *    are crew vs crew only, as a whole.
 *  - Milestones scale with the crew's size, and are tuned so the practice members alone reach the first one: a
 *    group goal is always achievable by free play, and nobody's break costs the others anything.
 *  - Inviting friends earns nothing. An invite is just a link, so nobody is turned into a recruiter.
 *  - "Share a gift" once a day: the game pays every member (you included). Nobody owes anything back, and
 *    nobody is shown as not having sent one.
 *  - Chat is quick-chat only: a fixed menu of friendly phrases, so there is nothing to moderate and nothing mean
 *    to say.
 *  - "Play solo" leaves at any time. You keep everything, nobody is told, and you can rejoin.
 *
 * Offline, crews are practice crews made of labelled [BOT] members whose pace is deterministic per week. Real
 * crews of real players need the Supabase backend (supabase/schema.sql).
 */
import { createRng, murmur3 } from '../engine/rng';
import { isoWeek, utcDateKey, weekProgress } from './dates';

export const CREW_SIZE = 10;
export const SHARE = 0.2;

/** Milestones per member (you included); the crew's targets are these times its size. */
export const MILESTONES = [
  { perMember: 110, coins: 60, label: '🪙 60 for everyone' },
  { perMember: 200, coins: 120, label: '🪙 120 for everyone' },
  { perMember: 270, coins: 150, cosmetic: 'crew-banner', label: '🚩 The Crew Colours theme for everyone' },
] as const;

export const crewSize = (crew: Crew) => crew.members.length + 1;
export const milestoneAt = (i: number, crew: Crew) => MILESTONES[i].perMember * crewSize(crew);

export const CREW_GIFT_COINS = 10;

export const EMBLEMS = ['🧱', '🟥', '🟦', '🟩', '🟨', '🟪', '💎', '⭐', '🔥', '🌈', '🚀', '🍬', '🎯', '🧩', '👑', '⚡'];

export const PHRASES = [
  'Nice clears, everyone! 🧱',
  'Daily Board done ✅',
  'Combo x5 just now 🔥',
  'Saving room for the 3x3 😅',
  'Good luck this week 🍀',
  'We hit a milestone! 🎉',
  'Taking a break today 💤',
  'New best for me! 🏁',
  'Thanks, crew 💛',
  'Perfect Clear! ✨',
] as const;

export interface CrewMember {
  name: string;
  bot: boolean;
  emblem: string;
}

export interface Crew {
  id: string;
  name: string;
  emblem: string;
  motto: string;
  /** True for crews whose other members are practice bots (always, until a backend is connected). */
  practice: boolean;
  members: CrewMember[];
}

const CREW_NAMES = ['Line Breakers', 'Combo Club', 'Grid Masters', 'Block Party', 'Square Deal', 'Tetra Team', 'Perfect Clears', 'Night Stackers', 'Gem Hunters', 'Corner Kings'];
const MOTTOS = ['One line at a time.', 'Leave room for the big one.', 'Every clear counts.', 'We stack together.', 'Combos are better with friends.'];
const BOT_NAMES = ['Brix', 'Tetra', 'Cubby', 'Pixel', 'Stacks', 'Quadra', 'Linus', 'Biscuit', 'Nibbles', 'Domino', 'Sprig', 'Fluff', 'Pecan', 'Wren', 'Tansy', 'Bramble'];

/** A short shareable code for a crew id. */
export const inviteCode = (id: string) => murmur3(`burst/crew/${id}`).toString(36).toUpperCase().padStart(7, '0').slice(0, 6);

function practiceMembers(seed: string, n: number): CrewMember[] {
  const rng = createRng(`burst/crew/members/${seed}`);
  const names = rng.shuffle(BOT_NAMES.slice()).slice(0, n);
  return names.map((name) => ({ name, bot: true, emblem: rng.pick(EMBLEMS) }));
}

/** The directory of practice crews to join. The same for everyone. */
export function directory(): Crew[] {
  return CREW_NAMES.slice(0, 8).map((name, i) => {
    const rng = createRng(`burst/crew/dir/v1/${i}`);
    const id = `dir-${i}`;
    return { id, name, emblem: EMBLEMS[(i * 5) % EMBLEMS.length], motto: rng.pick(MOTTOS), practice: true, members: practiceMembers(id, rng.range(5, 9)) };
  });
}

/** A crew you start: you plus four labelled practice helpers until real friends join through the backend. */
export function createCrew(name: string, emblem: string, motto: string, now = Date.now()): Crew {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 22) || 'My Crew';
  const id = `own-${now.toString(36)}`;
  return { id, name: clean, emblem: EMBLEMS.includes(emblem) ? emblem : EMBLEMS[0], motto: motto.trim().slice(0, 60), practice: true, members: practiceMembers(id, 4) };
}

/** Joining by invite code: a directory crew if it matches, otherwise (offline) a practice crew seeded by the code. */
export function crewFromCode(code: string): Crew {
  const c = code.trim().toUpperCase();
  const known = directory().find((d) => inviteCode(d.id) === c);
  if (known) return known;
  const rng = createRng(`burst/crew/code/${c}`);
  return { id: `code-${c}`, name: `Crew ${c}`, emblem: rng.pick(EMBLEMS), motto: rng.pick(MOTTOS), practice: true, members: practiceMembers(c, rng.range(3, 6)) };
}

/** What each practice member has mirrored into the pool so far this week. Steady, deterministic, never reactive. */
export function botContributions(crew: Crew, now = Date.now()): { name: string; xp: number }[] {
  const week = isoWeek(now);
  const p = weekProgress(now);
  return crew.members
    .filter((m) => m.bot)
    .map((m) => {
      const rng = createRng(`burst/crew/pace/v1/${crew.id}/${m.name}/${week}`);
      // A narrow, steady pace (260–380 a week), so goals stay predictable and reachable.
      const weekly = 260 + rng.next() * 120;
      return { name: m.name, xp: Math.round(weekly * p) };
    });
}

export const mirrored = (xp: number) => Math.floor(xp * SHARE);

export const poolTotal = (crew: Crew, myWeeklyShare: number, now = Date.now()) => botContributions(crew, now).reduce((a, b) => a + b.xp, 0) + myWeeklyShare;

export const reachedMilestones = (pool: number, crew: Crew) => MILESTONES.map((_, i) => (pool >= milestoneAt(i, crew) ? i : -1)).filter((i) => i >= 0);

export interface ChatLine {
  id: string;
  from: string;
  bot: boolean;
  phrase: number;
  at: number;
}

/** Practice members' quick-chat lines for a day: one or two, the same for everyone in that crew. */
export function botChat(crew: Crew, day = utcDateKey()): ChatLine[] {
  const bots = crew.members.filter((m) => m.bot);
  if (!bots.length) return [];
  const rng = createRng(`burst/crew/chat/v1/${crew.id}/${day}`);
  const n = rng.range(1, 2);
  const base = Date.parse(`${day}T08:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const m = rng.pick(bots);
    return { id: `${day}-${i}`, from: m.name, bot: true, phrase: rng.int(PHRASES.length), at: base + rng.int(12 * 3600_000) };
  });
}

/** Crew vs crew standings for the week, as wholes. Every other crew is a labelled practice crew offline. */
export function standings(mine: Crew | null, myPool: number, now = Date.now()): { name: string; emblem: string; pool: number; mine: boolean }[] {
  const rows = directory()
    .filter((d) => d.id !== mine?.id)
    .map((d) => ({ name: d.name, emblem: d.emblem, pool: poolTotal(d, 0, now), mine: false }));
  if (mine) rows.push({ name: mine.name, emblem: mine.emblem, pool: myPool, mine: true });
  return rows.sort((a, b) => b.pool - a.pool);
}

export interface CrewState {
  crew: Crew | null;
  week: string;
  /** Your mirrored share this week (20% of XP), never deducted from you. */
  myShare: number;
  claimed: number[];
  chat: ChatLine[];
  /** Crews you've been in, so "rejoin" is one tap. */
  past: Crew[];
  /** UTC day you last shared a gift. */
  giftDay: string | null;
}

export const emptyCrew = (now = Date.now()): CrewState => ({ crew: null, week: isoWeek(now), myShare: 0, claimed: [], chat: [], past: [], giftDay: null });

/**
 * Crew members' Daily Board scores ("Where the money comes from": friend boards motivate more than global ones).
 * Practice members' scores are deterministic per day and labelled. Nobody is shown as "didn't play".
 */
export function crewDailyBoard(crew: Crew, day: string): { name: string; score: number; bot: boolean }[] {
  return crew.members
    .map((m) => {
      const rng = createRng(`burst/crew/daily/v1/${crew.id}/${m.name}/${day}`);
      return { name: m.name, score: Math.round((800 + Math.pow(rng.next(), 1.5) * 12000) / 10) * 10, bot: m.bot, played: rng.chance(0.7) };
    })
    .filter((r) => r.played)
    .map(({ name, score, bot }) => ({ name, score, bot }));
}

/**
 * Start a new week. Milestones reached last week but not claimed are paid out now (returned), because rewards
 * you've earned never expire.
 */
export function rolloverCrew(s: CrewState, now = Date.now()): { state: CrewState; payout: number[] } {
  const week = isoWeek(now);
  if (s.week === week) return { state: s, payout: [] };
  // Last week's pool as it stood when the week closed.
  const lastPool = s.crew ? botContributions(s.crew, Date.parse(weekEndOf(s.week))).reduce((a, b) => a + b.xp, 0) + s.myShare : 0;
  const payout = s.crew ? reachedMilestones(lastPool, s.crew).filter((i) => !s.claimed.includes(i)) : [];
  return { state: { ...s, week, myShare: 0, claimed: [] }, payout };
}

/** Sunday 23:59:59 UTC of an ISO week key. */
export function weekEndOf(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = Date.UTC(y, 0, 4 - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
  return new Date(monday + 7 * 86_400_000 - 1000).toISOString();
}
