import { describe, expect, it } from 'vitest';
import { anyFit, canPlaceAll, emptyMasks, fits, fullLines, masksOf, placeMasks, SIZE } from '../src/engine/board';
import { playOut } from '../src/engine/bot';
import { candidate, comboPotential, dealParams, dealTray, spikeChance } from '../src/engine/generator';
import { SHAPES, shapeById } from '../src/engine/pieces';
import { applyMove, clearPoints, COMBO_GRACE, dailyLayout, initialState, isLegal, PERFECT_POINTS, previewLines, startState } from '../src/engine/rules';
import type { GameState, RunConfig } from '../src/types/game';

const classic = (seed: string): RunConfig => ({ mode: 'classic', seed });

/** A state with a hand-made grid and tray, for rule tests. */
function rig(grid: number[], tray: string[]): GameState {
  const s = startState(classic('rig'), grid, [], null);
  return { ...s, tray: tray.map((shape, i) => ({ shape, colour: i + 1 })), over: false };
}

describe('pieces', () => {
  it('every shape has consistent cells, masks and a unique id', () => {
    const ids = new Set<string>();
    for (const s of SHAPES) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      expect(s.size).toBe(s.cells.length);
      expect(s.rowMasks.length).toBe(s.h);
      const fromMasks = s.rowMasks.reduce((n, m) => n + m.toString(2).split('1').length - 1, 0);
      expect(fromMasks).toBe(s.size);
      for (const [r, c] of s.cells) expect(s.rowMasks[r] & (1 << c)).toBeTruthy();
      expect(s.weight).toBeGreaterThan(0);
    }
  });

  it('includes the Block Blast staples: lines 1–5, squares 2 and 3, corners, L, T, S and Z', () => {
    for (const id of ['dot', 'i2h', 'i3v', 'i4h', 'i5v', 'o2', 'o3', 'r23', 'c3a', 'c5a', 'l4a', 'j4a', 't4a', 's4h', 'z4h']) expect(() => shapeById(id)).not.toThrow();
  });
});

describe('board masks', () => {
  it('fits respects edges and filled cells', () => {
    const m = emptyMasks();
    expect(fits(m, shapeById('i5h'), 0, 3)).toBe(true);
    expect(fits(m, shapeById('i5h'), 0, 4)).toBe(false);
    m[2] = 0b00010000;
    expect(fits(m, shapeById('o2'), 1, 3)).toBe(false);
    expect(fits(m, shapeById('o2'), 1, 5)).toBe(true);
  });

  it('finds full rows and columns and clears both at once', () => {
    const m = emptyMasks();
    m[3] = 0xff;
    for (let r = 0; r < SIZE; r++) m[r] |= 1 << 6;
    expect(fullLines(m)).toEqual({ rows: [3], cols: [6] });
    m[3] = 0b01111111;
    const after = placeMasks(m, shapeById('dot'), 3, 7);
    expect(after.lines).toBe(2);
    expect(after.masks.every((row) => row === 0)).toBe(true);
  });

  it('canPlaceAll accounts for clears between placements', () => {
    // A full board except column 0. A 2x2 can't fit until two vertical I4s fill the column, which clears
    // all eight rows; only that order places all three pieces.
    const grid = new Array(64).fill(1);
    for (let r = 0; r < 8; r++) grid[r * 8] = 0;
    const m = masksOf(grid);
    expect(anyFit(m, shapeById('o2'))).toBe(false);
    expect(canPlaceAll(m, [shapeById('o2'), shapeById('i4v'), shapeById('i4v')])).toBe(true);
    expect(canPlaceAll(m, [shapeById('o2'), shapeById('o2'), shapeById('o2')])).toBe(false);
  });
});

