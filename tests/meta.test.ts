import { beforeEach, describe, expect, it } from 'vitest';
import { TROPHIES } from '../src/lib/achievements';
import { effectiveConsent, emptyAdLedger, interstitialDue, rewardedLeft } from '../src/lib/ads';
import { challengesFor, weeklyFor } from '../src/lib/challenges';
import { COIN_PRICE, COSMETICS, cosmeticById, DEFAULT_LOADOUT, STARTER_ITEMS } from '../src/lib/cosmetics';
import { cratePool, emptyCrate, liveOdds, ODDS, openCrate, PITY_EPIC, PITY_LEGENDARY } from '../src/lib/crates';
import { crewFromCode, directory, emptyCrew, inviteCode, mirrored, MILESTONES, rolloverCrew } from '../src/lib/crews';
import { addDays } from '../src/lib/dates';
import { assertSpendAllowed, HARD_CAP_CENTS, HumaneCapError } from '../src/lib/economy';
import { coinMultiplier, eventsOn, icsCalendar, upcoming } from '../src/lib/events';
import { BOX_CAP, boxCoins, CALENDAR, openCalendar } from '../src/lib/gifts';
import { emptyLeague, LEAGUE_SIZE, PROMOTE_TOP, rankIn, rollover, settle, table } from '../src/lib/leagues';
import { applyRemote, LIVE_DEFAULTS } from '../src/lib/liveConfig';
import { PASS_TIERS, seasonOf, tierFromXp, TIERS as PASS, unclaimed, XP_PER_TIER } from '../src/lib/pass';
import { LEVELS_PER_WORLD, levelFromXp, levelPayout, MAX_RUN_XP, UNLOCKS, winPayout, xpForRun } from '../src/lib/progression';
import { WORLD_SIZE } from '../src/engine/levels';
import { applyRun, emptyRank, parFor, rankOf, rankSeason, rolloverRank, RP_PER_DIVISION, seasonReward, softReset, tierFloor, TIERS } from '../src/lib/ranks';
import { DAILY_SLOTS, dailyFor, FEATURED_SLOTS, featuredFor, nextInShop, SHOP_POOL } from '../src/lib/shop';
import { emptyStreak, recordDay } from '../src/lib/streak';
import { useEconomyStore } from '../src/stores/useEconomyStore';
import { useMetaStore, type RunSummary } from '../src/stores/useMetaStore';
import type { GameState } from '../src/types/game';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const WEEK = 7 * 86_400_000;

describe('cosmetics', () => {
  it('every id referenced by the pass, trophies, crews, events and ranks exists', () => {
    const refs = [
      ...PASS.flatMap((t) => [t.free, t.gold]).flatMap((r) => (r && r.kind === 'cosmetic' ? [r.id] : [])),
      ...TROPHIES.flatMap((t) => (t.cosmetic ? [t.cosmetic] : [])),
      ...MILESTONES.flatMap((m) => ('cosmetic' in m ? [m.cosmetic] : [])),
      ...upcoming('2026-01-01', 366).flatMap((e) => [...(e.rewards ?? []), ...(e.theme ? [e.theme] : [])]),
      ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((t) => seasonReward(t).cosmetic ?? []),
      ...Object.values(DEFAULT_LOADOUT),
    ];
    for (const id of refs) expect(cosmeticById(id), id).toBeDefined();
  });

  it('ids are unique, the starter set covers every slot, and each slot item has its look data', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    expect(new Set(STARTER_ITEMS.map((id) => cosmeticById(id)!.slot)).size).toBe(4);
    for (const c of COSMETICS) {
      if (c.slot === 'skin') expect(c.palette).toHaveLength(7);
      if (c.slot === 'theme') expect(c.board).toBeDefined();
      if (c.slot === 'burst') expect(c.burst).toBeDefined();
    }
  });
});

