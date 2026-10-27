/**
 * Looks the game engine can draw. Block Burst always plays in the Cozy look, so these only describe the fallback
 * drawing paths the engine keeps for its glossy blocks; nothing here can be collected or bought.
 */
export type SkinStyle = 'cozy' | 'glossy' | 'flat' | 'jelly' | 'pixel' | 'gem' | 'neon' | 'wood' | 'candy' | 'ice' | 'lava';
export type BurstStyle = 'spark' | 'confetti' | 'stars' | 'bubbles' | 'hearts' | 'pixels' | 'snow' | 'embers';
