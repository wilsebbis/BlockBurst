/**
 * Everything you can collect is cosmetic: block skins, board themes, clear bursts and profile avatars. None of it
 * changes a piece, a score or the generator (the engine never imports this file).
 *
 * Every item has exactly one way in, shown on its card: the starting set, the Mystery Crate (or its fixed coin
 * price), the rotating Item Shop, the Blast Pass, a rank season, a yearly event, a trophy or a crew milestone.
 */
export type Slot = 'skin' | 'theme' | 'burst' | 'avatar';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Source = 'starter' | 'crate' | 'shop' | 'pass' | 'passGold' | 'rank' | 'event' | 'trophy' | 'crew';

export type SkinStyle = 'cozy' | 'glossy' | 'flat' | 'jelly' | 'pixel' | 'gem' | 'neon' | 'wood' | 'candy' | 'ice' | 'lava';
export type BurstStyle = 'spark' | 'confetti' | 'stars' | 'bubbles' | 'hearts' | 'pixels' | 'snow' | 'embers';

export interface Cosmetic {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  source: Source;
  emoji: string;
  /** Skins: 7 block colours. */
  palette?: string[];
  style?: SkinStyle;
  /** Themes: board, empty cell, page top and bottom. */
  board?: { bg: string; cell: string; top: string; bottom: string };
  burst?: BurstStyle;
}

const CLASSIC = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];
const PASTEL = ['#fca5a5', '#fdba74', '#fde68a', '#86efac', '#67e8f9', '#93c5fd', '#d8b4fe'];
const NEON = ['#ff2e88', '#ff9f1c', '#f9f871', '#39ff14', '#00f0ff', '#4d6bff', '#c04dff'];
const EARTH = ['#b45309', '#d97706', '#ca8a04', '#65a30d', '#0f766e', '#1d4ed8', '#7e22ce'];
const JEWEL = ['#e11d48', '#ea580c', '#eab308', '#059669', '#0891b2', '#2563eb', '#9333ea'];
const ICE = ['#bae6fd', '#a5f3fc', '#e0f2fe', '#ccfbf1', '#7dd3fc', '#93c5fd', '#c7d2fe'];
const LAVA = ['#7f1d1d', '#b91c1c', '#ea580c', '#f59e0b', '#dc2626', '#9a3412', '#fb923c'];
const MONO = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#d4d4d8'];
const CANDY = ['#fb7185', '#f472b6', '#fbbf24', '#a3e635', '#2dd4bf', '#60a5fa', '#c084fc'];
const SUNSET = ['#f43f5e', '#fb923c', '#fcd34d', '#f472b6', '#c084fc', '#818cf8', '#fda4af'];
const OCEAN = ['#0ea5e9', '#06b6d4', '#14b8a6', '#22d3ee', '#38bdf8', '#2563eb', '#1e40af'];
const FOREST = ['#166534', '#15803d', '#4d7c0f', '#a16207', '#65a30d', '#047857', '#3f6212'];
const GOLD = ['#fde047', '#facc15', '#eab308', '#ca8a04', '#fbbf24', '#f59e0b', '#fef08a'];

const skin = (id: string, name: string, rarity: Rarity, source: Source, emoji: string, palette: string[], style: SkinStyle): Cosmetic => ({ id, slot: 'skin', name, rarity, source, emoji, palette, style });
const theme = (id: string, name: string, rarity: Rarity, source: Source, emoji: string, board: Cosmetic['board']): Cosmetic => ({ id, slot: 'theme', name, rarity, source, emoji, board });
const burst = (id: string, name: string, rarity: Rarity, source: Source, emoji: string, b: BurstStyle): Cosmetic => ({ id, slot: 'burst', name, rarity, source, emoji, burst: b });
const avatar = (id: string, name: string, rarity: Rarity, source: Source, emoji: string): Cosmetic => ({ id, slot: 'avatar', name, rarity, source, emoji });

