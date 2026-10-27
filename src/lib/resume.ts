/**
 * An unfinished game survives a reload or a closed tab: the request and the move log are saved after every move,
 * and the deterministic engine replays them to the same board. Stored per device in localStorage (a convenience,
 * so every read and write is guarded), and dropped when the game ends or the player leaves it.
 */
import { decodeLog, encodeLog } from '../engine/RunLog';
import type { PlayRequest } from '../stores/useNav';
import type { Move } from '../types/game';

const KEY = 'blockburst-resume-v1';

export interface Saved {
  req: PlayRequest;
  log: Move[];
  hinted: boolean;
  elapsedMs: number;
}

export function saveGame(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, log: encodeLog(s.log) }));
  } catch {
    // Storage full or blocked: the game simply won't resume.
  }
}

export function loadGame(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Omit<Saved, 'log'> & { log: string };
    return { ...v, log: decodeLog(v.log) };
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
