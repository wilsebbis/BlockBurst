/**
 * Which scene a game is played in. Classic is a journey: the creatures set off from the meadow and wander into a
 * new place every few thousand points. Adventure worlds each have their own scene, and the Daily Board gets one
 * scene a day (the same for everyone). A scene picked in Settings overrides all of that.
 */
import { WORLD_SIZE } from '../engine/levels';
import { SCENES, type SceneId } from '../engine/scenes';
import type { RunMode } from './progression';

export type ScenePick = 'journey' | SceneId;

/** The order the Classic journey wanders through. */
export const JOURNEY: readonly SceneId[] = ['meadow', 'forest', 'pond', 'beach', 'underwater', 'caverns', 'mines', 'snow', 'sky', 'nursery', 'twilight'];

/** Points between journey stops. */
export const JOURNEY_STEP = 2500;

/** Adventure worlds, in order: Candy Coast, Jelly Jungle, Crystal Caves, Neon Nights, Frosty Peaks, Lava Lagoon, Star Station. */
const WORLD_SCENES: readonly SceneId[] = ['beach', 'forest', 'caverns', 'twilight', 'snow', 'mines', 'sky'];

function dayIndex(day: string): number {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % SCENES.length;
}

export function sceneFor(r: { pick: ScenePick; mode: RunMode; day: string | null; level?: number; score: number }): SceneId {
  if (r.pick !== 'journey') return r.pick;
  if (r.mode === 'adventure' && r.level) return WORLD_SCENES[Math.floor((r.level - 1) / WORLD_SIZE) % WORLD_SCENES.length]!;
  if ((r.mode === 'daily' || r.mode === 'archive') && r.day) return SCENES[dayIndex(r.day)]!.id;
  return JOURNEY[Math.floor(Math.max(0, r.score) / JOURNEY_STEP) % JOURNEY.length]!;
}
