/**
 * Burst Bot: a greedy one-move-ahead player. It is the labelled [BOT] on every board, the opt-in 💡 Hint assist,
 * and the level verifier (every Adventure level ships only after the bot has beaten it). It reads the board and
 * the tray, and nothing about the player.
 */
import { anyFit, fullLines, masksOf, SIZE, type Masks } from './board';
import { shapeById } from './pieces';
import { applyMove } from './rules';
import type { GameState, Move, RunConfig } from '../types/game';

const BIG = shapeById('o3');

function roughness(m: Masks): number {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = (m[r] >> c) & 1;
      const right = c + 1 < SIZE ? (m[r] >> (c + 1)) & 1 : 1;
      const down = r + 1 < SIZE ? (m[r + 1] >> c) & 1 : 1;
      n += (v ^ right) + (v ^ down);
    }
  }
  return n;
}

function holes(m: Masks): number {
  let pen = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((m[r] >> c) & 1) continue;
      let closed = 0;
      closed += r === 0 || (m[r - 1] >> c) & 1 ? 1 : 0;
      closed += r === SIZE - 1 || (m[r + 1] >> c) & 1 ? 1 : 0;
      closed += c === 0 || (m[r] >> (c - 1)) & 1 ? 1 : 0;
      closed += c === SIZE - 1 || (m[r] >> (c + 1)) & 1 ? 1 : 0;
      pen += closed === 4 ? 15 : closed === 3 ? 4 : 0;
    }
  }
  return pen;
}

/** How good it looks to put the piece in `slot` at (r, c). Assumes the move is legal. */
export function evaluate(s: GameState, slot: number, r: number, c: number): number {
  const sh = shapeById(s.tray[slot]!.shape);
  const m = masksOf(s.grid);
  for (let i = 0; i < sh.h; i++) m[r + i] |= sh.rowMasks[i] << c;
  const { rows, cols } = fullLines(m);
  const lines = rows.length + cols.length;
  let colMask = 0;
  for (const col of cols) colMask |= 1 << col;
  const after = m.map((row, i) => (rows.includes(i) ? 0 : row & ~colMask));
  const gemsHit = s.gems.filter((i) => rows.includes((i / SIZE) | 0) || cols.includes(i % SIZE)).length;
  let v = lines * lines * 30 + gemsHit * 400 + (lines > 0 ? 20 * s.combo : 0);
  v -= holes(after) + roughness(after);
  if (anyFit(after, BIG)) v += 12;
  for (let k = 0; k < 3; k++) {
    const p = s.tray[k];
    if (k !== slot && p && !anyFit(after, shapeById(p.shape))) v -= 400;
  }
  // Adventure: lean towards filling lines that still hold gems.
  for (const g of s.gems) {
    if (rows.includes((g / SIZE) | 0) || cols.includes(g % SIZE)) continue;
    const gr = (g / SIZE) | 0;
    const gc = g % SIZE;
    let filled = 0;
    for (let k = 0; k < SIZE; k++) filled += ((after[gr] >> k) & 1) + ((after[k] >> gc) & 1);
    v += filled;
  }
  return v;
}

export function bestMove(s: GameState): Move | null {
  if (s.over) return null;
  const m = masksOf(s.grid);
  let best: Move | null = null;
  let bestV = -Infinity;
  for (let slot = 0; slot < 3; slot++) {
    const p = s.tray[slot];
    if (!p) continue;
    const sh = shapeById(p.shape);
    for (let r = 0; r + sh.h <= SIZE; r++) {
      for (let c = 0; c + sh.w <= SIZE; c++) {
        let ok = true;
        for (let i = 0; i < sh.h && ok; i++) if (m[r + i] & (sh.rowMasks[i] << c)) ok = false;
        if (!ok) continue;
        const v = evaluate(s, slot, r, c);
        if (v > bestV) {
          bestV = v;
          best = { slot, r, c };
        }
      }
    }
  }
  return best;
}

/**
 * A looser bot, for measuring how hard a level is: most of the time it plays its best move, but `slip` of the
 * time it settles for its second or third best, the way a person in a hurry might.
 */
export function playOutLoose(cfg: RunConfig, start: GameState, rand: () => number, slip: number, maxMoves = 200): GameState {
  let s = start;
  let moves = 0;
  while (!s.over && moves < maxMoves) {
    const options: { mv: Move; v: number }[] = [];
    const m = masksOf(s.grid);
    for (let slot = 0; slot < 3; slot++) {
      const p = s.tray[slot];
      if (!p) continue;
      const sh = shapeById(p.shape);
      for (let r = 0; r + sh.h <= SIZE; r++) {
        for (let c = 0; c + sh.w <= SIZE; c++) {
          let ok = true;
          for (let i = 0; i < sh.h && ok; i++) if (m[r + i] & (sh.rowMasks[i] << c)) ok = false;
          if (ok) options.push({ mv: { slot, r, c }, v: evaluate(s, slot, r, c) });
        }
      }
    }
    if (options.length === 0) break;
    options.sort((a, b) => b.v - a.v);
    const pick = rand() < slip ? options[Math.min(options.length - 1, 1 + Math.floor(rand() * 2))]! : options[0]!;
    s = applyMove(cfg, s, pick.mv).state;
    moves++;
  }
  return s;
}

/** Let the bot play a run to its end (or `maxMoves`). */
export function playOut(cfg: RunConfig, start: GameState, maxMoves = 600): { state: GameState; moves: Move[] } {
  let s = start;
  const moves: Move[] = [];
  while (!s.over && moves.length < maxMoves) {
    const mv = bestMove(s);
    if (!mv) break;
    moves.push(mv);
    s = applyMove(cfg, s, mv).state;
  }
  return { state: s, moves };
}
