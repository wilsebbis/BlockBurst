/**
 * The Sanctuary: where the blobs you clear off the board go. Every cleared cell is a rescued blob of that
 * colour's species; they live on in a little garden, drip droplets into a rain tank over real time, and the
 * droplets build the garden up. A full tank leaves puddles on the path: a gentle reason to drop by, never a
 * penalty (nothing is lost, the tank just stops filling).
 *
 * Droplets can't be bought and buy nothing but garden buildings, so this loop sits outside the shop entirely.
 */

export const SPECIES_COUNT = 7;

/** Display names for the seven species, in colour order (1–7). */
export const SPECIES_NAMES = ['Peachling', 'Skydrop', 'Butterbun', 'Violetta', 'Pebble', 'Sprout', 'Rosebud'] as const;
export const SPECIES_BLURB = [
  'Cheerful and speckled. Smiles at everything.',
  'Shy and see-through. Blushes when watched.',
  'A cheeky little cloud. Winks a lot.',
  'Glossy, sarcastic, secretly soft.',
  'Grumpy stone with sharp corners. Loyal.',
  'Sleepy. Would rather be napping.',
  'Excited about absolutely everything.',
] as const;

export type BuildingId = 'hut' | 'barrel' | 'sunflower';

export const BUILDINGS: Record<BuildingId, { name: string; emoji: string; what: string }> = {
  hut: { name: 'Moss Huts', emoji: '🍄', what: 'More rescued blobs come out to play' },
  barrel: { name: 'Rain Barrel', emoji: '🛢️', what: 'The tank holds more droplets' },
  sunflower: { name: 'Sunflowers', emoji: '🌻', what: 'Droplets drip in faster' },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
export const MAX_LEVEL = 5;

/** Species Log steps: how many of one species you've rescued, and the coins the step pays once. */
export const LOG_STEPS = [
  { at: 1, title: 'Met', coins: 10 },
  { at: 25, title: 'Friends', coins: 25 },
  { at: 100, title: 'Family', coins: 50 },
  { at: 500, title: 'Village', coins: 100 },
  { at: 2000, title: 'Legend', coins: 250 },
] as const;

export interface SanctuaryState {
  /** Blobs rescued per species (index 0 = colour 1). */
  rescued: number[];
  /** Droplets in the tank as of `tickAt`. */
  droplets: number;
  tickAt: number;
  /** Droplets collected but not yet spent. */
  bank: number;
  buildings: Record<BuildingId, number>;
  /** Log steps already paid, as "species:step". */
  logClaimed: string[];
}

export function emptySanctuary(now = Date.now()): SanctuaryState {
  return { rescued: Array(SPECIES_COUNT).fill(0), droplets: 0, tickAt: now, bank: 0, buildings: { hut: 0, barrel: 0, sunflower: 0 }, logClaimed: [] };
}

/** How many species you've met at least once. */
export const speciesMet = (s: SanctuaryState) => s.rescued.filter((n) => n > 0).length;

/** Droplets an hour: a base drip, more with sunflowers and with every species living there. */
export const dropletsPerHour = (s: SanctuaryState) => 4 + 3 * s.buildings.sunflower + speciesMet(s);

export const tankSize = (s: SanctuaryState) => 30 + 30 * s.buildings.barrel;

/** Blobs out wandering in the garden at once. */
export const roamers = (s: SanctuaryState) => Math.min(s.rescued.reduce((a, b) => a + b, 0), 5 + 2 * s.buildings.hut);

/** What the tank holds right now. Time running backwards (a changed clock) adds nothing. */
export function tankNow(s: SanctuaryState, now = Date.now()): number {
  if (speciesMet(s) === 0) return s.droplets;
  const hours = Math.max(0, now - s.tickAt) / 3_600_000;
  return Math.min(tankSize(s), Math.floor(s.droplets + hours * dropletsPerHour(s)));
}

/** A full tank spills over into puddles on the garden path, one more every two hours (a "come say hi" cue). */
export function puddles(s: SanctuaryState, now = Date.now()): number {
  if (speciesMet(s) === 0 || tankNow(s, now) < tankSize(s)) return 0;
  const fullAt = s.tickAt + ((tankSize(s) - s.droplets) / dropletsPerHour(s)) * 3_600_000;
  return Math.min(3, 1 + Math.floor(Math.max(0, now - fullAt) / 7_200_000));
}

/** Empties the tank into the bank. */
export function collect(s: SanctuaryState, now = Date.now()): { state: SanctuaryState; gained: number } {
  const gained = tankNow(s, now);
  return { state: { ...s, droplets: 0, tickAt: now, bank: s.bank + gained }, gained };
}

/** Droplets to take a building from `level` to the next one. */
export const buildCost = (level: number) => 20 * 2 ** level;

export function build(s: SanctuaryState, id: BuildingId, now = Date.now()): SanctuaryState | null {
  const level = s.buildings[id];
  if (level >= MAX_LEVEL || s.bank < buildCost(level)) return null;
  // Bank what has dripped so far at the old rate, so an upgrade never rewrites the past.
  const droplets = tankNow(s, now);
  return { ...s, droplets, tickAt: now, bank: s.bank - buildCost(level), buildings: { ...s.buildings, [id]: level + 1 } };
}

/** Adds a game's rescues (per-species counts). Meeting a first species starts the drip from now. */
export function rescue(s: SanctuaryState, counts: readonly number[], now = Date.now()): SanctuaryState {
  if (!counts.some((n) => n > 0)) return s;
  const droplets = tankNow(s, now);
  const rescued = s.rescued.map((n, i) => n + Math.max(0, Math.floor(counts[i] ?? 0)));
  return { ...s, rescued, droplets, tickAt: now };
}

/** Log steps reached but not yet paid. */
export function logReady(s: SanctuaryState): { species: number; step: number }[] {
  const out: { species: number; step: number }[] = [];
  s.rescued.forEach((n, species) => LOG_STEPS.forEach((st, step) => n >= st.at && !s.logClaimed.includes(`${species}:${step}`) && out.push({ species, step })));
  return out;
}

/** The step a species has reached, or -1. */
export const logStep = (n: number) => LOG_STEPS.reduce((best, st, i) => (n >= st.at ? i : best), -1);

/** Rescued blobs per species from a game's cleared cells (colour indices 1–7). */
export function countRescues(colours: readonly number[]): number[] {
  const out = Array(SPECIES_COUNT).fill(0);
  for (const c of colours) if (c >= 1 && c <= SPECIES_COUNT) out[c - 1]++;
  return out;
}