describe('ranks', () => {
  it('climbs Bronze III → Legend in 100 RP divisions', () => {
    expect(rankOf(0).label).toBe('Bronze III');
    expect(rankOf(100).label).toBe('Bronze II');
    expect(rankOf(299).label).toBe('Bronze I');
    expect(rankOf(300).label).toBe('Silver III');
    expect(rankOf(21 * RP_PER_DIVISION).tier).toBe(TIERS.length - 1);
    expect(rankOf(21 * RP_PER_DIVISION + 40).label).toBe('Legend · 40 RP');
  });

  it('par rises with every division, so the ladder measures skill', () => {
    for (let s = 1; s < 22; s++) expect(parFor(s)).toBeGreaterThan(parFor(s - 1));
  });

  it('scores against par, and a tier you reached is a floor', () => {
    expect(applyRun(0, parFor(0) * 2).delta).toBe(35);
    expect(applyRun(0, parFor(0)).delta).toBe(25);
    expect(applyRun(0, parFor(0) / 2).delta).toBe(10);
    expect(applyRun(0, 0).rp).toBe(0);
    expect(applyRun(350, 0).rp).toBe(340);
    expect(applyRun(tierFloor(1), 0).rp).toBe(tierFloor(1));
  });

  it('a season ends with a reward for the best tier and a one-tier soft reset', () => {
    const s0 = rankSeason(NOW);
    const s = { ...emptyRank(NOW), rp: 760, peak: 820 };
    expect(rolloverRank(s, NOW).result).toBeNull();
    const r = rolloverRank(s, s0.end + 1000);
    expect(r.result).toMatchObject({ peakTier: 2, coins: seasonReward(2).coins, cosmetic: 'rank-gold' });
    expect(r.state.rp).toBe(softReset(760));
    expect(rankOf(r.state.rp).tier).toBe(1);
    // A season with no ranked games changes nothing.
    expect(rolloverRank(emptyRank(NOW), s0.end + 1000).result).toBeNull();
  });
});

describe('leagues', () => {
  it('has 30 seats, 29 labelled bots, deterministic per week', () => {
    const t = table(2, '2026-W43', 500, NOW);
    expect(t).toHaveLength(LEAGUE_SIZE);
    expect(t.filter((r) => r.bot)).toHaveLength(LEAGUE_SIZE - 1);
    expect(table(2, '2026-W43', 500, NOW)).toEqual(t);
    // Bot pace never reacts to your XP.
    const bots = (x: number) => table(2, '2026-W43', x, NOW).filter((r) => r.bot).map((r) => r.xp).sort();
    expect(bots(0)).toEqual(bots(5000));
  });

  it('promotes the top 7, never relegates, and a week off changes nothing', () => {
    expect(settle(3, 1)).toBe(4);
    expect(settle(3, PROMOTE_TOP + 1)).toBe(3);
    expect(settle(3, 30)).toBe(3);
    const idle = rollover({ ...emptyLeague(NOW), tier: 4 }, NOW + WEEK);
    expect(idle.result).toBeNull();
    expect(idle.state.tier).toBe(4);
    const big = rollover({ ...emptyLeague(NOW), weeklyXp: 99999 }, NOW + WEEK);
    expect(big.result).toMatchObject({ rank: 1, promoted: true });
    expect(rankIn(table(0, '2026-W43', 99999, NOW))).toBe(1);
  });
});

describe('Blast Pass', () => {
  it('tiers come from XP and cap at 30; the Gold track is cosmetic only', () => {
    expect(tierFromXp(XP_PER_TIER * 3 + 5)).toBe(3);
    expect(tierFromXp(1e9)).toBe(PASS_TIERS);
    for (const t of PASS) if (t.gold) expect(t.gold.kind).toBe('cosmetic');
  });

  it('is tuned: most-days players finish, casual players get a good way in', () => {
    // An engaged day is ~5 games of ~25 lines (85 XP each); a casual day is 2 games, 4 days a week.
    const engaged = 28 * 5 * xpForRun(25, 'classic', false, false);
    const casual = 16 * 2 * xpForRun(25, 'classic', false, false);
    expect(tierFromXp(engaged)).toBe(PASS_TIERS);
    expect(tierFromXp(casual)).toBeGreaterThanOrEqual(10);
    expect(tierFromXp(casual)).toBeLessThan(PASS_TIERS);
  });

  it('nothing expires: old seasons stay claimable', () => {
    const now = seasonOf(NOW + 60 * 86_400_000);
    expect(now.id).not.toBe('s1');
    const pass = { xp: { s1: XP_PER_TIER * 2, [now.id]: XP_PER_TIER }, gold: ['s1'], claimed: [] };
    const u = unclaimed(pass);
    expect(u.filter((x) => x.seasonId === 's1' && x.track === 'free')).toHaveLength(2);
    expect(u.filter((x) => x.seasonId === 's1' && x.track === 'gold').length).toBe(PASS.slice(0, 2).filter((t) => t.gold).length);
    expect(u.filter((x) => x.seasonId === now.id)).toHaveLength(1);
  });
});

