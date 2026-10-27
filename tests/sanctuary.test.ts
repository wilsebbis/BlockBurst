import { describe, expect, it } from 'vitest';
import { build, buildCost, collect, countRescues, emptySanctuary, logReady, puddles, rescue, tankNow, tankSize } from '../src/lib/sanctuary';

const H = 3_600_000;

describe('sanctuary', () => {
  it('counts cleared cells per species and ignores anything that is not a colour', () => {
    expect(countRescues([1, 1, 7, 0, 9, 3])).toEqual([2, 0, 1, 0, 0, 0, 1]);
  });

  it('an empty garden never drips', () => {
    expect(tankNow(emptySanctuary(0), 10 * H)).toBe(0);
  });

  it('drips over real time up to the tank size, then spills into puddles', () => {
    const s = rescue(emptySanctuary(0), [5, 0, 0, 0, 0, 0, 0], 0);
    expect(tankNow(s, H)).toBe(5); // 4 base + 1 species met
    expect(puddles(s, H)).toBe(0);
    expect(tankNow(s, 100 * H)).toBe(tankSize(s));
    expect(puddles(s, 100 * H)).toBe(3);
  });

  it('a clock moved backwards adds nothing', () => {
    const s = rescue(emptySanctuary(10 * H), [1, 0, 0, 0, 0, 0, 0], 10 * H);
    expect(tankNow(s, 0)).toBe(0);
  });

  it('collecting banks the droplets and restarts the tank', () => {
    const s = rescue(emptySanctuary(0), [1, 1, 0, 0, 0, 0, 0], 0);
    const r = collect(s, 2 * H);
    expect(r.gained).toBe(12);
    expect(r.state.bank).toBe(12);
    expect(tankNow(r.state, 2 * H)).toBe(0);
  });

  it('buildings cost droplets, keep what already dripped, and stop at the max level', () => {
    let s = { ...rescue(emptySanctuary(0), [1, 0, 0, 0, 0, 0, 0], 0), bank: 1000 };
    expect(build({ ...s, bank: buildCost(0) - 1 }, 'barrel', 0)).toBeNull();
    const before = tankNow(s, H);
    s = build(s, 'sunflower', H)!;
    expect(s.bank).toBe(1000 - buildCost(0));
    expect(tankNow(s, H)).toBe(before);
    for (let i = 0; i < 4; i++) s = build(s, 'hut', H)!;
    s = build(s, 'hut', H)!;
    expect(s.buildings.hut).toBe(5);
    expect(build({ ...s, bank: 1e9 }, 'hut', H)).toBeNull();
  });

  it('the Species Log pays each step once', () => {
    const s = rescue(emptySanctuary(0), [30, 0, 0, 0, 0, 0, 1], 0);
    expect(logReady(s)).toEqual([
      { species: 0, step: 0 },
      { species: 0, step: 1 },
      { species: 6, step: 0 },
    ]);
    expect(logReady({ ...s, logClaimed: ['0:0', '0:1', '6:0'] })).toEqual([]);
  });
});
