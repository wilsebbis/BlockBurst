/**
 * The Penguin Exhibit: a calm pond with one penguin on a rubber ring. Distances are in pond widths (the pond is
 * 1 wide and as tall as the screen's aspect), so the feel is the same on every screen size.
 */
export type PenguinTrick = 'tanning' | 'lemonade';

export interface TrickClip {
  readonly trick: PenguinTrick;
  readonly name: string;
  readonly videoPath: string;
}

export interface MsRange {
  readonly min: number;
  readonly max: number;
}

export const PENGUIN_IDLE_IMAGE_PATH = '/exhibit/penguin-idle.png';

/** Each clip starts and ends in the resting pose, so it can cut in and out of the idle image. */
export const PENGUIN_TRICKS: readonly TrickClip[] = [
  { trick: 'tanning', name: 'Sunbathing with a tanning tray', videoPath: '/exhibit/penguin-tanning.mp4' },
  { trick: 'lemonade', name: 'Sipping lemonade', videoPath: '/exhibit/penguin-lemonade.mp4' },
];

export const EXHIBIT_TUNING = {
  tricks: {
    firstAfterMs: { min: 5_000, max: 9_000 },
    betweenMs: { min: 12_000, max: 26_000 },
  },
  penguin: {
    /** The ring's radius: what the walls and a grabbing finger measure against. */
    radius: 0.2,
    /** How hard a dragging finger pulls the ring towards it, per second squared. */
    dragStiffness: 90,
    /** How quickly the water slows the ring, per second. */
    waterDrag: 1.1,
    /** Extra damping while dragged, so the ring follows the finger without overshooting. */
    dragDamping: 14,
    /** Acceleration from a fully tilted phone, in pond widths per second squared. */
    tiltAcceleration: 1.6,
    maxSpeed: 1.8,
    /** The share of speed kept when the ring bounces off the pond's edge. */
    wallBounce: 0.45,
    /** A bump slower than this is a nudge, not a splash. */
    splashSpeed: 0.25,
  },
  wind: {
    /** A constant light breeze, so the pond is never still. */
    breeze: 0.012,
    gustEveryMs: { min: 6_000, max: 13_000 },
    gustDurationMs: { min: 2_500, max: 4_500 },
    /** A gust's peak push on the ring, in pond widths per second squared. */
    gustStrength: { min: 0.05, max: 0.16 },
  },
} as const;