describe('Item Shop', () => {
  it('rotates deterministically with 2 featured and 4 daily items, never the same item twice in a day', () => {
    for (let i = 0; i < 30; i++) {
      const d = addDays('2026-10-01', i);
      const all = [...featuredFor(d), ...dailyFor(d)];
      expect(featuredFor(d)).toHaveLength(FEATURED_SLOTS);
      expect(dailyFor(d)).toHaveLength(DAILY_SLOTS);
      expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
      expect(dailyFor(d)).toEqual(dailyFor(d));
    }
  });

  it('featured items change on Mondays only', () => {
    expect(featuredFor('2026-10-26')).toEqual(featuredFor('2026-11-01'));
    expect(featuredFor('2026-10-25')).not.toEqual(featuredFor('2026-10-26'));
  });

  it('every shop item comes back within 3 weeks, and says when', () => {
    for (const c of SHOP_POOL) {
      const next = nextInShop(c.id, '2026-10-25');
      expect(next, c.id).not.toBeNull();
      expect(Date.parse(next!) - Date.parse('2026-10-25')).toBeLessThanOrEqual(21 * 86_400_000);
    }
    expect(nextInShop('gold', '2026-10-25')).toBeNull();
  });
});

describe('Mystery Crate', () => {
  it('publishes odds that sum to 1 and redistributes finished rarities', () => {
    expect(Object.values(ODDS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    const commons = cratePool().filter((c) => c.rarity === 'common').map((c) => c.id);
    const o = liveOdds(commons);
    expect(o.common).toBeUndefined();
    expect(Object.values(o).reduce((a, b) => a + b!, 0)).toBeCloseTo(1);
  });

  it('never gives a duplicate, finishes the set, then stops', () => {
    let owned: string[] = [];
    let s = emptyCrate();
    for (let i = 0; i < cratePool().length; i++) {
      const r = openCrate(owned, s, 'salt')!;
      expect(owned).not.toContain(r.item.id);
      owned = [...owned, r.item.id];
      s = r.state;
    }
    expect(openCrate(owned, s, 'salt')).toBeNull();
  });

  it('pity guarantees Epic+ within 10 and Legendary within 30', () => {
    let s = { opened: 0, sinceEpic: PITY_EPIC - 1, sinceLegendary: 0 };
    expect(['epic', 'legendary']).toContain(openCrate([], s, 'p')!.item.rarity);
    s = { opened: 0, sinceEpic: 0, sinceLegendary: PITY_LEGENDARY - 1 };
    const r = openCrate([], s, 'p')!;
    expect(r.item.rarity).toBe('legendary');
    expect(r.pity).toBe(true);
  });

  it('a crate is fixed by salt and number, so reloading never rerolls it', () => {
    expect(openCrate([], emptyCrate(), 'abc')).toEqual(openCrate([], emptyCrate(), 'abc'));
  });
});

describe('crews', () => {
  it('mirrors 20% of XP, labels practice members, and invite codes round-trip', () => {
    expect(mirrored(100)).toBe(20);
    const d = directory();
    for (const c of d) for (const m of c.members) expect(m.bot).toBe(true);
    expect(crewFromCode(inviteCode(d[3].id)).id).toBe(d[3].id);
  });

  it('pays out reached-but-unclaimed milestones when the week turns over', () => {
    const crew = directory()[0];
    const s = { ...emptyCrew(NOW), crew, myShare: 5000 };
    const r = rolloverCrew(s, NOW + WEEK);
    expect(r.payout).toEqual([0, 1, 2]);
    expect(r.state.myShare).toBe(0);
  });
});

describe('daily habits', () => {
  it('streak: total days never go down; rest days cover gaps', () => {
    let s = emptyStreak();
    s = recordDay(s, '2026-10-01');
    s = recordDay(s, '2026-10-03');
    expect(s).toMatchObject({ totalDays: 2, current: 2, restDays: 0 });
    s = recordDay(s, '2026-10-09');
    expect(s).toMatchObject({ totalDays: 3, current: 1, best: 2 });
  });

  it('challenges: three distinct stats per day, the same for everyone', () => {
    const c = challengesFor('2026-10-25');
    expect(new Set(c.map((x) => x.stat)).size).toBe(3);
    expect(challengesFor('2026-10-25')).toEqual(c);
    expect(weeklyFor('2026-W43')).toHaveLength(3);
  });

  it('gift calendar never resets on a gap; the box fills to a cap and waits', () => {
    const a = openCalendar({ step: 0, lastDay: null }, '2026-10-01')!;
    const b = openCalendar(a.state, '2026-10-20')!;
    expect(b.coins).toBe(CALENDAR[1]);
    expect(boxCoins(0, 100 * 3_600_000)).toBe(BOX_CAP);
  });
});

describe('events', () => {
  it('Weekend Coin Fest really doubles coins on Saturday and Sunday (UTC)', () => {
    expect(coinMultiplier('2026-10-24')).toBe(2);
    expect(coinMultiplier('2026-10-25')).toBe(2);
    expect(coinMultiplier('2026-10-26')).toBe(1);
    expect(eventsOn('2026-10-24').some((e) => e.id.startsWith('coinfest'))).toBe(true);
  });

  it('yearly seasons come back on the same dates and export to .ics', () => {
    expect(eventsOn('2026-12-20').some((e) => e.name === 'Frosty Fortnight')).toBe(true);
    expect(eventsOn('2027-12-20').some((e) => e.name === 'Frosty Fortnight')).toBe(true);
    expect(icsCalendar(2026)).toContain('BEGIN:VEVENT');
  });
});

describe('ads policy', () => {
  const cfg = LIVE_DEFAULTS;
  const ledger = { ...emptyAdLedger(), gamesSinceInterstitial: 5, lastInterstitial: 0 };

  it('no sponsor breaks for new players, then at most one every N games and M seconds', () => {
    expect(interstitialDue(ledger, cfg, { now: NOW, totalGames: cfg.newPlayerGraceGames - 1 })).toBe(false);
    expect(interstitialDue(ledger, cfg, { now: NOW, totalGames: 50 })).toBe(true);
    expect(interstitialDue({ ...ledger, gamesSinceInterstitial: cfg.interstitialEveryGames - 1 }, cfg, { now: NOW, totalGames: 50 })).toBe(false);
    expect(interstitialDue({ ...ledger, lastInterstitial: NOW - 1000 }, cfg, { now: NOW, totalGames: 50 })).toBe(false);
    expect(interstitialDue({ ...ledger, removed: true }, cfg, { now: NOW, totalGames: 50 })).toBe(false);
  });

  it('rewarded breaks are capped per day; personalised ads need a yes and age 16+', () => {
    expect(rewardedLeft({ ...ledger, rewarded: { day: '2026-10-25', count: cfg.rewardedDailyCap } }, cfg, '2026-10-25')).toBe(0);
    expect(rewardedLeft({ ...ledger, rewarded: { day: '2026-10-24', count: 3 } }, cfg, '2026-10-25')).toBe(cfg.rewardedDailyCap);
    expect(effectiveConsent({ ...ledger, consent: 'personalised' }, 15)).toBe('contextual');
    expect(effectiveConsent({ ...ledger, consent: 'personalised' }, null)).toBe('contextual');
    expect(effectiveConsent({ ...ledger, consent: 'personalised' }, 30)).toBe('personalised');
  });

  it('remote config is clamped, and fairness knobs cannot be tuned remotely', () => {
    const c = applyRemote(LIVE_DEFAULTS, { interstitialEveryGames: 1, rewardedCoins: 999, crateOdds: 0.9, prices: 1 });
    expect(c.interstitialEveryGames).toBe(2);
    expect(c.rewardedCoins).toBe(30);
    expect(c).not.toHaveProperty('crateOdds');
    expect(c).not.toHaveProperty('prices');
  });
});

describe('spending guardrails', () => {
  it('enforces the $50 hard cap per month and over any 30 days', () => {
    const now = Date.parse('2026-10-31T12:00:00Z');
    const big = [{ itemId: 'x', priceCents: 4900, at: now - 86_400_000, month: '2026-10' }];
    expect(() => assertSpendAllowed(big, '2026-11', HARD_CAP_CENTS, 199, now + 86_400_000)).toThrow(HumaneCapError);
    expect(() => assertSpendAllowed([], '2026-10', 1000, 1099, now)).toThrow(/limit/);
  });

  it('the store blocks under-16s and records nothing', () => {
    useEconomyStore.getState().setBirthYear(new Date().getUTCFullYear() - 12);
    expect(() => useEconomyStore.getState().purchase('gold:s1', 299)).toThrow(/under 16/);
    expect(useEconomyStore.getState().purchases).toHaveLength(0);
  });
});

describe('progression', () => {
  it('levels follow the curve and the ladder opens one step at a time', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(80).level).toBe(2);
    expect(Math.min(...Object.values(UNLOCKS))).toBe(2);
    expect(xpForRun(1000, 'classic', false, false)).toBe(MAX_RUN_XP);
  });
});

