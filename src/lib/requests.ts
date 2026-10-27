/** Play requests for each mode. Classic games get a fresh seed every time; a Daily Board's seed is its date. */
import { adventureConfig } from '../engine/rules';
import { dailySeed } from './bots';
import { utcDateKey } from './dates';
import { useMetaStore } from '../stores/useMetaStore';
import type { PlayRequest } from '../stores/useNav';

export function classicRequest(): PlayRequest {
  const s = useMetaStore.getState();
  return { cfg: { mode: 'classic', seed: `burst/classic/v1/${s.salt}/${s.runCounter}-${Date.now().toString(36)}` }, mode: 'classic', day: null };
}

export function dailyRequest(day = utcDateKey()): PlayRequest {
  return { cfg: { mode: 'daily', seed: dailySeed(day) }, mode: day === utcDateKey() ? 'daily' : 'archive', day };
}

export const adventureRequest = (level: number): PlayRequest => ({ cfg: adventureConfig(level), mode: 'adventure', day: null });
