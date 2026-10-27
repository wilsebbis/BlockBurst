/**
 * Everything on the pond that is only for looks: ripples, splash droplets, wave marks, drifting ice floes, petals
 * and wind swirls. It moves with the simulation's wind but never feeds back into it. Positions are in pond widths.
 */
import type { Vector } from './pond';
import { createRng, type Rng } from '../engine/rng';

export interface Ripple {
  readonly at: Vector;
  readonly bornMs: number;
  readonly lifeMs: number;
  readonly maxRadius: number;
  readonly strength: number;
}

export interface Droplet {
  readonly at: Vector;
  readonly velocity: Vector;
  readonly bornMs: number;
}

export interface Drifter {
  readonly at: Vector;
  /** Around 1: how much bigger or smaller than usual this one is. */
  readonly size: number;
  readonly phase: number;
  /** How strongly the wind carries it: petals fly, ice floes barely move. */
  readonly windShare: number;
}

export interface Swirl {
  readonly from: Vector;
  readonly bornMs: number;
  readonly direction: Vector;
}

export const RIPPLE_LIFE_MS = 1_800;
export const DROPLET_LIFE_MS = 650;
export const SWIRL_LIFE_MS = 2_400;
const DROPLET_GRAVITY = 1.4;
const WAVE_MARKS = { calm: 14, lively: 26 } as const;
const PETALS = { calm: 4, lively: 10 } as const;
const ICE_FLOES = 3;
const WIND_SHARE = { waveMark: 0.25, petal: 1, floe: 0.08 } as const;
/** Wind is a gentle force; drifters show it at this many times its strength so it reads as moving air. */
const WIND_TO_DRIFT = 6;
/** Even with no wind, the water flows this fast, so the wave marks always drift. */
const BASE_FLOW = { x: 0.004, y: 0.006 };
const MAX_RIPPLES = 40;
/** A splash's look, scaled by its strength (0–1): how big its ring grows and how many droplets fly. */
const SPLASH = { ringRadius: 0.16, extraRingRadius: 0.1, ringStrength: 0.5, droplets: 5, extraDroplets: 6, dropletSpeed: 0.15, extraDropletSpeed: 0.25, upwardThrow: 0.35 } as const;
/** Gust swirls: how many, how far apart they start, and how far upwind of the pond they start from. */
const SWIRLS = { count: 3, delayMs: 350, upwind: 0.8, spread: 0.6 } as const;
/** Drifters vary in size by up to this share either way. */
const SIZE_VARIETY = 0.3;
const MAX_DROPLETS = 60;
/** How far past the edge a drifter goes before it comes back on the other side. */
const WRAP_MARGIN = 0.1;

export class PondScene {
  readonly ripples: Ripple[] = [];
  readonly droplets: Droplet[] = [];
  readonly swirls: Swirl[] = [];
  readonly waveMarks: Drifter[];
  readonly petals: Drifter[];
  readonly floes: Drifter[];
  private readonly rng: Rng;

  constructor(private readonly setup: { readonly seed: string; readonly size: Vector; readonly isCalm: boolean }) {
    this.rng = createRng(`${setup.seed}/scene`);
    this.waveMarks = this.scatter({ count: setup.isCalm ? WAVE_MARKS.calm : WAVE_MARKS.lively, windShare: WIND_SHARE.waveMark });
    this.petals = this.scatter({ count: setup.isCalm ? PETALS.calm : PETALS.lively, windShare: WIND_SHARE.petal });
    this.floes = this.scatter({ count: ICE_FLOES, windShare: WIND_SHARE.floe });
  }

  /** Moves everything along by `seconds` of wind and flow, and drops what has faded. */
  advance(step: { readonly nowMs: number; readonly seconds: number; readonly wind: Vector; readonly size: Vector }): void {
    const drift = { x: BASE_FLOW.x + (step.wind.x * WIND_TO_DRIFT), y: BASE_FLOW.y + (step.wind.y * WIND_TO_DRIFT) };
    const moves = { drift, seconds: step.seconds, size: step.size };
    replaceAll(this.waveMarks, this.waveMarks.map((mark) => carry(mark, moves)));
    replaceAll(this.petals, this.petals.map((petal) => carry(petal, moves)));
    replaceAll(this.floes, this.floes.map((floe) => carry(floe, moves)));
    replaceAll(this.droplets, this.droplets.filter((droplet) => step.nowMs - droplet.bornMs < DROPLET_LIFE_MS).map((droplet) => fall(droplet, step.seconds)));
    replaceAll(this.ripples, this.ripples.filter((ripple) => step.nowMs - ripple.bornMs < ripple.lifeMs));
    replaceAll(this.swirls, this.swirls.filter((swirl) => step.nowMs - swirl.bornMs < SWIRL_LIFE_MS));
  }

