/**
 * Progression, Daily Board, streak, Adventure, ranks, leagues, crew, challenges, gifts, collection, pass,
 * trophies, notifications and settings.
 */
import type { ScenePick } from '../lib/scenery';
import { build, collect, emptySanctuary, LOG_STEPS, logReady, rescue, type BuildingId, type SanctuaryState } from '../lib/sanctuary';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { levelFor, starsFor } from '../engine/levels';
import { encodeLog, hashLog } from '../engine/RunLog';
import { earned, TROPHIES, type TrophyStats } from '../lib/achievements';
import { ALL_CLEAR_COINS, challengesFor, MAX_STATS, progressFor, weeklyFor, weeklyProgressFor, type ChallengeProgress, type ChallengeStat, type WeeklyProgress, type WeeklyStat } from '../lib/challenges';
import { COIN_PRICE, cosmeticById, DEFAULT_LOADOUT, STARTER_ITEMS, type Slot } from '../lib/cosmetics';
import { CRATE_COST, emptyCrate, openCrate as rollCrate, type CrateState } from '../lib/crates';
import { botChat, CREW_GIFT_COINS, crewFromCode, createCrew as makeCrew, emptyCrew, mirrored, MILESTONES, poolTotal, reachedMilestones, rolloverCrew, type Crew, type CrewState } from '../lib/crews';
import { addDays, daysBetween, isoWeek, utcDateKey } from '../lib/dates';
import { coinMultiplier, crewGiftMultiplier, eventsOn } from '../lib/events';
import { boxCoins, openCalendar as openCal, WELCOME_BACK_COINS, welcomeBackDue, type CalendarState } from '../lib/gifts';
import { emptyLeague, rankIn, rollover, table, type LeagueState } from '../lib/leagues';
import { defaultPrefs, emptyLog, markOpened, markSent, type NotifyLog, type NotifyPrefs, type PlannedNotification } from '../lib/notify';
import { claimKey, emptyPass, seasonOf, tierFromXp, TIERS, type PassReward, type PassState } from '../lib/pass';
import { coinsForRun, LEVEL_UP_COINS, levelFromXp, newlyUnlocked, STAR_COINS, levelPayout, winPayout, xpForRun, type Feature, type RunMode } from '../lib/progression';
import { applyRun, emptyRank, rankOf, rolloverRank, type RankState } from '../lib/ranks';
import { inShop, priceOf } from '../lib/shop';
import { persistStorage } from '../lib/storage';
import { emptyStreak, MAX_VACATION_DAYS, recordDay, type StreakData, type Vacation } from '../lib/streak';
import type { GameState, Move, RunConfig } from '../types/game';

export interface Settings {
  muted: boolean;
  masterVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  /** Opt-in: starts off. */
  haptics: boolean;
  /** Labelled assist: a 💡 button that shows Burst Bot's move. Games that use it say so, and don't count for ranks. */
  hints: boolean;
  /** Show which lines a piece would clear while you drag it. */
  clearPreview: boolean;
  /** 'cozy' (pastel bodies with googly eyes, the default) or 'classic' (the original glossy blocks). */
  look?: 'cozy' | 'classic';
  /** Cozy scenery: 'journey' (a new place every few thousand points; worlds and days pick their own) or one scene. */
  scenery?: ScenePick;
  /** Background music (synthesised, like every sound); on unless switched off. */
  music?: boolean;
  musicVolume?: number;
  /** Opt-in break reminder on the end-of-game screen, in minutes (0 = off). */
  breakMinutes: number;
  /** Opt-in count of real claimables on the app icon. */
  appBadge: boolean;
}

export interface DailyResult {
  score: number;
  lines: number;
  maxCombo: number;
  bestMulti: number;
  perfects: number;
  log: string;
  hash: string;
  hinted: boolean;
}

export interface RunRecord {
  at: number;
  mode: RunMode;
  score: number;
  lines: number;
  level?: number;
  won?: boolean;
}

/** What the game hands the store when a run ends. */
export interface RunSummary {
  cfg: RunConfig;
  mode: RunMode;
  day: string | null;
  state: GameState;
  log: Move[];
  hinted: boolean;
  timeMs: number;
  /** Blobs rescued (cells cleared) per species this game. */
  rescued?: number[];
}

