import { beforeEach, describe, expect, it } from 'vitest';
import { levelFor, WORLD_SIZE } from '../src/engine/levels';
import { adventureConfig } from '../src/engine/rules';
import { LEVELS_PER_WORLD, levelPayout, winPayout } from '../src/lib/progression';
import { useMetaStore, type RunSummary } from '../src/stores/useMetaStore';
import type { GameState } from '../src/types/game';

const finishedLevel = (overrides: Partial<GameState>): GameState => ({
  grid: new Array<number>(64).fill(0),
  tray: [null, null, null],
  trayIndex: 10,
  score: 900,
  combo: 0,
  sinceClear: 3,
  maxCombo: 2,
  lines: 6,
  bestMulti: 1,
  perfects: 0,
  placed: 40,
  cells: 60,
  gems: [],
  gemsCollected: 0,
  goal: null,
  over: true,
  won: false,
  ...overrides,
});

const runOf = (level: number, state: GameState): RunSummary => ({ cfg: adventureConfig(level), state, rescued: [3, 0, 0, 0, 0, 0, 2] });

describe('Adventure progress', () => {
  beforeEach(() => {
    useMetaStore.setState(useMetaStore.getInitialState());
  });

  it('starts every new player on Level 1', () => {
    expect(useMetaStore.getState().adventure.unlocked).toBe(1);
  });

  it('opens the next level when a level is cleared', () => {
    useMetaStore.getState().recordRun(runOf(1, finishedLevel({ won: true })));

    expect(useMetaStore.getState().adventure.unlocked).toBe(2);
  });

  it('keeps the same level waiting after a loss', () => {
    useMetaStore.getState().recordRun(runOf(1, finishedLevel({ won: false })));

    expect(useMetaStore.getState().adventure.unlocked).toBe(1);
  });

  it('never moves backwards when an earlier level is replayed', () => {
    useMetaStore.setState({ adventure: { unlocked: 5, stars: {} } });

    useMetaStore.getState().recordRun(runOf(2, finishedLevel({ won: true })));

    expect(useMetaStore.getState().adventure.unlocked).toBe(5);
  });

  it('pays a cleared level in whole chests of at least 50 coins, and a lost one less', () => {
    const won = useMetaStore.getState().recordRun(runOf(1, finishedLevel({ won: true })));
    const lost = useMetaStore.getState().recordRun(runOf(2, finishedLevel({ won: false })));

    expect((won.coinsEarned + won.adventure.coins) % 50).toBe(0);
    expect(won.coinsEarned + won.adventure.coins).toBeGreaterThanOrEqual(50);
    expect(lost.coinsEarned).toBeLessThan(50);
    expect(useMetaStore.getState().coins).toBe(won.coinsEarned + won.adventure.coins + lost.coinsEarned);
  });

  it('pays star coins only for stars not earned before', () => {
    const inPar = finishedLevel({ won: true, placed: levelFor(1).par });
    const first = useMetaStore.getState().recordRun(runOf(1, inPar));
    const again = useMetaStore.getState().recordRun(runOf(1, inPar));

    expect(first.adventure.stars).toBe(3);
    expect(first.adventure.newStars).toBe(3);
    expect(again.adventure.newStars).toBe(0);
    expect(again.adventure.coins).toBe(0);
  });

  it('sends the blobs cleared in a level to the Sanctuary, won or lost', () => {
    const outcome = useMetaStore.getState().recordRun(runOf(1, finishedLevel({ won: false })));

    expect(outcome.rescued).toBe(5);
    expect(useMetaStore.getState().sanctuary.rescued[0]).toBe(3);
    expect(useMetaStore.getState().sanctuary.rescued[6]).toBe(2);
  });
});

describe('Adventure payouts', () => {
  it('round a win up to the next 50, and never less than 50', () => {
    expect(winPayout(0)).toBe(50);
    expect(winPayout(50)).toBe(50);
    expect(winPayout(51)).toBe(100);
  });

  it('pay 50 a star, plus 50 for each world past the first', () => {
    expect(LEVELS_PER_WORLD).toBe(WORLD_SIZE);
    expect(levelPayout(1, 1)).toBe(50);
    expect(levelPayout(11, 2)).toBe(150);
  });
});
