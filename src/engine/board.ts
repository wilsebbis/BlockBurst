/**
 * The 8x8 board as bitmasks: one 8-bit mask per row (bit c = column c filled). Every rule question the engine,
 * the generator and the bot ask — does a piece fit here, which lines would it complete, can this whole tray still
 * be placed — is a handful of integer ops, so the generator can afford to search before it deals.
 */
import type { Shape } from './pieces';

export const SIZE = 8;
export const FULL = 0xff;

export type Masks = number[];

export const emptyMasks = (): Masks => new Array(SIZE).fill(0);

export function masksOf(grid: ArrayLike<number>): Masks {
  const m = emptyMasks();
  for (let i = 0; i < SIZE * SIZE; i++) if (grid[i]) m[(i / SIZE) | 0] |= 1 << i % SIZE;
  return m;
}

export function fits(m: Masks, s: Shape, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r + s.h > SIZE || c + s.w > SIZE) return false;
  for (let i = 0; i < s.h; i++) if (m[r + i] & (s.rowMasks[i] << c)) return false;
  return true;
}

/** Every top-left position where the shape fits, as r*8+c. */
export function positions(m: Masks, s: Shape): number[] {
  const out: number[] = [];
  for (let r = 0; r + s.h <= SIZE; r++) for (let c = 0; c + s.w <= SIZE; c++) if (fits(m, s, r, c)) out.push(r * SIZE + c);
  return out;
}

export const anyFit = (m: Masks, s: Shape) => {
  for (let r = 0; r + s.h <= SIZE; r++) for (let c = 0; c + s.w <= SIZE; c++) if (fits(m, s, r, c)) return true;
  return false;
};

export interface Lines {
  rows: number[];
  cols: number[];
}

/** Full rows and columns of a mask set. */
export function fullLines(m: Masks): Lines {
  const rows: number[] = [];
  let colAnd = FULL;
  for (let r = 0; r < SIZE; r++) {
    if (m[r] === FULL) rows.push(r);
    colAnd &= m[r];
  }
  const cols: number[] = [];
  for (let c = 0; c < SIZE; c++) if (colAnd & (1 << c)) cols.push(c);
  return { rows, cols };
}

/** Place a shape and clear any completed lines, on masks only. Returns the new masks and how many lines cleared. */
export function placeMasks(m: Masks, s: Shape, r: number, c: number): { masks: Masks; lines: number } {
  const next = m.slice();
  for (let i = 0; i < s.h; i++) next[r + i] |= s.rowMasks[i] << c;
  const { rows, cols } = fullLines(next);
  if (!rows.length && !cols.length) return { masks: next, lines: 0 };
  let colMask = 0;
  for (const col of cols) colMask |= 1 << col;
  for (let i = 0; i < SIZE; i++) next[i] = rows.includes(i) ? 0 : next[i] & ~colMask;
  return { masks: next, lines: rows.length + cols.length };
}

/**
 * True if every piece can be placed, in some order, with clears happening between placements. This is the
 * generator's fairness test: a tray it deals as "fair" really can be played out in full.
 */
export function canPlaceAll(m: Masks, shapes: Shape[]): boolean {
  if (!shapes.length) return true;
  const tried = new Set<string>();
  for (let k = 0; k < shapes.length; k++) {
    const s = shapes[k];
    if (tried.has(s.id)) continue;
    tried.add(s.id);
    const rest = shapes.filter((_, j) => j !== k);
    for (let r = 0; r + s.h <= SIZE; r++) {
      for (let c = 0; c + s.w <= SIZE; c++) {
        if (!fits(m, s, r, c)) continue;
        if (!rest.length) return true;
        if (canPlaceAll(placeMasks(m, s, r, c).masks, rest)) return true;
      }
    }
  }
  return false;
}

export const popcount8 = (x: number) => {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
};

export const filledCount = (m: Masks) => m.reduce((n, row) => n + popcount8(row), 0);