export interface RunOutcome {
  xp: number;
  coinsEarned: number;
  coinMultiplier: number;
  levelBefore: number;
  levelAfter: number;
  newBest: boolean;
  prevBest: number;
  leagueRankBefore: number;
  leagueRankAfter: number;
  crewShare: number;
  firstDailyToday: boolean;
  challengesDone: string[];
  trophies: string[];
  eventRewards: string[];
  passTierBefore: number;
  passTierAfter: number;
  rank: { before: number; after: number; delta: number; counted: boolean } | null;
  adventure: { level: number; won: boolean; stars: number; newStars: number; coins: number } | null;
  /** Blobs sent to the Sanctuary this game. */
  rescued: number;
}

export interface Notice {
  id: string;
  text: string;
}

interface MetaState {
  name: string;
  /** Random per-install salt for the Mystery Crate, so each player's crates are their own but never rerollable. */
  salt: string;
  firstSeen: number;
  xp: number;
  coins: number;
  best: number;
  runCounter: number;
  owned: string[];
  loadout: Record<Slot, string>;
  crate: CrateState;
  streak: StreakData;
  vacations: Vacation[];
  daily: Record<string, DailyResult>;
  dailyRuns: Record<string, number>;
  adventure: { unlocked: number; stars: Record<number, number> };
  challenges: ChallengeProgress;
  weekly: WeeklyProgress;
  calendar: CalendarState;
  boxLast: number;
  league: LeagueState;
  rank: RankState;
  crew: CrewState;
  totals: { games: number; lines: number; score: number; pieces: number; perfects: number; gems: number; adventureWins: number; maxCombo: number; bestMulti: number };
  trophies: string[];
  pass: PassState;
  lastSeenDay: string | null;
  welcomeBack: boolean;
  unlockSeen: Feature[];
  notify: { prefs: NotifyPrefs; log: NotifyLog };
  history: RunRecord[];
  notices: Notice[];
  settings: Settings;
  sanctuary: SanctuaryState;

  recordRun(r: RunSummary): Promise<RunOutcome>;
  /** Sanctuary: empty the rain tank into the droplet bank. */
  collectDroplets(): number;
  buildSanctuary(id: BuildingId): boolean;
  /** Pays every Species Log step reached; returns the coins paid. */
  claimSpeciesLog(): number;
  syncWeek(now?: number): void;
  /** Called when the app opens: welcome-back gift, notification bookkeeping. */
  touch(now?: number): void;
  dismissNotice(id: string): void;
  addCoins(n: number): void;
  claimChallenge(id: string): boolean;
  claimAllClear(): boolean;
  claimWeekly(id: string): boolean;
  openCalendar(): number | null;
  collectBox(now?: number): number;
  claimWelcomeBack(): number;
  openCrate(): { id: string; pity: boolean } | null;
  /** Buy a shop item (only while it's in today's shop) or a crate item outright, for coins. */
  buyCosmetic(id: string, day?: string): boolean;
  grantCosmetic(id: string): void;
  equip(slot: Slot, id: string): void;
  joinCrew(c: Crew): void;
  joinByCode(code: string): Crew;
  createCrew(name: string, emblem: string, motto: string): void;
  leaveCrew(): void;
  postPhrase(phrase: number): void;
  claimMilestone(i: number): boolean;
  shareCrewGift(): boolean;
  claimPass(seasonId: string, tier: number, track: 'free' | 'gold'): PassReward | null;
  grantGold(seasonId: string): void;
  startVacation(days: number): void;
  endVacation(): void;
  setNotifyPrefs(patch: Partial<NotifyPrefs>): void;
  notifySent(n: PlannedNotification): void;
  seeUnlock(f: Feature): void;
  setName(name: string): void;
  updateSettings(patch: Partial<Settings>): void;
}

const freshChallenges = (day: string): ChallengeProgress => ({ day, progress: {}, claimed: [], allClear: false });

const randomSalt = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 18);

