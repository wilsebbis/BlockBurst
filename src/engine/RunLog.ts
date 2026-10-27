/**
 * RunLog: every move is logged and hash-chained, so a score can be replayed and checked (the same scheme as
 * Cluck Crossing's RunLog, AntLink's MoveLogVerifier and Bark Battle's movelog):
 *
 *   h0 = H(rulesVersion | mode | seed | level)
 *   h_i = H(h_{i-1} | slot r c)
 *
 * A server replays the moves with these same rules and generator and recomputes the chain before a Daily Board
 * or ranked score is listed (see supabase/schema.sql). The replay also drives "watch the bot" and ghost scores.
 */
import { applyMove, initialState, isLegal } from './rules';
import type { GameState, Move, RunConfig } from '../types/game';

export const RULES_VERSION = 'burst-2';

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const encodeMove = (m: Move) => `${m.slot}${m.r}${m.c}`;
export const encodeLog = (log: Move[]) => log.map(encodeMove).join('');
export function decodeLog(s: string): Move[] {
  const out: Move[] = [];
  for (let i = 0; i + 3 <= s.length; i += 3) out.push({ slot: Number(s[i]), r: Number(s[i + 1]), c: Number(s[i + 2]) });
  return out;
}

const cfgKey = (cfg: RunConfig) => `${cfg.mode}|${cfg.seed}|${cfg.level ?? 0}`;

export async function hashLog(cfg: RunConfig, log: Move[]): Promise<string> {
  let h = await sha256Hex(`${RULES_VERSION}|${cfgKey(cfg)}`);
  for (const m of log) h = await sha256Hex(`${h}|${encodeMove(m)}`);
  return h;
}

/** Replays a log with the real rules. Any illegal move, or a move after the run ended, is an error. */
export function replay(cfg: RunConfig, log: Move[]): { state: GameState; error?: string } {
  let s = initialState(cfg);
  for (let i = 0; i < log.length; i++) {
    if (s.over) return { state: s, error: `move ${i} after the run ended` };
    if (!isLegal(s, log[i])) return { state: s, error: `illegal move ${i}` };
    s = applyMove(cfg, s, log[i]).state;
  }
  return { state: s };
}

export interface RunClaim {
  score: number;
  lines: number;
  /** Wall-clock length the client reports. A human needs some time per move. */
  timeMs: number;
  hash: string;
}

export const MIN_MS_PER_MOVE = 120;

export interface Verdict {
  ok: boolean;
  reason?: string;
  state?: GameState;
}

export async function verifyRun(cfg: RunConfig, log: Move[], claim: RunClaim): Promise<Verdict> {
  const r = replay(cfg, log);
  if (r.error) return { ok: false, reason: r.error };
  if (!r.state.over) return { ok: false, reason: 'run did not end' };
  if (r.state.score !== claim.score) return { ok: false, reason: 'score mismatch' };
  if (r.state.lines !== claim.lines) return { ok: false, reason: 'lines mismatch' };
  if (claim.timeMs < log.length * MIN_MS_PER_MOVE) return { ok: false, reason: 'too fast' };
  if ((await hashLog(cfg, log)) !== claim.hash) return { ok: false, reason: 'hash mismatch' };
  return { ok: true, state: r.state };
}
