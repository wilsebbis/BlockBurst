/** Adventure proofs: every level ships only after Burst Bot beats it with the real rules and generator. */
import { describe, expect, it } from 'vitest';
import { fullLines, masksOf } from '../src/engine/board';
import { playOut } from '../src/engine/bot';
import { levelFor, starsFor, worldOf, WORLD_SIZE, WORLDS } from '../src/engine/levels';
import { adventureConfig, initialState } from '../src/engine/rules';

const LEVELS = Array.from({ length: 60 }, (_, i) => i + 1);

describe('Adventure levels', () => {
  it('are built from the level number alone', () => {
    expect(levelFor(7)).toBe(levelFor(7));
    const a = JSON.stringify(levelFor(12));
    expect(a).toContain('burst/level/v1/12/');
  });

  it.each(LEVELS)('level %i is beatable: Burst Bot meets the goal within par', (n) => {
    const spec = levelFor(n);
    const cfg = adventureConfig(n);
    const start = initialState(cfg);
    expect(fullLines(masksOf(start.grid)).rows.length + fullLines(masksOf(start.grid)).cols.length).toBe(0);
    const r = playOut(cfg, start, 400);
    expect(r.state.won, `level ${n}`).toBe(true);
    expect(r.moves.length).toBe(spec.par);
    if (spec.goal.kind === 'gems') {
      expect(spec.goal.count).toBeGreaterThan(0);
      for (const g of spec.gems) expect(spec.grid[g]).toBeGreaterThan(0);
    } else expect(spec.goal.target).toBeGreaterThanOrEqual(300);
  });

  it('every fifth level is a score goal and the rest are gem goals', () => {
    for (const n of LEVELS) expect(levelFor(n).goal.kind).toBe(n % 5 === 0 ? 'score' : 'gems');
  });

  it('gems grow with the level', () => {
    const gems = (n: number) => (levelFor(n).goal as { count: number }).count;
    expect(gems(41)).toBeGreaterThan(gems(1));
  });

  it('stars: 3 at par or under, 2 within half again, 1 otherwise', () => {
    const spec = levelFor(3);
    expect(starsFor(spec, spec.par)).toBe(3);
    expect(starsFor(spec, Math.ceil(spec.par * 1.5))).toBe(2);
    expect(starsFor(spec, spec.par * 2 + 1)).toBe(1);
  });

  it('worlds come ten levels at a time and then loop', () => {
    expect(worldOf(1)).toBe(WORLDS[0]);
    expect(worldOf(WORLD_SIZE + 1)).toBe(WORLDS[1]);
    expect(worldOf(WORLD_SIZE * WORLDS.length + 1)).toBe(WORLDS[0]);
  });
});