export const adventureStars = (a: MetaState['adventure']) => Object.values(a.stars).reduce((x, y) => x + y, 0);

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => {
      /** XP goes to your level, your league week, the Blast Pass and (mirrored, never deducted) your crew's pool. */
      function addXp(n: number): void {
        const s = get();
        const before = levelFromXp(s.xp).level;
        const after = levelFromXp(s.xp + n).level;
        const season = seasonOf().id;
        set({
          xp: s.xp + n,
          league: { ...s.league, weeklyXp: s.league.weeklyXp + n },
          crew: s.crew.crew ? { ...s.crew, myShare: s.crew.myShare + mirrored(n) } : s.crew,
          pass: { ...s.pass, xp: { ...s.pass.xp, [season]: (s.pass.xp[season] ?? 0) + n } },
          coins: s.coins + (after - before) * LEVEL_UP_COINS,
        });
      }

      function bump(stat: ChallengeStat, n: number): void {
        const today = utcDateKey();
        const c = progressFor(get().challenges, today);
        const prev = c.progress[stat] ?? 0;
        const next = MAX_STATS.includes(stat) ? Math.max(prev, n) : prev + n;
        set({ challenges: { ...c, progress: { ...c.progress, [stat]: next } } });
      }

      function bumpWeekly(stat: WeeklyStat, n: number): void {
        const w = weeklyProgressFor(get().weekly, isoWeek(Date.now()));
        set({ weekly: { ...w, progress: { ...w.progress, [stat]: (w.progress[stat] ?? 0) + n } } });
      }

      function trophyStats(): TrophyStats {
        const s = get();
        return {
          best: Math.max(s.best, ...Object.values(s.daily).map((d) => d.score)),
          runs: s.totals.games,
          lines: s.totals.lines,
          maxCombo: s.totals.maxCombo,
          bestMulti: s.totals.bestMulti,
          perfects: s.totals.perfects,
          gems: s.totals.gems,
          adventureStars: adventureStars(s.adventure),
          adventureLevel: s.adventure.unlocked,
          daysPlayed: s.streak.totalDays,
          collection: s.owned.length,
          inCrew: !!s.crew.crew,
          rankTier: rankOf(s.rank.peak).tier,
        };
      }

      /** Award any newly earned trophies (coins and cosmetics) and return their ids. */
      function checkTrophies(): string[] {
        const s = get();
        const fresh = earned(trophyStats()).filter((id) => !s.trophies.includes(id));
        if (!fresh.length) return [];
        let coins = 0;
        for (const id of fresh) {
          const t = TROPHIES.find((x) => x.id === id)!;
          coins += t.coins;
          if (t.cosmetic) get().grantCosmetic(t.cosmetic);
        }
        set({ trophies: [...get().trophies, ...fresh], coins: get().coins + coins });
        return fresh;
      }

      function grantReward(r: PassReward): void {
        if (r.kind === 'coins') get().addCoins(r.amount);
        else get().grantCosmetic(r.id);
      }

      return {
        name: 'You',
        salt: randomSalt(),
        firstSeen: Date.now(),
        xp: 0,
        coins: 0,
        best: 0,
        runCounter: 0,
        owned: [...STARTER_ITEMS],
        loadout: { ...DEFAULT_LOADOUT },
        crate: emptyCrate(),
        streak: emptyStreak(),
        vacations: [],
        daily: {},
        dailyRuns: {},
        adventure: { unlocked: 1, stars: {} },
        challenges: freshChallenges(utcDateKey()),
        weekly: { week: isoWeek(Date.now()), progress: {}, claimed: [] },
        calendar: { step: 0, lastDay: null },
        boxLast: Date.now(),
        league: emptyLeague(),
        rank: emptyRank(),
        crew: emptyCrew(),
        totals: { games: 0, lines: 0, score: 0, pieces: 0, perfects: 0, gems: 0, adventureWins: 0, maxCombo: 0, bestMulti: 0 },
        trophies: [],
        pass: emptyPass(),
        lastSeenDay: null,
        welcomeBack: false,
        unlockSeen: [],
        notify: { prefs: defaultPrefs(), log: emptyLog() },
        history: [],
        notices: [],
        settings: { muted: false, masterVolume: 0.8, sfxVolume: 0.9, reducedMotion: false, haptics: false, hints: false, clearPreview: true, look: 'cozy', breakMinutes: 0, appBadge: false },
        sanctuary: emptySanctuary(),

        recordRun: async ({ cfg, mode, day, state: g, log, hinted, rescued }) => {
          get().syncWeek();
          const s = get();
          const today = utcDateKey();
          const levelBefore = levelFromXp(s.xp).level;
          const leagueRankBefore = rankIn(table(s.league.tier, s.league.week, s.league.weeklyXp, Date.now(), s.name));
          const firstDailyToday = mode === 'daily' && day === today && !s.dailyRuns[today];
          const xp = xpForRun(g.lines, mode, firstDailyToday, g.won);
          const prevBest = mode === 'classic' ? s.best : (mode === 'daily' || mode === 'archive') && day ? (s.daily[day]?.score ?? 0) : 0;
          const newBest = mode !== 'adventure' && g.score > prevBest;
          // Weekend Coin Fest really doubles the coins a game pays out (never the score).
          const mult = coinMultiplier(today);
          const coinsEarned = coinsForRun(g.lines, g.perfects) * mult;
          const passTierBefore = tierFromXp(s.pass.xp[seasonOf().id] ?? 0);
          const t = s.totals;
          const patch: Partial<MetaState> = {
            coins: s.coins + coinsEarned,
            runCounter: s.runCounter + 1,
            totals: {
              games: t.games + 1,
              lines: t.lines + g.lines,
              score: t.score + g.score,
              pieces: t.pieces + g.placed,
              perfects: t.perfects + g.perfects,
              gems: t.gems + g.gemsCollected,
              adventureWins: t.adventureWins + (mode === 'adventure' && g.won ? 1 : 0),
              maxCombo: Math.max(t.maxCombo, g.maxCombo),
              bestMulti: Math.max(t.bestMulti, g.bestMulti),
            },
            history: [...s.history, { at: Date.now(), mode, score: g.score, lines: g.lines, level: cfg.level, won: g.won }].slice(-60),
            lastSeenDay: today,
            sanctuary: rescue(s.sanctuary, rescued ?? []),
          };
          if (mode === 'classic' && newBest) patch.best = g.score;

          // Ranks: Classic games without hints only.
          let rank: RunOutcome['rank'] = null;
          if (mode === 'classic') {
            if (hinted) rank = { before: s.rank.rp, after: s.rank.rp, delta: 0, counted: false };
            else {
              const r = applyRun(s.rank.rp, g.score);
              patch.rank = { ...s.rank, rp: r.rp, peak: Math.max(s.rank.peak, r.rp) };
              rank = { before: s.rank.rp, after: r.rp, delta: r.delta, counted: true };
            }
          }

          if ((mode === 'daily' || mode === 'archive') && day) {
            patch.dailyRuns = { ...s.dailyRuns, [day]: (s.dailyRuns[day] ?? 0) + 1 };
            if (newBest) {
              const hash = await hashLog(cfg, log);
              patch.daily = { ...s.daily, [day]: { score: g.score, lines: g.lines, maxCombo: g.maxCombo, bestMulti: g.bestMulti, perfects: g.perfects, log: encodeLog(log), hash, hinted } };
            }
            // Only today's board counts toward days played; the archive is practice.
            if (mode === 'daily' && day === today && g.placed > 0) patch.streak = recordDay(s.streak, today, s.vacations);
          }

          let adventure: RunOutcome['adventure'] = null;
          if (mode === 'adventure' && cfg.level) {
            const n = cfg.level;
            const had = s.adventure.stars[n] ?? 0;
            const stars = g.won ? starsFor(levelFor(n), g.placed) : 0;
            const newStars = Math.max(0, stars - had);
            const coins = newStars * STAR_COINS;
            patch.adventure = { unlocked: g.won ? Math.max(s.adventure.unlocked, n + 1) : s.adventure.unlocked, stars: { ...s.adventure.stars, [n]: Math.max(had, stars) } };
            patch.coins = (patch.coins ?? s.coins) + coins;
            adventure = { level: n, won: g.won, stars, newStars, coins };
          }
          // A won round pays out in whole chests (see winPayout): the game's coins are topped up to match.
          // An Adventure win pays by its stars and how far into the worlds it is (levelPayout), never less.
          const total = coinsEarned + (adventure?.coins ?? 0);
          const target = adventure?.won ? Math.max(levelPayout(adventure.level, adventure.stars) * mult, total) : total;
          const winBonus = adventure?.won || (mode !== 'adventure' && newBest) ? winPayout(target) - total : 0;
          if (winBonus > 0) patch.coins = (patch.coins ?? s.coins) + winBonus;

          set(patch);
          // Event cosmetics: one finished game during a yearly season earns them (they come back every year).
          const eventRewards = eventsOn(today)
            .flatMap((e) => e.rewards ?? [])
            .filter((id) => !get().owned.includes(id));
          for (const id of eventRewards) get().grantCosmetic(id);
          addXp(xp);
          const before = new Set(doneChallenges(get().challenges));
          bump('runs', 1);
          bump('lines', g.lines);
          bump('bestScore', g.score);
          bump('combo', g.maxCombo);
          bump('multi', g.bestMulti);
          bump('perfects', g.perfects);
          bump('pieces', g.placed);
          bump('gems', g.gemsCollected);
          if (mode === 'daily' && day === today) bump('daily', 1);
          if (mode === 'adventure' && g.won) bump('adventure', 1);
          bumpWeekly('runs', 1);
          bumpWeekly('lines', g.lines);
          bumpWeekly('score', g.score);
          bumpWeekly('perfects', g.perfects);
          if (mode === 'adventure' && g.won) bumpWeekly('adventure', 1);
          if (firstDailyToday) bumpWeekly('dailyDays', 1);
          const challengesDone = doneChallenges(get().challenges).filter((id) => !before.has(id));
          const trophies = checkTrophies();
          const f = get();
          return {
            xp,
            coinsEarned: coinsEarned + winBonus,
            coinMultiplier: mult,
            levelBefore,
            levelAfter: levelFromXp(f.xp).level,
            newBest,
            prevBest,
            leagueRankBefore,
            leagueRankAfter: rankIn(table(f.league.tier, f.league.week, f.league.weeklyXp, Date.now(), f.name)),
            crewShare: f.crew.crew ? mirrored(xp) : 0,
            firstDailyToday,
            challengesDone,
            trophies,
            eventRewards,
            passTierBefore,
            passTierAfter: tierFromXp(f.pass.xp[seasonOf().id] ?? 0),
            rank,
            adventure,
            rescued: (rescued ?? []).reduce((a, b) => a + b, 0),
          };
        },

        collectDroplets: () => {
          const r = collect(get().sanctuary);
          set({ sanctuary: r.state });
          return r.gained;
        },

        buildSanctuary: (id) => {
          const next = build(get().sanctuary, id);
          if (next) set({ sanctuary: next });
          return next !== null;
        },

        claimSpeciesLog: () => {
          const s = get().sanctuary;
          const ready = logReady(s);
          if (!ready.length) return 0;
          const coins = ready.reduce((sum, r) => sum + LOG_STEPS[r.step].coins, 0);
          set({ sanctuary: { ...s, logClaimed: [...s.logClaimed, ...ready.map((r) => `${r.species}:${r.step}`)] } });
          get().addCoins(coins);
          return coins;
        },

        syncWeek: (now = Date.now()) => {
          const s = get();
          const notices: Notice[] = [];
          let coins = 0;
          const l = rollover(s.league, now, s.name);
          if (l.result) {
            coins += l.result.coins;
            notices.push({ id: `league-${l.result.week}`, text: `Last week you finished #${l.result.rank} in your league${l.result.promoted ? ' and moved up!' : '.'} +🪙${l.result.coins}` });
          }
          const c = rolloverCrew(s.crew, now);
          for (const i of c.payout) {
            coins += MILESTONES[i].coins;
            if ('cosmetic' in MILESTONES[i]) get().grantCosmetic(MILESTONES[i].cosmetic);
          }
          if (c.payout.length) notices.push({ id: `crew-${s.crew.week}`, text: `Your crew's milestones from last week were paid out: ${c.payout.map((i) => MILESTONES[i].label).join(', ')}.` });
          const r = rolloverRank(s.rank, now);
          if (r.result) {
            coins += r.result.coins;
            if (r.result.cosmetic) get().grantCosmetic(r.result.cosmetic);
            notices.push({ id: `rank-${r.result.season}`, text: `Rank season over: your best was ${rankOf(s.rank.peak).label}. +🪙${r.result.coins}${r.result.cosmetic ? ` and ${cosmeticById(r.result.cosmetic)?.name}` : ''}.` });
          }
          if (l.state !== s.league || c.state !== s.crew || r.state !== s.rank || coins) set({ league: l.state, crew: c.state, rank: r.state, coins: get().coins + coins, notices: [...get().notices, ...notices].slice(-5) });
        },

        touch: (now = Date.now()) => {
          const s = get();
          const today = utcDateKey(new Date(now));
          const patch: Partial<MetaState> = { lastSeenDay: today, notify: { ...s.notify, log: markOpened(s.notify.log, new Date(now)) } };
          if (!s.welcomeBack && welcomeBackDue(s.lastSeenDay, today)) patch.welcomeBack = true;
          if (s.vacations.length) patch.vacations = s.vacations.filter((v) => v.end >= addDays(today, -60));
          set(patch);
          get().syncWeek(now);
          checkTrophies();
        },

        dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
        addCoins: (n) => set((s) => ({ coins: s.coins + n })),

        claimChallenge: (id) => {
          const today = utcDateKey();
          const c = get().challenges;
          if (c.day !== today || c.claimed.includes(id)) return false;
          const ch = challengesFor(today).find((x) => x.id === id);
          if (!ch || (c.progress[ch.stat] ?? 0) < ch.target) return false;
          set({ challenges: { ...c, claimed: [...c.claimed, id] }, coins: get().coins + ch.coins });
          return true;
        },

        claimAllClear: () => {
          const c = get().challenges;
          if (c.day !== utcDateKey() || c.allClear || c.claimed.length < 3) return false;
          set({ challenges: { ...c, allClear: true }, coins: get().coins + ALL_CLEAR_COINS });
          return true;
        },

        claimWeekly: (id) => {
          const week = isoWeek(Date.now());
          const w = weeklyProgressFor(get().weekly, week);
          const q = weeklyFor(week).find((x) => x.id === id);
          if (!q || w.claimed.includes(id) || (w.progress[q.stat] ?? 0) < q.target) return false;
          set({ weekly: { ...w, claimed: [...w.claimed, id] }, coins: get().coins + q.coins });
          return true;
        },

        openCalendar: () => {
          const r = openCal(get().calendar, utcDateKey());
          if (!r) return null;
          set({ calendar: r.state, coins: get().coins + r.coins });
          return r.coins;
        },

        collectBox: (now = Date.now()) => {
          const n = boxCoins(get().boxLast, now);
          if (n <= 0) return 0;
          set({ boxLast: now, coins: get().coins + n });
          return n;
        },

        claimWelcomeBack: () => {
          if (!get().welcomeBack) return 0;
          set((s) => ({ welcomeBack: false, coins: s.coins + WELCOME_BACK_COINS }));
          return WELCOME_BACK_COINS;
        },

        openCrate: () => {
          const s = get();
          if (s.coins < CRATE_COST) return null;
          const r = rollCrate(s.owned, s.crate, s.salt);
          if (!r) return null;
          set({ coins: s.coins - CRATE_COST, crate: r.state, owned: [...s.owned, r.item.id] });
          checkTrophies();
          return { id: r.item.id, pity: r.pity };
        },

        buyCosmetic: (id, day = utcDateKey()) => {
          const s = get();
          const c = cosmeticById(id);
          if (!c || s.owned.includes(id)) return false;
          const buyable = c.source === 'crate' || (c.source === 'shop' && inShop(id, day));
          const price = c.source === 'shop' ? priceOf(c) : COIN_PRICE[c.rarity];
          if (!buyable || s.coins < price) return false;
          set({ coins: s.coins - price, owned: [...s.owned, id] });
          checkTrophies();
          return true;
        },

        grantCosmetic: (id) => {
          if (cosmeticById(id) && !get().owned.includes(id)) set((s) => ({ owned: [...s.owned, id] }));
        },
        equip: (slot, id) => {
          const c = cosmeticById(id);
          if (c && c.slot === slot && get().owned.includes(id)) set((s) => ({ loadout: { ...s.loadout, [slot]: id } }));
        },

        joinCrew: (c) => {
          const s = get();
          set({ crew: { ...s.crew, crew: c, chat: [], claimed: [], past: [c, ...s.crew.past.filter((p) => p.id !== c.id)].slice(0, 5) } });
          checkTrophies();
        },
        joinByCode: (code) => {
          const c = crewFromCode(code);
          get().joinCrew(c);
          return c;
        },
        createCrew: (name, emblem, motto) => get().joinCrew(makeCrew(name, emblem, motto)),
        // Play solo: you keep everything you earned; nobody is told.
        leaveCrew: () => set((s) => ({ crew: { ...s.crew, crew: null, chat: [] } })),
        postPhrase: (phrase) => set((s) => ({ crew: { ...s.crew, chat: [...s.crew.chat, { id: `me-${Date.now()}`, from: s.name, bot: false, phrase, at: Date.now() }].slice(-30) } })),
        claimMilestone: (i) => {
          const s = get();
          const crew = s.crew.crew;
          if (!crew || s.crew.claimed.includes(i)) return false;
          if (!reachedMilestones(poolTotal(crew, s.crew.myShare), crew).includes(i)) return false;
          const m = MILESTONES[i];
          set({ crew: { ...s.crew, claimed: [...s.crew.claimed, i] }, coins: s.coins + m.coins });
          if ('cosmetic' in m) get().grantCosmetic(m.cosmetic);
          return true;
        },
        // The game pays every member, you included. Nothing is owed back, and nobody sees who didn't share.
        shareCrewGift: () => {
          const s = get();
          const today = utcDateKey();
          if (!s.crew.crew || s.crew.giftDay === today) return false;
          set({ crew: { ...s.crew, giftDay: today }, coins: s.coins + CREW_GIFT_COINS * crewGiftMultiplier(today) });
          return true;
        },

        claimPass: (seasonId, tier, track) => {
          const s = get();
          const key = claimKey(seasonId, tier, track);
          if (s.pass.claimed.includes(key) || tier > tierFromXp(s.pass.xp[seasonId] ?? 0)) return null;
          if (track === 'gold' && !s.pass.gold.includes(seasonId)) return null;
          const t = TIERS[tier - 1];
          const reward = track === 'free' ? t.free : t.gold;
          if (!reward) return null;
          set({ pass: { ...s.pass, claimed: [...s.pass.claimed, key] } });
          grantReward(reward);
          return reward;
        },
        grantGold: (seasonId) => set((s) => ({ pass: { ...s.pass, gold: s.pass.gold.includes(seasonId) ? s.pass.gold : [...s.pass.gold, seasonId] } })),

        startVacation: (days) => {
          const today = utcDateKey();
          const n = Math.max(1, Math.min(MAX_VACATION_DAYS, Math.round(days)));
          set((s) => ({ vacations: [...s.vacations.filter((v) => v.end < today), { start: today, end: addDays(today, n - 1) }] }));
        },
        endVacation: () => {
          const today = utcDateKey();
          set((s) => ({ vacations: s.vacations.map((v) => (v.end >= today ? { ...v, end: addDays(today, -1) } : v)).filter((v) => daysBetween(v.start, v.end) >= 0) }));
        },

        setNotifyPrefs: (patch) => set((s) => ({ notify: { ...s.notify, prefs: { ...s.notify.prefs, ...patch } } })),
        notifySent: (n) => set((s) => ({ notify: { ...s.notify, log: markSent(s.notify.log, n) } })),
        seeUnlock: (f) => set((s) => ({ unlockSeen: s.unlockSeen.includes(f) ? s.unlockSeen : [...s.unlockSeen, f] })),

        setName: (name) => set({ name: name.replace(/\s+/g, ' ').trim().slice(0, 16) || 'You' }),
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      };
    },
    {
      name: 'burst-meta',
      storage: persistStorage,
      version: 1,
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
);

function doneChallenges(c: ChallengeProgress): string[] {
  return challengesFor(c.day)
    .filter((ch) => (c.progress[ch.stat] ?? 0) >= ch.target)
    .map((ch) => ch.id);
}

/** Today's crew chat: practice members' lines for the day, plus what you posted. */
export function crewChat(state: CrewState): { id: string; from: string; bot: boolean; phrase: number; at: number }[] {
  if (!state.crew) return [];
  return [...botChat(state.crew), ...state.chat].sort((a, b) => a.at - b.at);
}

/** True while a vacation covers today. */
export const onVacationToday = (vacations: Vacation[], today = utcDateKey()) => vacations.some((v) => today >= v.start && today <= v.end);

/** Features unlocked but not yet celebrated. */
export const pendingUnlocks = (xp: number, seen: Feature[]) => newlyUnlocked(1, levelFromXp(xp).level).filter((f) => !seen.includes(f));