describe('rules and scoring', () => {
  it('placing scores one point per cell', () => {
    const s = rig(new Array(64).fill(0), ['o3', 'dot', 'dot']);
    const r = applyMove(classic('rig'), s, { slot: 0, r: 0, c: 0 });
    expect(r.events.placePoints).toBe(9);
    expect(r.state.score).toBe(9);
    expect(r.state.tray[0]).toBeNull();
  });

  it('a clear scores 10 x cells x lines x combo, and a full board wipe adds a Perfect Clear', () => {
    expect(clearPoints(8, 1, 1)).toBe(80);
    expect(clearPoints(15, 2, 3)).toBe(900);
    const grid = new Array(64).fill(0);
    for (let c = 0; c < 7; c++) grid[c] = 3;
    const s = rig(grid, ['dot', 'dot', 'dot']);
    const r = applyMove(classic('rig'), s, { slot: 0, r: 0, c: 7 });
    expect(r.events.rows).toEqual([0]);
    expect(r.events.perfect).toBe(true);
    expect(r.state.score).toBe(1 + 80 + PERFECT_POINTS);
    expect(r.state.grid.every((v) => v === 0)).toBe(true);
  });

  it('a combo survives two placements without a clear and ends on the third', () => {
    let s = rig(new Array(64).fill(0), ['dot', 'dot', 'dot']);
    s = { ...s, combo: 2, sinceClear: 0 };
    const cfg = classic('rig');
    for (let i = 1; i < COMBO_GRACE; i++) {
      s = applyMove(cfg, s, { slot: i - 1, r: 7, c: i }).state;
      expect(s.combo).toBe(2);
    }
    s = applyMove(cfg, s, { slot: 2, r: 7, c: 5 }).state;
    expect(s.combo).toBe(0);
  });

  it('rejects illegal moves and previews the lines a move would clear', () => {
    const grid = new Array(64).fill(0);
    for (let c = 0; c < 6; c++) grid[8 + c] = 1;
    const s = rig(grid, ['i2h', 'o2', 'dot']);
    expect(isLegal(s, { slot: 1, r: 0, c: 0 })).toBe(false);
    expect(isLegal(s, { slot: 0, r: 1, c: 7 })).toBe(false);
    expect(previewLines(s, { slot: 0, r: 1, c: 6 })).toEqual({ rows: [1], cols: [] });
    expect(() => applyMove(classic('rig'), s, { slot: 1, r: 0, c: 0 })).toThrow();
  });

  it('deals a new tray once all three pieces are placed, and ends when nothing fits', () => {
    const cfg = classic('deal');
    let s = initialState(cfg);
    expect(s.trayIndex).toBe(1);
    const r = playOut(cfg, s, 3).state;
    expect(r.trayIndex).toBe(2);
    expect(r.tray.every((p) => p !== null)).toBe(true);
    s = playOut(cfg, initialState(cfg), 5000).state;
    expect(s.over).toBe(true);
    const m = masksOf(s.grid);
    for (const p of s.tray) if (p) expect(anyFit(m, shapeById(p.shape))).toBe(false);
  });

  it('is deterministic: the same seed and moves give the same game', () => {
    const cfg = classic('same');
    const a = playOut(cfg, initialState(cfg), 80);
    const b = playOut(cfg, initialState(cfg), 80);
    expect(a.state).toEqual(b.state);
    expect(a.moves).toEqual(b.moves);
  });
});