  addRipple(ripple: Ripple): void {
    this.ripples.push(ripple);
    trimOldest(this.ripples, MAX_RIPPLES);
  }

  /** A splash: a strong ripple and a spray of droplets thrown up and away. */
  splash(splash: { readonly at: Vector; readonly nowMs: number; readonly strength: number }): void {
    const ringRadius = SPLASH.ringRadius + (SPLASH.extraRingRadius * splash.strength);
    this.addRipple({ at: splash.at, bornMs: splash.nowMs, lifeMs: RIPPLE_LIFE_MS, maxRadius: ringRadius, strength: SPLASH.ringStrength + ((1 - SPLASH.ringStrength) * splash.strength) });
    if (this.setup.isCalm) {
      return;
    }
    const count = SPLASH.droplets + Math.round(SPLASH.extraDroplets * splash.strength);
    for (let index = 0; index < count; index += 1) {
      const angle = this.rng.next() * 2 * Math.PI;
      const speed = SPLASH.dropletSpeed + (this.rng.next() * SPLASH.extraDropletSpeed * (1 + splash.strength));
      this.droplets.push({ at: splash.at, velocity: { x: Math.cos(angle) * speed, y: (Math.sin(angle) * speed) - SPLASH.upwardThrow }, bornMs: splash.nowMs });
    }
    trimOldest(this.droplets, MAX_DROPLETS);
  }

  /** A gust arriving: a few cartoon wind swirls race across the pond the way it blows. */
  gust(gust: { readonly force: Vector; readonly nowMs: number }): void {
    if (this.setup.isCalm) {
      return;
    }
    const length = Math.hypot(gust.force.x, gust.force.y);
    const direction = { x: gust.force.x / length, y: gust.force.y / length };
    const centre = { x: 0.5, y: this.setup.size.y / 2 };
    for (let index = 0; index < SWIRLS.count; index += 1) {
      const offset = (this.rng.next() - 0.5) * SWIRLS.spread;
      const from = { x: centre.x - (direction.x * SWIRLS.upwind) - (direction.y * offset), y: centre.y - (direction.y * SWIRLS.upwind) + (direction.x * offset) };
      this.swirls.push({ from, bornMs: gust.nowMs + (index * SWIRLS.delayMs), direction });
    }
  }

  private scatter(spec: { readonly count: number; readonly windShare: number }): Drifter[] {
    const drifters: Drifter[] = [];
    for (let index = 0; index < spec.count; index += 1) {
      const at = { x: this.rng.next(), y: this.rng.next() * this.setup.size.y };
      const sizeScale = 1 - SIZE_VARIETY + (this.rng.next() * 2 * SIZE_VARIETY);
      drifters.push({ at, size: sizeScale, phase: this.rng.next() * 2 * Math.PI, windShare: spec.windShare });
    }
    return drifters;
  }
}

function carry(drifter: Drifter, moves: { readonly drift: Vector; readonly seconds: number; readonly size: Vector }): Drifter {
  const x = drifter.at.x + (moves.drift.x * drifter.windShare * moves.seconds);
  const y = drifter.at.y + (moves.drift.y * drifter.windShare * moves.seconds);
  return { ...drifter, at: { x: wrap(x, moves.size.x), y: wrap(y, moves.size.y) } };
}

function fall(droplet: Droplet, seconds: number): Droplet {
  const velocity = { x: droplet.velocity.x, y: droplet.velocity.y + (DROPLET_GRAVITY * seconds) };
  return { ...droplet, velocity, at: { x: droplet.at.x + (velocity.x * seconds), y: droplet.at.y + (velocity.y * seconds) } };
}

/** Wraps a position into [−margin, span + margin), so drifters leave one edge and come back at the other. */
function wrap(position: number, span: number): number {
  const range = span + (2 * WRAP_MARGIN);
  return ((((position + WRAP_MARGIN) % range) + range) % range) - WRAP_MARGIN;
}

function replaceAll<Item>(items: Item[], next: readonly Item[]): void {
  items.splice(0, items.length, ...next);
}

function trimOldest<Item>(items: Item[], limit: number): void {
  if (items.length > limit) {
    items.splice(0, items.length - limit);
  }
}
