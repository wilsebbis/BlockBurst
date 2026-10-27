/**
 * Optional Supabase sync over plain REST (no SDK dependency), as in AntLink and Cluck Crossing. Disabled unless
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set; the game runs fully offline without it. Tables and
 * row-level security live in supabase/schema.sql. Scores are listed only after a server replays the move log with
 * the same rules and generator and checks the hash chain (src/engine/RunLog.ts).
 */
import { encodeLog } from '../engine/RunLog';
import type { Move } from '../types/game';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(url && anonKey);

async function rest(path: string, init: RequestInit & { token?: string }): Promise<Response> {
  if (!cloudEnabled) throw new Error('Cloud sync is not configured');
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: anonKey!, Authorization: `Bearer ${init.token ?? anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates', ...init.headers },
  });
}

export interface RunSubmission {
  playerId: string;
  mode: 'daily' | 'classic';
  seed: string;
  day: string | null;
  score: number;
  lines: number;
  timeMs: number;
  hinted: boolean;
  log: Move[];
  hash: string;
}

/** Submit a Daily Board or ranked Classic game for server-side replay verification. */
export async function submitRun(token: string, s: RunSubmission): Promise<boolean> {
  const res = await rest('runs', {
    method: 'POST',
    token,
    body: JSON.stringify({ player_id: s.playerId, mode: s.mode, seed: s.seed, day: s.day, score: s.score, lines: s.lines, time_ms: Math.round(s.timeMs), hinted: s.hinted, move_log: encodeLog(s.log), log_hash: s.hash }),
  });
  return res.ok;
}

/** Verified Daily Board scores for a day, best first. */
export async function fetchDailyBoard(day: string): Promise<{ display_name: string; score: number }[]> {
  if (!cloudEnabled) return [];
  const res = await rest(`daily_board?day=eq.${day}&select=display_name,score&order=score.desc&limit=50`, { method: 'GET' });
  return res.ok ? res.json() : [];
}

/** Mirror a share of XP into a real crew's weekly pool. */
export async function contributeToCrew(token: string, crewId: string, week: string, xp: number): Promise<boolean> {
  const res = await rest('rpc/crew_contribute', { method: 'POST', token, body: JSON.stringify({ p_crew: crewId, p_week: week, p_xp: Math.max(0, Math.round(xp)) }) });
  return res.ok;
}