describe('the tray generator', () => {
  it('reads only the seed, tray number, board and combo (same inputs, same tray)', () => {
    const m = masksOf(dailyLayout('x'));
    const a = dealTray('seed-a', 5, m, 'classic', shapeById);
    expect(dealTray('seed-a', 5, m.slice(), 'classic', shapeById)).toEqual(a);
    expect(dealTray('seed-b', 5, m, 'classic', shapeById)).not.toEqual(a);
  });

  it('every early tray on an open board can be placed in full', () => {
    for (let i = 0; i < 40; i++) {
      const d = dealTray(`fair-${i}`, 0, emptyMasks(), 'classic', shapeById);
      expect(d.fair).toBe(true);
      expect(canPlaceAll(emptyMasks(), d.pieces.map((p) => shapeById(p.shape)))).toBe(true);
    }
  });

  it('looks less hard and deals bigger pieces as a Classic game goes on (by tray number only)', () => {
    expect(dealParams('classic', 0).attempts).toBeGreaterThan(dealParams('classic', 80).attempts);
    expect(dealParams('classic', 80).bigBoost).toBeGreaterThan(dealParams('classic', 0).bigBoost);
    expect(dealParams('adventure', 80)).toEqual(dealParams('adventure', 0));
  });

  it('combo spikes stay fair and deterministic, and pick trays that clear more', () => {
    // A board with two rows one cell short: a spike should find the pieces that finish them.
    const grid = new Array(64).fill(0);
    for (let c = 0; c < 7; c++) {
      grid[6 * 8 + c] = 1;
      grid[7 * 8 + c] = 2;
    }
    const m = masksOf(grid);
    let spikes = 0;
    for (let i = 0; i < 60; i++) {
      const d = dealTray(`spike-${i}`, 3, m, 'classic', shapeById, 4);
      expect(dealTray(`spike-${i}`, 3, m.slice(), 'classic', shapeById, 4)).toEqual(d);
      expect(canPlaceAll(m, d.pieces.map((p) => shapeById(p.shape)))).toBe(true);
      if (d.spike) {
        spikes++;
        const plain = dealTray(`spike-${i}`, 3, m, 'classic', shapeById, 99);
        expect(comboPotential(m, d.pieces.map((p) => shapeById(p.shape)))).toBeGreaterThanOrEqual(comboPotential(m, plain.pieces.map((p) => shapeById(p.shape))));
      }
    }
    expect(spikes).toBeGreaterThan(10);
  });

  it('spikes come more often in a live streak and ease off past ten', () => {
    const m = emptyMasks();
    expect(spikeChance(m, 4)).toBeGreaterThan(spikeChance(m, 0));
    expect(spikeChance(m, 9)).toBeGreaterThan(spikeChance(m, 4));
    expect(spikeChance(m, 10)).toBeLessThan(spikeChance(m, 0));
  });

  it('a double line clear is worth far more than two singles', () => {
    const grid = new Array(64).fill(0);
    for (let c = 0; c < 7; c++) {
      grid[6 * 8 + c] = 1;
      grid[7 * 8 + c] = 2;
    }
    const m = masksOf(grid);
    const domino = shapeById('i2v');
    const dot = shapeById('dot');
    expect(comboPotential(m, [domino, dot, dot])).toBeGreaterThan(comboPotential(m, [dot, dot, dot]));
  });

  it('candidate colours are three different colours from 1–7', () => {
    for (let k = 0; k < 30; k++) {
      const c = candidate('col', k, 0, dealParams('classic', 0));
      expect(new Set(c.map((p) => p.colour)).size).toBe(3);
      for (const p of c) expect(p.colour >= 1 && p.colour <= 7).toBe(true);
    }
  });

  it('Classic games end: Burst Bot never plays forever', () => {
    for (let i = 0; i < 12; i++) {
      const cfg = classic(`ends-${i}`);
      const r = playOut(cfg, initialState(cfg), 3000);
      expect(r.state.over, cfg.seed).toBe(true);
    }
  });
});

describe('Daily Board', () => {
  it('starts mirror-symmetric with no complete line, the same for everyone', () => {
    for (const day of ['2026-10-25', '2026-12-31', '2027-02-14']) {
      const g = dailyLayout(`burst/daily/v1/${day}`);
      expect(dailyLayout(`burst/daily/v1/${day}`)).toEqual(g);
      const { rows, cols } = fullLines(masksOf(g));
      expect(rows.length + cols.length).toBe(0);
      // Mirror-symmetric, except column 0 where a would-be full row loses a block.
      for (let r = 0; r < 8; r++) for (let c = 1; c < 7; c++) expect(!!g[r * 8 + c]).toBe(!!g[r * 8 + 7 - c]);
      expect(g.filter(Boolean).length).toBeGreaterThan(4);
    }
  });
});

describe('revive', () => {
  it('clears just enough blocks for a tray piece to fit again, at least three', async () => {
    const { reviveCells, applyRevive, REVIVE_BLOCKS } = await import('../src/engine/rules');
    const cfg = { mode: 'classic' as const, seed: 'revive-test' };
    // A full board with an O3 in the tray: nothing fits until nine blocks go, so a revive clears nine.
    const full = startState(cfg, new Array(64).fill(1), [], null);
    const stuck = { ...full, tray: [{ shape: 'o3', colour: 1 }, null, null], over: true };
    const cells = reviveCells(cfg, stuck);
    expect(cells.length).toBeGreaterThanOrEqual(REVIVE_BLOCKS);
    const revived = applyRevive(stuck, cells);
    expect(revived.over).toBe(false);
    expect(reviveCells(cfg, stuck)).toEqual(cells);
  });
});
