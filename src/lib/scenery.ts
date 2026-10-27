/**
 * Which scene a level is played in. Each Adventure world has its own place, and a scene picked in Settings
 * (Sunny Beach, The Nursery, Rainy Pond and the rest) overrides that for every level.
 */
import { WORLD_SIZE } from '../engine/levels';
import type { SceneId } from '../engine/scenes';

/** 'journey' follows the worlds; any other value is the one scene the player picked. */
export type ScenePick = 'journey' | SceneId;

/** Adventure worlds, in order: Candy Coast, Jelly Jungle, Crystal Caves, Neon Nights, Frosty Peaks, Lava Lagoon, Star Station. */
export const WORLD_SCENES: readonly SceneId[] = ['beach', 'forest', 'caverns', 'twilight', 'snow', 'mines', 'sky'];

export function sceneFor(request: { pick: ScenePick; level: number }): SceneId {
  if (request.pick !== 'journey') return request.pick;
  const worldIndex = Math.floor((Math.max(1, request.level) - 1) / WORLD_SIZE);
  return WORLD_SCENES[worldIndex % WORLD_SCENES.length]!;
}