export const COSMETICS: Cosmetic[] = [
  // Starting set.
  skin('classic', 'Classic Gloss', 'common', 'starter', '🟥', CLASSIC, 'glossy'),
  theme('midnight', 'Midnight', 'common', 'starter', '🌌', { bg: '#1e2a5a', cell: '#2a3772', top: '#3b4fa8', bottom: '#1b2350' }),
  burst('spark', 'Sparks', 'common', 'starter', '✨', 'spark'),
  avatar('cube', 'Cube', 'common', 'starter', '🧊'),

  // Mystery Crate pool (each also has a fixed coin price).
  skin('pastel', 'Pastel Pop', 'common', 'crate', '🧁', PASTEL, 'flat'),
  skin('jelly', 'Jelly Jar', 'common', 'crate', '🍮', CANDY, 'jelly'),
  skin('earth', 'Clay Works', 'common', 'crate', '🏺', EARTH, 'flat'),
  skin('pixel', 'Pixel Pack', 'rare', 'crate', '👾', CLASSIC, 'pixel'),
  skin('ocean', 'Deep Ocean', 'rare', 'crate', '🌊', OCEAN, 'glossy'),
  skin('jewel', 'Crown Jewels', 'epic', 'crate', '💎', JEWEL, 'gem'),
  skin('neon', 'Neon Rush', 'epic', 'crate', '🌈', NEON, 'neon'),
  skin('gold', 'Solid Gold', 'legendary', 'crate', '🥇', GOLD, 'gem'),
  theme('sunrise', 'Sunrise', 'common', 'crate', '🌅', { bg: '#7c2d12', cell: '#9a3412', top: '#fb923c', bottom: '#7c2d12' }),
  theme('mint', 'Mint Garden', 'common', 'crate', '🌿', { bg: '#14532d', cell: '#166534', top: '#4ade80', bottom: '#14532d' }),
  theme('arcade', 'Arcade', 'rare', 'crate', '🕹️', { bg: '#111827', cell: '#1f2937', top: '#7c3aed', bottom: '#0f172a' }),
  theme('galaxy', 'Galaxy', 'epic', 'crate', '🪐', { bg: '#1e1b4b', cell: '#312e81', top: '#6d28d9', bottom: '#0b0a26' }),
  burst('confetti', 'Confetti', 'common', 'crate', '🎊', 'confetti'),
  burst('bubbles', 'Bubbles', 'rare', 'crate', '🫧', 'bubbles'),
  burst('stars', 'Starfall', 'epic', 'crate', '🌟', 'stars'),
  avatar('fox', 'Fox', 'common', 'crate', '🦊'),
  avatar('panda', 'Panda', 'common', 'crate', '🐼'),
  avatar('owl', 'Owl', 'rare', 'crate', '🦉'),
  avatar('dragon', 'Dragon', 'legendary', 'crate', '🐉'),

  // Item Shop rotation (fixed coin prices).
  skin('candy', 'Candy Shop', 'rare', 'shop', '🍭', CANDY, 'candy'),
  skin('sunset', 'Sunset Strip', 'rare', 'shop', '🌇', SUNSET, 'glossy'),
  skin('wood', 'Woodshop', 'rare', 'shop', '🪵', EARTH, 'wood'),
  skin('mono', 'Monochrome', 'common', 'shop', '⬜', MONO, 'flat'),
  skin('forest', 'Forest Floor', 'common', 'shop', '🌲', FOREST, 'jelly'),
  skin('retro', 'Retro Bits', 'epic', 'shop', '🕹️', NEON, 'pixel'),
  theme('paper', 'Paper Craft', 'common', 'shop', '📄', { bg: '#57534e', cell: '#78716c', top: '#d6d3d1', bottom: '#44403c' }),
  theme('coral', 'Coral Reef', 'rare', 'shop', '🪸', { bg: '#155e75', cell: '#0e7490', top: '#22d3ee', bottom: '#164e63' }),
  theme('sakura', 'Sakura', 'rare', 'shop', '🌸', { bg: '#831843', cell: '#9d174d', top: '#f9a8d4', bottom: '#500724' }),
  theme('synth', 'Synthwave', 'epic', 'shop', '🌆', { bg: '#2e1065', cell: '#4c1d95', top: '#ec4899', bottom: '#1e1b4b' }),
  burst('hearts', 'Hearts', 'rare', 'shop', '💖', 'hearts'),
  burst('pixels', 'Pixel Pop', 'rare', 'shop', '🟪', 'pixels'),
  avatar('cat', 'Cat', 'common', 'shop', '🐱'),
  avatar('frog', 'Frog', 'common', 'shop', '🐸'),
  avatar('robot', 'Robot', 'rare', 'shop', '🤖'),
  avatar('unicorn', 'Unicorn', 'epic', 'shop', '🦄'),
  avatar('octopus', 'Octopus', 'rare', 'shop', '🐙'),
  avatar('alien', 'Alien', 'epic', 'shop', '👽'),

  // Blast Pass (free and Gold tracks).
  skin('mint-skin', 'Minty Fresh', 'rare', 'pass', '🍃', ['#6ee7b7', '#34d399', '#a7f3d0', '#10b981', '#5eead4', '#99f6e4', '#bbf7d0'], 'jelly'),
  theme('dusk', 'Dusk', 'rare', 'pass', '🌆', { bg: '#312e81', cell: '#3730a3', top: '#f472b6', bottom: '#1e1b4b' }),
  avatar('penguin', 'Penguin', 'rare', 'pass', '🐧'),
  burst('ribbons', 'Ribbons', 'epic', 'passGold', '🎀', 'confetti'),
  skin('royal', 'Royal Velvet', 'epic', 'passGold', '👑', ['#7e22ce', '#9333ea', '#c026d3', '#db2777', '#4f46e5', '#6d28d9', '#a21caf'], 'gem'),
  theme('aurora', 'Aurora', 'epic', 'passGold', '🌌', { bg: '#042f2e', cell: '#134e4a', top: '#2dd4bf', bottom: '#020617' }),
  avatar('phoenix', 'Phoenix', 'legendary', 'passGold', '🐦‍🔥'),

  // Rank seasons (one per tier reached, kept forever).
  avatar('rank-silver', 'Silver Badge', 'rare', 'rank', '🥈'),
  avatar('rank-gold', 'Gold Badge', 'epic', 'rank', '🥇'),
  skin('rank-diamond', 'Diamond Cut', 'legendary', 'rank', '💠', ['#e0f2fe', '#bae6fd', '#7dd3fc', '#a5f3fc', '#c7d2fe', '#ddd6fe', '#f5f3ff'], 'gem'),

  // Yearly events (back every year).
  skin('ice', 'Ice Blocks', 'epic', 'event', '❄️', ICE, 'ice'),
  burst('snow', 'Snowfall', 'rare', 'event', '🌨️', 'snow'),
  avatar('bunny', 'Bloom Bunny', 'rare', 'event', '🐰'),
  skin('lava', 'Lava Lamp', 'epic', 'event', '🌋', LAVA, 'lava'),
  burst('embers', 'Embers', 'rare', 'event', '🔥', 'embers'),

  // Trophies and crews.
  avatar('trophy', 'Champion', 'epic', 'trophy', '🏆'),
  theme('crew-banner', 'Crew Colours', 'epic', 'crew', '🚩', { bg: '#7f1d1d', cell: '#991b1b', top: '#fbbf24', bottom: '#450a0a' }),
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export const cosmeticById = (id: string): Cosmetic | undefined => BY_ID.get(id);

export function mustCosmetic(id: string): Cosmetic {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`unknown cosmetic ${id}`);
  return c;
}

export const STARTER_ITEMS = COSMETICS.filter((c) => c.source === 'starter').map((c) => c.id);

export const DEFAULT_LOADOUT: Record<Slot, string> = { skin: 'classic', theme: 'midnight', burst: 'spark', avatar: 'cube' };

export const SLOT_NAMES: Record<Slot, string> = { skin: 'Block skins', theme: 'Board themes', burst: 'Clear bursts', avatar: 'Avatars' };

export const RARITY_COLOR: Record<Rarity, string> = { common: '#94a3b8', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24' };

/** Coin prices, fixed by rarity, the same in the shop and for buying a crate item outright. */
export const COIN_PRICE: Record<Rarity, number> = { common: 200, rare: 450, epic: 900, legendary: 1800 };

export const SOURCE_TEXT: Record<Source, string> = {
  starter: 'Starting set',
  crate: 'Mystery Crate, or buy it outright for coins',
  shop: 'Item Shop rotation',
  pass: 'Blast Pass (free track)',
  passGold: 'Blast Pass (Gold track)',
  rank: 'Rank season reward',
  event: 'Yearly event (returns every year)',
  trophy: 'Trophy reward',
  crew: 'Crew milestone',
};
