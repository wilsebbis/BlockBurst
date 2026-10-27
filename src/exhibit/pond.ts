/**
 * The Penguin Exhibit's pond as a pure simulation: one penguin on a rubber ring, pushed by a breeze and seeded
 * gusts, pulled by a dragging finger or a tilted phone, slowed by the water and kept inside the pond's edge.
 * Positions are in pond widths; the shell turns the events into ripples and splashes.
 */
import { EXHIBIT_TUNING } from './tuning';
import { createRng } from '../engine/rng';

export interface Vector {
  readonly x: number;
  readonly y: number;
}

export interface PondSize {
  readonly width: number;
  readonly height: number;
}

export interface Gust {
  readonly index: number;
  readonly startsAtMs: number;
  readonly durationMs: number;
  readonly force: Vector;
}

export interface PondState {
  readonly seed: string;
  readonly elapsedMs: number;
  readonly position: Vector;
  readonly velocity: Vector;
  readonly gust: Gust;
}

export interface PondInput {
  readonly dtMs: number;
  readonly size: PondSize;
  /** How far the phone is tilted on each axis, from -1 to 1. */
  readonly tilt: Vector;
  /** Where a dragging finger is, or 'none'. */
  readonly finger: Vector | 'none';
}

export type PondEdge = 'left' | 'right' | 'top' | 'bottom';

export type PondEvent = { readonly kind: 'penguin.bumped'; readonly edge: PondEdge; readonly speed: number; readonly at: Vector } | { readonly kind: 'gust.started'; readonly force: Vector };

/** A longer gap than this (a hidden tab, a slow frame) is simulated as this long, so the penguin never jumps. */
const MAX_STEP_MS = 50;
const MS_PER_SECOND = 1000;
/** Gusts blow within this angle either side of the breeze, so the weather has a prevailing direction. */
const GUST_SPREAD_RADIANS = Math.PI / 3;
const FULL_TURN = 2 * Math.PI;

export function createPond(request: { readonly seed: string; readonly size: PondSize }): PondState {
  return {
    seed: request.seed,
    elapsedMs: 0,
    position: { x: request.size.width / 2, y: request.size.height / 2 },
    velocity: { x: 0, y: 0 },
    gust: planGust({ seed: request.seed, index: 0, afterMs: 0 }),
  };
}

export function stepPond(state: PondState, input: PondInput): { readonly nextState: PondState; readonly domainEvents: PondEvent[] } {
  const dtMs = Math.min(Math.max(input.dtMs, 0), MAX_STEP_MS);
  const elapsedMs = state.elapsedMs + dtMs;
  const gust = currentGust(state, elapsedMs);
  const gustEvents: PondEvent[] = crossedGustStart({ gust, fromMs: state.elapsedMs, toMs: elapsedMs }) ? [{ kind: 'gust.started', force: gust.force }] : [];
  const moving = { ...state, elapsedMs, gust };
  const velocity = nextVelocity(moving, { input, seconds: dtMs / MS_PER_SECOND });
  const position = { x: state.position.x + (velocity.x * dtMs / MS_PER_SECOND), y: state.position.y + (velocity.y * dtMs / MS_PER_SECOND) };
  const contained = keepInside({ position, velocity }, input.size);
  return { nextState: { ...moving, position: contained.position, velocity: contained.velocity }, domainEvents: [...gustEvents, ...contained.events] };
}

/** The wind on the pond right now: the breeze plus any gust, which swells and fades over its duration. */
export function windAt(state: PondState): Vector {
  const breeze = breezeOf(state.seed);
  const { gust } = state;
  const progress = (state.elapsedMs - gust.startsAtMs) / gust.durationMs;
  const isBlowing = progress > 0 && progress < 1;
  const swell = isBlowing ? Math.sin(Math.PI * progress) ** 2 : 0;
  return { x: breeze.x + (gust.force.x * swell), y: breeze.y + (gust.force.y * swell) };
}

function nextVelocity(state: PondState, step: { readonly input: PondInput; readonly seconds: number }): Vector {
  const { penguin } = EXHIBIT_TUNING;
  const wind = windAt(state);
  const pull = fingerPull(state, step.input.finger);
  const acceleration = {
    x: wind.x + (step.input.tilt.x * penguin.tiltAcceleration) + pull.x - (penguin.waterDrag * state.velocity.x),
    y: wind.y + (step.input.tilt.y * penguin.tiltAcceleration) + pull.y - (penguin.waterDrag * state.velocity.y),
  };
  const velocity = { x: state.velocity.x + (acceleration.x * step.seconds), y: state.velocity.y + (acceleration.y * step.seconds) };
  return limitSpeed(velocity, penguin.maxSpeed);
}

