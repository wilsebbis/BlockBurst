/**
 * Paints the Penguin Exhibit: a bright cartoon pool with soft light, drifting wave marks, ice floes, ripples,
 * petals and wind swirls, and the penguin bobbing on its ring. Pond units are scaled so the pond is the canvas's
 * width; everything here is drawing, and nothing here changes state.
 */
import { EXHIBIT_TUNING } from './tuning';
import type { PondState, Vector } from './pond';
import { SPRITE_RING, SPRITE_SIZE } from './penguinSprite';
import { DROPLET_LIFE_MS, SWIRL_LIFE_MS, type Drifter, type PondScene, type Ripple, type Swirl } from './pondScene';

export interface PondView {
  readonly context: CanvasRenderingContext2D;
  /** CSS pixels per pond width: the canvas's width. */
  readonly scale: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface PondFrame {
  readonly pond: PondState;
  readonly wind: Vector;
  readonly scene: PondScene;
  readonly penguin: CanvasImageSource | 'loading';
  readonly isCalm: boolean;
}

const COLORS = {
  waterTop: '#aeeef6',
  waterBottom: '#58c3dc',
  light: 'rgba(255, 255, 255, 0.10)',
  waveMark: 'rgba(255, 255, 255, 0.55)',
  ripple: '#ffffff',
  rim: '#f2fdff',
  rimShadow: 'rgba(40, 150, 180, 0.45)',
  floeTop: '#ffffff',
  floeSide: '#bfe6f3',
  petal: '#ffb9d2',
  petalVein: '#ff93b8',
  shadow: 'rgba(16, 82, 110, 0.26)',
  foam: 'rgba(255, 255, 255, 0.6)',
  swirl: 'rgba(255, 255, 255, 0.85)',
  droplet: '#ffffff',
} as const;

/** The ring is seen from above at an angle, so circles on the water are squashed to this height. */
const WATER_ASPECT = 0.64;
const MS_PER_SECOND = 1000;
const RIM_WIDTH_PX = 12;
const LIGHT_BLOBS = 6;
const BOB = { rate: 1.7, lively: 3.5, calm: 1.5 } as const;
/** How much the penguin leans into its drift, and how far it can lean, in radians. */
const LEAN = { perSpeed: 0.22, max: 0.2, sway: 0.025 } as const;
const WAVE_MARK_WIDTH = 0.05;
const FLOE_SIZE = 0.075;
const PETAL_SIZE = { length: 0.016, width: 0.009 } as const;
const SWIRL = { travel: 1.7, tail: 0.28, curl: 0.03, widthPx: 3 } as const;
const FLOE_SHAPE: readonly Vector[] = [{ x: -1, y: -0.3 }, { x: -0.55, y: -0.8 }, { x: 0.4, y: -0.75 }, { x: 1, y: -0.15 }, { x: 0.7, y: 0.6 }, { x: -0.3, y: 0.75 }, { x: -0.95, y: 0.35 }];

export function paintPond(view: PondView, frame: PondFrame): void {
  const seconds = frame.pond.elapsedMs / MS_PER_SECOND;
  paintWater(view, seconds);
  paintWaveMarks(view, { marks: frame.scene.waveMarks, seconds });
  paintFloes(view, { floes: frame.scene.floes, seconds });
  paintRipples(view, { ripples: frame.scene.ripples, nowMs: frame.pond.elapsedMs });
  paintPenguin(view, frame);
  paintDroplets(view, frame);
  paintPetals(view, { petals: frame.scene.petals, seconds });
  paintSwirls(view, { swirls: frame.scene.swirls, nowMs: frame.pond.elapsedMs });
  paintRim(view);
}

function paintWater(view: PondView, seconds: number): void {
  const { context, widthPx, heightPx } = view;
  const water = context.createLinearGradient(0, 0, 0, heightPx);
  water.addColorStop(0, COLORS.waterTop);
  water.addColorStop(1, COLORS.waterBottom);
  context.fillStyle = water;
  context.fillRect(0, 0, widthPx, heightPx);
  context.fillStyle = COLORS.light;
  for (let blob = 0; blob < LIGHT_BLOBS; blob += 1) {
    const x = widthPx * (0.5 + (0.45 * Math.sin((seconds * 0.07) + (blob * 1.9))));
    const y = heightPx * (0.5 + (0.45 * Math.cos((seconds * 0.05) + (blob * 2.6))));
    context.beginPath();
    context.ellipse(x, y, widthPx * 0.28, widthPx * 0.28 * WATER_ASPECT, 0, 0, 2 * Math.PI);
    context.fill();
  }
}

/** Cartoon wave marks: two small arcs side by side, gently bobbing. */
function paintWaveMarks(view: PondView, marks: { readonly marks: readonly Drifter[]; readonly seconds: number }): void {
  const { context, scale } = view;
  context.strokeStyle = COLORS.waveMark;
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  for (const mark of marks.marks) {
    const halfWidth = WAVE_MARK_WIDTH * mark.size * scale / 4;
    const x = mark.at.x * scale;
    const y = (mark.at.y * scale) + (2 * Math.sin((marks.seconds * 1.3) + mark.phase));
    context.beginPath();
    context.arc(x - halfWidth, y, halfWidth, 0.15 * Math.PI, 0.85 * Math.PI);
    context.moveTo(x + (halfWidth * 2 * Math.cos(0.15 * Math.PI)), y + (halfWidth * Math.sin(0.15 * Math.PI)));
    context.arc(x + halfWidth, y, halfWidth, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
  }
}

function paintFloes(view: PondView, floes: { readonly floes: readonly Drifter[]; readonly seconds: number }): void {
  for (const floe of floes.floes) {
    const size = FLOE_SIZE * floe.size * view.scale;
    const centre = { x: floe.at.x * view.scale, y: (floe.at.y * view.scale) + (1.5 * Math.sin((floes.seconds * 0.9) + floe.phase)) };
    traceFloe(view.context, { centre: { x: centre.x, y: centre.y + 4 }, size });
    view.context.fillStyle = COLORS.floeSide;
    view.context.fill();
    traceFloe(view.context, { centre, size });
    view.context.fillStyle = COLORS.floeTop;
    view.context.fill();
  }
}

function traceFloe(context: CanvasRenderingContext2D, floe: { readonly centre: Vector; readonly size: number }): void {
  context.beginPath();
  for (const corner of FLOE_SHAPE) {
    context.lineTo(floe.centre.x + (corner.x * floe.size), floe.centre.y + (corner.y * floe.size * WATER_ASPECT));
  }
  context.closePath();
}

function paintRipples(view: PondView, ripples: { readonly ripples: readonly Ripple[]; readonly nowMs: number }): void {
  const { context, scale } = view;
  context.strokeStyle = COLORS.ripple;
  for (const ripple of ripples.ripples) {
    const age = (ripples.nowMs - ripple.bornMs) / ripple.lifeMs;
    const radius = ripple.maxRadius * Math.sqrt(age) * scale;
    context.globalAlpha = Math.max(0, (1 - age) * ripple.strength);
    context.lineWidth = 1 + (2 * (1 - age));
    context.beginPath();
    context.ellipse(ripple.at.x * scale, ripple.at.y * scale, radius, radius * WATER_ASPECT, 0, 0, 2 * Math.PI);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function paintPenguin(view: PondView, frame: PondFrame): void {
  const { context, scale } = view;
  const seconds = frame.pond.elapsedMs / MS_PER_SECOND;
  const ringRadius = EXHIBIT_TUNING.penguin.radius * scale;
  const centre = { x: frame.pond.position.x * scale, y: frame.pond.position.y * scale };
  const bob = Math.sin(seconds * BOB.rate) * (frame.isCalm ? BOB.calm : BOB.lively);
  context.fillStyle = COLORS.shadow;
  context.beginPath();
  context.ellipse(centre.x + 5, centre.y + 10, ringRadius * 1.02, ringRadius * WATER_ASPECT, 0, 0, 2 * Math.PI);
  context.fill();
  context.strokeStyle = COLORS.foam;
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(centre.x, centre.y + 6, ringRadius * (1.05 + (0.02 * Math.sin(seconds * 2.3))), ringRadius * WATER_ASPECT * 1.05, 0, 0, 2 * Math.PI);
  context.stroke();
  if (frame.penguin === 'loading') {
    return;
  }
  const lean = Math.max(-LEAN.max, Math.min(LEAN.max, frame.pond.velocity.x * LEAN.perSpeed)) + (LEAN.sway * Math.sin(seconds * 0.9));
  const spriteScale = ringRadius / SPRITE_RING.halfWidth;
  context.save();
  context.translate(centre.x, centre.y + bob);
  context.rotate(lean);
  context.drawImage(frame.penguin, -SPRITE_RING.centreX * spriteScale, -SPRITE_RING.centreY * spriteScale, SPRITE_SIZE.width * spriteScale, SPRITE_SIZE.height * spriteScale);
  context.restore();
}

function paintDroplets(view: PondView, frame: PondFrame): void {
  const { context, scale } = view;
  context.fillStyle = COLORS.droplet;
  for (const droplet of frame.scene.droplets) {
    const age = (frame.pond.elapsedMs - droplet.bornMs) / DROPLET_LIFE_MS;
    context.globalAlpha = Math.max(0, 1 - age);
    context.beginPath();
    context.arc(droplet.at.x * scale, droplet.at.y * scale, 2.5 + (1.5 * (1 - age)), 0, 2 * Math.PI);
    context.fill();
  }
  context.globalAlpha = 1;
}

function paintPetals(view: PondView, petals: { readonly petals: readonly Drifter[]; readonly seconds: number }): void {
  const { context, scale } = view;
  for (const petal of petals.petals) {
    context.save();
    context.translate(petal.at.x * scale, petal.at.y * scale);
    context.rotate(petal.phase + (petals.seconds * 0.6));
    context.fillStyle = COLORS.petal;
    context.beginPath();
    context.ellipse(0, 0, PETAL_SIZE.length * petal.size * scale, PETAL_SIZE.width * petal.size * scale, 0, 0, 2 * Math.PI);
    context.fill();
    context.strokeStyle = COLORS.petalVein;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(-PETAL_SIZE.length * petal.size * scale * 0.6, 0);
    context.lineTo(PETAL_SIZE.length * petal.size * scale * 0.6, 0);
    context.stroke();
    context.restore();
  }
}

/** A cartoon gust: a streak racing downwind that ends in a little curl, fading in and out. */
function paintSwirls(view: PondView, swirls: { readonly swirls: readonly Swirl[]; readonly nowMs: number }): void {
  const { context, scale } = view;
  context.strokeStyle = COLORS.swirl;
  context.lineWidth = SWIRL.widthPx;
  context.lineCap = 'round';
  for (const swirl of swirls.swirls) {
    const progress = (swirls.nowMs - swirl.bornMs) / SWIRL_LIFE_MS;
    const isVisible = progress > 0 && progress < 1;
    if (!isVisible) {
      continue;
    }
    const head = { x: swirl.from.x + (swirl.direction.x * SWIRL.travel * progress), y: swirl.from.y + (swirl.direction.y * SWIRL.travel * progress) };
    const tail = { x: head.x - (swirl.direction.x * SWIRL.tail), y: head.y - (swirl.direction.y * SWIRL.tail) };
    const heading = Math.atan2(swirl.direction.y, swirl.direction.x);
    context.globalAlpha = Math.sin(Math.PI * progress) * 0.8;
    context.beginPath();
    context.moveTo(tail.x * scale, tail.y * scale);
    context.lineTo(head.x * scale, head.y * scale);
    context.arc((head.x * scale) - (Math.sin(heading) * SWIRL.curl * scale), (head.y * scale) + (Math.cos(heading) * SWIRL.curl * scale), SWIRL.curl * scale, heading - (Math.PI / 2), heading + (Math.PI * 1.2));
    context.stroke();
  }
  context.globalAlpha = 1;
}

/** An icy pool edge, so a bump against the side reads as the ring touching the rim. */
function paintRim(view: PondView): void {
  const { context, widthPx, heightPx } = view;
  context.lineWidth = RIM_WIDTH_PX;
  context.strokeStyle = COLORS.rim;
  context.strokeRect(RIM_WIDTH_PX / 2, RIM_WIDTH_PX / 2, widthPx - RIM_WIDTH_PX, heightPx - RIM_WIDTH_PX);
  context.lineWidth = 3;
  context.strokeStyle = COLORS.rimShadow;
  context.strokeRect(RIM_WIDTH_PX + 1.5, RIM_WIDTH_PX + 1.5, widthPx - (2 * RIM_WIDTH_PX) - 3, heightPx - (2 * RIM_WIDTH_PX) - 3);
}