describe('the meta store', () => {
  beforeEach(() => {
    const init = useMetaStore.getInitialState();
    useMetaStore.setState({ ...init, owned: [...init.owned], crew: emptyCrew(), league: emptyLeague(), rank: emptyRank(), streak: emptyStreak() });
  });

  const game = (over: Partial<GameState> = {}): GameState => ({
    grid: new Array(64).fill(0),
    tray: [null, null, null],
    trayIndex: 10,
    score: 5000,
    combo: 0,
    sinceClear: 3,
    maxCombo: 4,
    lines: 20,
    bestMulti: 2,
    perfects: 1,
    placed: 30,
    cells: 100,
    gems: [],
    gemsCollected: 0,
    goal: null,
    over: true,
    won: false,
    ...over,
  });
  const summary = (g: GameState, mode: RunSummary['mode'] = 'classic', day: string | null = null, hinted = false): RunSummary => ({ cfg: { mode: mode === 'archive' ? 'daily' : mode, seed: 'x', level: g.goal ? 1 : undefined }, mode, day, state: g, log: [], hinted, timeMs: 60_000 });

  it('a game pays XP into the level, league week, pass and (mirrored) crew', async () => {
    useMetaStore.getState().joinCrew(directory()[0]);
    const o = await useMetaStore.getState().recordRun(summary(game()));
    const s = useMetaStore.getState();
    expect(o.xp).toBe(xpForRun(20, 'classic', false, false));
    expect(s.league.weeklyXp).toBe(o.xp);
    expect(s.crew.myShare).toBe(mirrored(o.xp));
    expect(s.best).toBe(5000);
    expect(o.rank?.counted).toBe(true);
    expect(s.rank.rp).toBeGreaterThan(0);
  });

  it('games with hints are labelled and never count for ranks', async () => {
    const o = await useMetaStore.getState().recordRun(summary(game({ score: 999999 }), 'classic', null, true));
    expect(o.rank).toMatchObject({ counted: false, delta: 0 });
    expect(useMetaStore.getState().rank.rp).toBe(0);
  });

  it("only today's Daily Board counts toward the streak", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await useMetaStore.getState().recordRun(summary(game(), 'archive', '2026-01-01'));
    expect(useMetaStore.getState().streak.totalDays).toBe(0);
    await useMetaStore.getState().recordRun(summary(game(), 'daily', today));
    expect(useMetaStore.getState().streak.totalDays).toBe(1);
    expect(useMetaStore.getState().daily[today].score).toBe(5000);
  });

  it('shop items can only be bought while in the shop; crate items any time at their fixed price', () => {
    const day = '2026-10-25';
    const inShop = dailyFor(day)[0];
    const notInShop = SHOP_POOL.find((c) => ![...featuredFor(day), ...dailyFor(day)].some((x) => x.id === c.id))!;
    useMetaStore.setState({ coins: 10_000 });
    expect(useMetaStore.getState().buyCosmetic(notInShop.id, day)).toBe(false);
    expect(useMetaStore.getState().buyCosmetic(inShop.id, day)).toBe(true);
    expect(useMetaStore.getState().coins).toBe(10_000 - COIN_PRICE[inShop.rarity]);
    expect(useMetaStore.getState().buyCosmetic('dragon', day)).toBe(true);
    expect(useMetaStore.getState().buyCosmetic('dragon', day)).toBe(false);
  });

  it('equip only works for owned items in the right slot', () => {
    const st = useMetaStore.getState();
    st.equip('skin', 'gold');
    expect(useMetaStore.getState().loadout.skin).toBe('classic');
    st.grantCosmetic('gold');
    st.equip('theme', 'gold');
    expect(useMetaStore.getState().loadout.theme).toBe('midnight');
    st.equip('skin', 'gold');
    expect(useMetaStore.getState().loadout.skin).toBe('gold');
  });

  it('opt-ins start off', () => {
    const fresh = useMetaStore.getInitialState().settings;
    expect(fresh.haptics).toBe(false);
    expect(fresh.hints).toBe(false);
    expect(fresh.appBadge).toBe(false);
    expect(useMetaStore.getInitialState().notify.prefs.enabled).toBe(false);
  });
});