/** A damped spring towards the finger, so the ring follows it closely without overshooting. */
function fingerPull(state: PondState, finger: Vector | 'none'): Vector {
  if (finger === 'none') {
    return { x: 0, y: 0 };
  }
  const { dragStiffness, dragDamping } = EXHIBIT_TUNING.penguin;
  return {
    x: (dragStiffness * (finger.x - state.position.x)) - (dragDamping * state.velocity.x),
    y: (dragStiffness * (finger.y - state.position.y)) - (dragDamping * state.velocity.y),
  };
}

function limitSpeed(velocity: Vector, maxSpeed: number): Vector {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= maxSpeed) {
    return velocity;
  }
  return { x: velocity.x * maxSpeed / speed, y: velocity.y * maxSpeed / speed };
}

interface Motion {
  readonly position: Vector;
  readonly velocity: Vector;
}

/** Clamps the ring inside the pond and bounces it off whichever edges it reached. */
function keepInside(motion: Motion, size: PondSize): Motion & { readonly events: PondEvent[] } {
  const { radius } = EXHIBIT_TUNING.penguin;
  const across = bounceOnAxis({ position: motion.position.x, velocity: motion.velocity.x, low: radius, high: size.width - radius });
  const down = bounceOnAxis({ position: motion.position.y, velocity: motion.velocity.y, low: radius, high: size.height - radius });
  const position = { x: across.position, y: down.position };
  const events: PondEvent[] = [];
  if (across.edge !== 'none') {
    pushSplash(events, { edge: across.edge === 'low' ? 'left' : 'right', speed: Math.abs(motion.velocity.x), at: position });
  }
  if (down.edge !== 'none') {
    pushSplash(events, { edge: down.edge === 'low' ? 'top' : 'bottom', speed: Math.abs(motion.velocity.y), at: position });
  }
  return { position, velocity: { x: across.velocity, y: down.velocity }, events };
}

function pushSplash(events: PondEvent[], splash: { readonly edge: PondEdge; readonly speed: number; readonly at: Vector }): void {
  if (splash.speed >= EXHIBIT_TUNING.penguin.splashSpeed) {
    events.push({ kind: 'penguin.bumped', ...splash });
  }
}

interface AxisBounce {
  readonly position: number;
  readonly velocity: number;
  readonly edge: 'low' | 'high' | 'none';
}

function bounceOnAxis(axis: { readonly position: number; readonly velocity: number; readonly low: number; readonly high: number }): AxisBounce {
  const { wallBounce } = EXHIBIT_TUNING.penguin;
  if (axis.position < axis.low) {
    return { position: axis.low, velocity: Math.abs(axis.velocity) * wallBounce, edge: 'low' };
  }
  if (axis.position > axis.high) {
    return { position: axis.high, velocity: -Math.abs(axis.velocity) * wallBounce, edge: 'high' };
  }
  return { position: axis.position, velocity: axis.velocity, edge: 'none' };
}

/** The gust in force at a moment: once one has blown itself out, the next one is planned from the seed. */
function currentGust(state: PondState, nowMs: number): Gust {
  const { gust } = state;
  const hasEnded = nowMs >= gust.startsAtMs + gust.durationMs;
  return hasEnded ? planGust({ seed: state.seed, index: gust.index + 1, afterMs: gust.startsAtMs + gust.durationMs }) : gust;
}

function crossedGustStart(span: { readonly gust: Gust; readonly fromMs: number; readonly toMs: number }): boolean {
  return span.fromMs < span.gust.startsAtMs && span.gust.startsAtMs <= span.toMs;
}

function planGust(request: { readonly seed: string; readonly index: number; readonly afterMs: number }): Gust {
  const { gustEveryMs, gustDurationMs, gustStrength } = EXHIBIT_TUNING.wind;
  const rng = createRng(`${request.seed}/gust/${request.index}`);
  const waitMs = rng.range(gustEveryMs.min, gustEveryMs.max);
  const durationMs = rng.range(gustDurationMs.min, gustDurationMs.max);
  const strength = gustStrength.min + (rng.next() * (gustStrength.max - gustStrength.min));
  const angle = breezeAngleOf(request.seed) + (((rng.next() * 2) - 1) * GUST_SPREAD_RADIANS);
  return { index: request.index, startsAtMs: request.afterMs + waitMs, durationMs, force: { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength } };
}

function breezeAngleOf(seed: string): number {
  return createRng(`${seed}/breeze`).next() * FULL_TURN;
}

function breezeOf(seed: string): Vector {
  const angle = breezeAngleOf(seed);
  const { breeze } = EXHIBIT_TUNING.wind;
  return { x: Math.cos(angle) * breeze, y: Math.sin(angle) * breeze };
}
