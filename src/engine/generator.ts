/**
 * The tray generator. Block Blast's trays feel "fair" because the game looks at the board before it deals; this
 * one does the same, openly and deterministically:
 *
 *  1. Candidate k for tray n is drawn from its own RNG stream, `burst/deal/v1/<seed>/<n>/<k>`, by shape weight.
 *  2. The first candidate whose three pieces can all be placed (in some order, with clears) is dealt.
 *  3. The number of candidates it may look at shrinks as a Classic run goes on, and big pieces get more common,
 *     so long runs do end. If no candidate can be fully placed it deals the first one where at least one fits,
 *     and failing that, candidate 0 (the run is over).
 *  4. Combo spikes: some trays (decided by their own RNG stream, `burst/spike/v1/<seed>/<n>`) look through a
 *     bigger pool and deal the fully placeable tray whose best play clears the most lines at once and keeps the
 *     clears coming. Spikes come more often while a combo streak is alive (to carry it towards ten) and when
 *     lines are nearly full, and ease off after a streak of ten so it can end. That rhythm of tension and big
 *     payoffs is what makes the best runs feel electric.
 *
 * The generator reads the seed, the tray number, the board and the combo count, and nothing else: never the
 * player, their history, their level or their spending (tests/playbook.test.ts checks the imports).
 */
import { anyFit, canPlaceAll, fits, placeMasks, SIZE, type Masks } from './board';
import { COLOURS, SHAPES, type Shape } from './pieces';
import { createRng, type Rng } from './rng';
import type { GameMode, Piece } from '../types/game';

export interface DealParams {
  attempts: number;
  /** Weight multiplier for 5+ cell pieces. */
  bigBoost: number;
  /** Weight multiplier for 1–2 cell pieces. */
  smallDamp: number;
}

export function dealParams(mode: GameMode, trayIndex: number): DealParams {
  if (mode === 'adventure') return { attempts: 16, bigBoost: 1, smallDamp: 1 };
  const attempts = trayIndex < 8 ? 24 : trayIndex < 25 ? 12 : trayIndex < 60 ? 6 : 3;
  return { attempts, bigBoost: 1 + Math.min(0.8, trayIndex / 80), smallDamp: Math.max(0.35, 1 - trayIndex / 60) };
}

function weightOf(s: Shape, p: DealParams): number {
  return s.weight * (s.tier === 'big' ? p.bigBoost : s.tier === 'small' ? p.smallDamp : 1);
}

function drawShape(rng: Rng, p: DealParams): Shape {
  let total = 0;
  for (const s of SHAPES) total += weightOf(s, p);
  let x = rng.next() * total;
  for (const s of SHAPES) {
    x -= weightOf(s, p);
    if (x < 0) return s;
  }
  return SHAPES[SHAPES.length - 1];
}

export function candidate(seed: string, trayIndex: number, k: number, p: DealParams): Piece[] {
  const rng = createRng(`burst/deal/v1/${seed}/${trayIndex}/${k}`);
  const colours = rng.shuffle(Array.from({ length: COLOURS }, (_, i) => i + 1));
  return [0, 1, 2].map((i) => ({ shape: drawShape(rng, p).id, colour: colours[i] }));
}

export interface Deal {
  pieces: Piece[];
  /** Which candidate was dealt and whether it passed the full-tray check. */
  k: number;
  fair: boolean;
  /** A combo spike: picked from a bigger pool for the clears it sets up. */
  spike?: boolean;
}

/** Extra candidates a combo spike looks through. */
export const SPIKE_POOL = 24;

/** Lines (rows and columns) with at least six of eight cells filled: clears waiting to happen. */
export function nearlyFull(m: Masks): number {
  let n = 0;
  for (let r = 0; r < SIZE; r++) if (popcount(m[r]!) >= 6) n++;
  for (let c = 0; c < SIZE; c++) {
    let filled = 0;
    for (let r = 0; r < SIZE; r++) filled += (m[r]! >> c) & 1;
    if (filled >= 6) n++;
  }
  return n;
}

function popcount(x: number): number {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

/**
 * How likely this tray is to be a combo spike. A live streak raises it (more with each clear, carrying the
 * streak towards ten), nearly full lines raise it, and a streak of ten or more lowers it so the streak can end.
 */
export function spikeChance(m: Masks, combo: number): number {
  if (combo >= 10) return 0.1;
  let chance = 0.12 + Math.min(0.2, nearlyFull(m) * 0.05);
  if (combo >= 1) chance += 0.15 + combo * 0.04;
  return Math.min(0.75, chance);
}

/**
 * The best clears a tray can make on this board: each of the six orders is played greedily (every piece where
 * it clears the most), and the best order's total lines, biggest single clear and number of clearing placements
 * are scored. Bigger multi-line clears count for much more than single ones.
 */
export function comboPotential(m: Masks, shapes: Shape[]): number {
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let best = -1;
  const seen = new Set<string>();
  for (const order of orders) {
    const key = order.map((i) => shapes[i]!.id).join();
    if (seen.has(key)) continue;
    seen.add(key);
    let masks = m;
    let total = 0;
    let biggest = 0;
    let clearing = 0;
    let ok = true;
    for (const i of order) {
      const sh = shapes[i]!;
      let pick: { masks: Masks; lines: number } | null = null;
      for (let r = 0; r + sh.h <= SIZE; r++) {
        for (let c = 0; c + sh.w <= SIZE; c++) {
          if (!fits(masks, sh, r, c)) continue;
          const after = placeMasks(masks, sh, r, c);
          if (!pick || after.lines > pick.lines) pick = after;
        }
      }
      if (!pick) {
        ok = false;
        break;
      }
      masks = pick.masks;
      total += pick.lines;
      biggest = Math.max(biggest, pick.lines);
      if (pick.lines > 0) clearing++;
    }
    if (!ok) continue;
    best = Math.max(best, clearing * 4 + total * 3 + biggest * biggest * 2);
  }
  return best;
}

export function dealTray(seed: string, trayIndex: number, masks: Masks, mode: GameMode, shapeOf: (id: string) => Shape, combo = 0): Deal {
  const p = dealParams(mode, trayIndex);
  const cands: Piece[][] = [];
  let fair: Deal | null = null;
  for (let k = 0; k < p.attempts; k++) {
    const c = candidate(seed, trayIndex, k, p);
    cands.push(c);
    if (canPlaceAll(masks, c.map((x) => shapeOf(x.shape)))) {
      fair = { pieces: c, k, fair: true };
      break;
    }
  }
  if (fair) {
    if (createRng(`burst/spike/v1/${seed}/${trayIndex}`).next() >= spikeChance(masks, combo)) return fair;
    // A combo spike: of the fair deal and a bigger pool, deal the fully placeable tray with the best clears.
    let best = fair;
    let bestScore = comboPotential(masks, fair.pieces.map((x) => shapeOf(x.shape)));
    for (let k = p.attempts; k < p.attempts + SPIKE_POOL; k++) {
      const c = candidate(seed, trayIndex, k, p);
      const shapes = c.map((x) => shapeOf(x.shape));
      const score = comboPotential(masks, shapes);
      if (score > bestScore && canPlaceAll(masks, shapes)) {
        best = { pieces: c, k, fair: true, spike: true };
        bestScore = score;
      }
    }
    return best;
  }
  const some = cands.findIndex((c) => c.some((x) => anyFit(masks, shapeOf(x.shape))));
  return some >= 0 ? { pieces: cands[some], k: some, fair: false } : { pieces: cands[0], k: 0, fair: false };
}