describe('won rounds pay out in whole chests', () => {
  beforeEach(() => {
    const init = useMetaStore.getInitialState();
    useMetaStore.setState({ ...init, owned: [...init.owned], crew: emptyCrew(), league: emptyLeague(), rank: emptyRank(), streak: emptyStreak() });
  });

  it('rounds up to the next 50, and never less than 50', () => {
    expect(winPayout(0)).toBe(50);
    expect(winPayout(2)).toBe(50);
    expect(winPayout(50)).toBe(50);
    expect(winPayout(51)).toBe(100);
    expect(winPayout(149)).toBe(150);
  });

  it('a new best is topped up in the wallet and in the outcome; an ordinary game is not', async () => {
    const g = (score: number): GameState => ({ grid: new Array(64).fill(0), tray: [null, null, null], trayIndex: 10, score, combo: 0, sinceClear: 3, maxCombo: 1, lines: 6, bestMulti: 1, perfects: 0, placed: 20, cells: 60, gems: [], gemsCollected: 0, goal: null, over: true, won: false });
    const run = (score: number): RunSummary => ({ cfg: { mode: 'classic', seed: 'x' }, mode: 'classic', day: null, state: g(score), log: [], hinted: false, timeMs: 60_000 });
    const before = useMetaStore.getState().coins;
    const first = await useMetaStore.getState().recordRun(run(900));
    expect(first.newBest).toBe(true);
    expect(first.coinsEarned % 50).toBe(0);
    expect(first.coinsEarned).toBeGreaterThanOrEqual(50);
    const afterFirst = useMetaStore.getState().coins;
    expect(afterFirst - before).toBeGreaterThanOrEqual(first.coinsEarned);
    const second = await useMetaStore.getState().recordRun(run(100));
    expect(second.newBest).toBe(false);
    expect(second.coinsEarned).toBeLessThan(50);
  });
});

describe('adventure payouts', () => {
  it('pay 50 a star, plus 50 for each world past the first', () => {
    expect(LEVELS_PER_WORLD).toBe(WORLD_SIZE);
    expect(levelPayout(1, 1)).toBe(50);
    expect(levelPayout(4, 3)).toBe(150);
    expect(levelPayout(11, 2)).toBe(150);
    expect(levelPayout(25, 3)).toBe(250);
  });
});
