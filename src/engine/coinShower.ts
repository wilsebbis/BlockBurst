/**
 * The reward on a win, drawn in the Cozy style. First a treasure chest with googly eyes drops in and waits,
 * wiggling, to be tapped; then it rattles, its lid pops off in a flash of light and soft butter-gold coins (a few
 * with little faces) burst out and fall, weighed down, towards the floor. Before any of them can touch it, its
 * polarity flips: it swoops round in a U-turn just above the floor (never stopping) and is pulled up into the
 * top-right corner, faster and faster, the coins falling into step with each other as they go, until they've
 * all been gathered in a ring of sparkles. Purely visual.
 */
import { createRng } from "./rng";

const GRAVITY = 1500; // px/s², pulling the coins down
const PULL = 5600; // px/s², the reversed pull towards the corner once it has fully built up
const PULL_START = 0.55; // share of the full pull the moment the polarity flips, so the turn is a swoop, not a stop
const PULL_RAMP = 0.5; // s for the reversed pull to build to full
const SWING = 240; // px/s: the least sideways speed a coin carries through its turn
const FLIP_BY = 1.9; // s: any coin still airborne by now flips anyway
const SPARKLE_LIFE = 0.6;

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Flip phase (radians) and speed, for the coin turning over in the air. */
  spin: number;
  spinRate: number;
  /** How close to the floor it gets before its polarity flips, and when that happened. */
  nearMiss: number;
  flippedAt: number | null;
  arrived: boolean;
  hasFace: boolean;
  trail: { x: number; y: number }[];
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  size: number;
  colour: string;
}

export type CoinEvent = "burst" | "land" | "arrive" | "finale" | "rattle" | "pop";

const SPARKLE_COLOURS = ["#ffffff", "#fff3b8", "#ffd9e6", "#d6f5e8", "#e3d9ff"];

export class CoinShower {
  private coins: Coin[] = [];
  private sparkles: Sparkle[] = [];
  private t = 0;
  private finaleAt: number | null = null;
  readonly target: { x: number; y: number };
  private floor: number;

  constructor(
    private w: number,
    h: number,
    origin: { x: number; y: number },
    private onEvent: (e: CoinEvent, index: number) => void = () => {},
    seed = 1,
    count = 36,
  ) {
    const rng = createRng(seed);
    this.target = { x: w - 40, y: 44 };
    this.floor = h * 0.86;
    const r = Math.max(14, Math.min(w, h) * 0.052);
    for (let i = 0; i < count; i++) {
      // Up and out, like a pop of confetti, never straight up (so no coin hangs still at the top of its arc).
      const side = rng.next() < 0.5 ? -1 : 1;
      const a = -Math.PI / 2 + side * (0.12 + rng.next() * 0.53) * Math.PI;
      const speed = 380 + rng.next() * 520;
      this.coins.push({
        x: origin.x + (rng.next() - 0.5) * 24,
        y: origin.y + (rng.next() - 0.5) * 24,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: r * (0.8 + rng.next() * 0.4),
        spin: rng.next() * Math.PI * 2,
        spinRate: 7 + rng.next() * 9,
        nearMiss: r * (0.3 + rng.next() * 1.4),
        flippedAt: null,
        arrived: false,
        hasFace: rng.next() < 0.3,
        trail: [],
      });
    }
    for (let i = 0; i < 14; i++) this.sparkleAt(origin.x, origin.y, 260, rng.next);
    this.onEvent("burst", 0);
  }

  get done(): boolean {
    return this.finaleAt !== null && this.t - this.finaleAt >= SPARKLE_LIFE;
  }

  private sparkleAt(x: number, y: number, speed: number, rand: () => number = Math.random): void {
    const a = rand() * Math.PI * 2;
    const s = speed * (0.4 + rand() * 0.6);
    this.sparkles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: this.t, size: 3 + rand() * 4, colour: SPARKLE_COLOURS[Math.floor(rand() * SPARKLE_COLOURS.length)]! });
  }

  step(dt: number): void {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    this.coins.forEach((c, i) => {
      if (c.arrived) return;
      c.spin += c.spinRate * dt;
      const floor = this.floor + (i % 5) * 6;
      if (c.flippedAt === null) {
        // Weighed down: falling under gravity, glancing off the sides.
        c.vy += GRAVITY * dt;
        // The polarity flips just in time for the U-turn to bottom out a whisker above the floor: the distance
        // it still needs to stop its fall against the reversed pull, plus its own near-miss gap.
        const lift = PULL * PULL_START * Math.max(0.5, Math.abs(this.target.y - c.y) / Math.hypot(this.target.x - c.x, this.target.y - c.y));
        const stopping = c.vy > 0 ? (c.vy * c.vy) / (2 * lift) : 0;
        if (c.y + stopping * 1.15 >= floor - c.r * 1.5 - c.nearMiss || this.t >= FLIP_BY) {
          c.flippedAt = this.t;
          // A sideways swing towards the corner, so the U-turn is a swoop that never comes to a stop.
          const towards = Math.sign(this.target.x - c.x) || 1;
          if (c.vx * towards < SWING) c.vx = towards * SWING;
          this.onEvent("land", i);
        }
      } else {
        // Reversed: a pull towards the corner that builds up fast, easing the fall to a stop first. Sideways drift
        // across the pull is damped, so the coins swoop rather than orbit.
        const dx = this.target.x - c.x;
        const dy = this.target.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const k = Math.min(1, (this.t - c.flippedAt) / PULL_RAMP);
        const pull = PULL * (PULL_START + (1 - PULL_START) * k * k);
        c.vx += ux * pull * dt;
        c.vy += uy * pull * dt;
        // Harmony: drift across the pull is damped harder the longer the coin has been flying home, so the
        // coins fall into line as one stream.
        const along = c.vx * ux + c.vy * uy;
        const damp = Math.exp(-(2 + 9 * k) * dt);
        c.vx = ux * along + (c.vx - ux * along) * damp;
        c.vy = uy * along + (c.vy - uy * along) * damp;
        const step = Math.hypot(c.vx, c.vy) * dt;
        if (dist <= Math.max(c.r * 0.6, step) || this.t - c.flippedAt > 3) {
          c.arrived = true;
          for (let s = 0; s < 3; s++) this.sparkleAt(this.target.x, this.target.y, 140);
          this.onEvent("arrive", i);
          return;
        }
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < c.r || c.x > this.w - c.r) {
        c.vx *= -0.6;
        c.x = Math.max(c.r, Math.min(this.w - c.r, c.x));
      }
      c.trail.push({ x: c.x, y: c.y });
      if (c.trail.length > (c.flippedAt === null ? 5 : 8)) c.trail.shift();
    });
    const allIn = this.coins.every((c) => c.arrived);
    if (allIn && this.finaleAt === null) {
      this.finaleAt = this.t;
      for (let s = 0; s < 16; s++) {
        const a = (s / 16) * Math.PI * 2;
        this.sparkles.push({ x: this.target.x, y: this.target.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, born: this.t, size: 4, colour: SPARKLE_COLOURS[s % SPARKLE_COLOURS.length]! });
      }
      this.onEvent("finale", 0);
    }
    for (const s of this.sparkles) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.92;
      s.vy *= 0.92;
    }
    this.sparkles = this.sparkles.filter((s) => this.t - s.born < SPARKLE_LIFE);
  }

  /** Where every coin still in flight is and how fast it's going (for tests). */
  get inFlight(): { y: number; speed: number; floor: number }[] {
    return this.coins.flatMap((c, i) => (c.arrived ? [] : [{ y: c.y + c.r, speed: Math.hypot(c.vx, c.vy), floor: this.floor + (i % 5) * 6 }]));
  }

  /** How many coins have reached the corner. */
  get collected(): number {
    return this.coins.filter((c) => c.arrived).length;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // A soft glow where the coins are collected, swelling as they arrive.
    const filled = this.collected / this.coins.length;
    if (filled > 0) {
      const g = ctx.createRadialGradient(this.target.x, this.target.y, 0, this.target.x, this.target.y, 30 + filled * 30);
      g.addColorStop(0, `rgba(255,236,170,${0.25 + filled * 0.45})`);
      g.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(this.target.x - 70, this.target.y - 70, 140, 140);
    }
    for (const c of this.coins) {
      if (c.arrived) continue;
      if (c.trail.length > 1) {
        ctx.strokeStyle = "rgba(255,250,232,0.45)";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = c.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(c.trail[0]!.x, c.trail[0]!.y);
        for (const p of c.trail) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      // Its shadow on the floor darkens as it nears, so you can see how close it came.
      const floor = this.floor + (this.coins.indexOf(c) % 5) * 6;
      const near = 1 - Math.min(1, Math.max(0, (floor - c.y) / (this.floor * 0.35)));
      if (near > 0) {
        ctx.fillStyle = `rgba(120,80,40,${0.22 * near})`;
        ctx.beginPath();
        ctx.ellipse(c.x, floor + c.r, c.r * (0.5 + near * 0.4), c.r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawCoin(ctx, c.x, c.y, c.r, Math.cos(c.spin), c.hasFace);
    }
    for (const s of this.sparkles) {
      const k = 1 - (this.t - s.born) / SPARKLE_LIFE;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = s.colour;
      const z = s.size * (0.5 + k * 0.5);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - z * 2);
      ctx.quadraticCurveTo(s.x, s.y, s.x + z * 2, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + z * 2);
      ctx.quadraticCurveTo(s.x, s.y, s.x - z * 2, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - z * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * One coin in the Cozy style: a soft butter-gold disc with a deeper rim and a pillowy shine, squashed sideways
 * as it flips (`turn` is -1..1; near 0 it shows its edge). A few wear a happy little face.
 */
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number, hasFace: boolean): void {
  const sx = Math.max(0.12, Math.abs(turn));
  ctx.save();
  ctx.translate(x, y);
  // The edge, peeking out on the side the coin is turning towards.
  ctx.fillStyle = "#e3a842";
  ctx.beginPath();
  ctx.ellipse(Math.sign(turn || 1) * r * 0.12 * (1 - sx), r * 0.08, r * sx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createLinearGradient(0, -r, 0, r);
  face.addColorStop(0, "#fde39a");
  face.addColorStop(1, "#f5c45a");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * sx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(214,150,50,0.55)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * sx * 0.72, r * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.32 * sx, -r * 0.4, r * 0.22 * sx, r * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();
  if (sx > 0.55) {
    ctx.scale(sx, 1);
    if (hasFace) {
      ctx.fillStyle = "#4a3a33";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * r * 0.2, -r * 0.05, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#4a3a33";
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, r * 0.08, r * 0.14, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.fillStyle = "rgba(240,140,140,0.45)";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * r * 0.36, r * 0.12, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // An embossed little star.
      ctx.fillStyle = "rgba(214,150,50,0.5)";
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const rad = k % 2 ? r * 0.15 : r * 0.34;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

const SHAKE = 0.35; // s of rattling between the tap and the lid popping
const DROP = 0.45; // s for the chest to drop in

/**
 * The treasure chest that holds the coin shower. It waits to be tapped (`open()`), rattles, pops its lid and
 * hands over to a CoinShower bursting from its mouth, then fades away while the coins fly.
 */
export class TreasureChest {
  private t = 0;
  private openedAt: number | null = null;
  private shower: CoinShower | null = null;
  readonly x: number;
  readonly y: number;
  readonly size: number;

  constructor(
    private w: number,
    private h: number,
    private onEvent: (e: CoinEvent, index: number) => void = () => {},
    private seed = 1,
    place?: { x: number; y: number; size: number },
  ) {
    this.x = place?.x ?? w / 2;
    this.y = place?.y ?? h * 0.42;
    this.size = place?.size ?? Math.min(150, Math.min(w, h) * 0.34);
  }

  /** Where a tap opens it, in CSS pixels. */
  get hitBox(): { left: number; top: number; width: number; height: number } {
    const s = this.size;
    return { left: this.x - s * 0.7, top: this.y - s * 0.75, width: s * 1.4, height: s * 1.4 };
  }

  get isOpen(): boolean {
    return this.openedAt !== null;
  }

  /** Seconds since the lid popped and the coins burst out, or null before that. */
  get sincePop(): number | null {
    return this.openedAt === null || this.t - this.openedAt < SHAKE ? null : this.t - this.openedAt - SHAKE;
  }

  open(): void {
    if (this.openedAt !== null) return;
    this.openedAt = this.t;
    this.onEvent("rattle", 0);
  }

  get done(): boolean {
    return this.shower?.done ?? false;
  }

  /** Coins that have reached the corner so far, out of `coinCount`. */
  get collected(): number {
    return this.shower?.collected ?? 0;
  }

  readonly coinCount = 36;

  step(dt: number): void {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    if (this.openedAt !== null && !this.shower && this.t - this.openedAt >= SHAKE) {
      this.onEvent("pop", 0);
      this.shower = new CoinShower(this.w, this.h, { x: this.x, y: this.y - this.size * 0.12 }, this.onEvent, this.seed);
    }
    this.shower?.step(dt);
  }

  draw(ctx: CanvasRenderingContext2D, still = false): void {
    const s = this.size;
    const since = this.openedAt === null ? 0 : this.t - this.openedAt;
    const popped = this.openedAt !== null && since >= SHAKE;
    const after = popped ? since - SHAKE : 0;
    // The chest drops in with a little bounce, then fades and shrinks away once the coins are out.
    const drop = still ? 1 : Math.min(1, this.t / DROP);
    const bounce = drop < 1 ? (1 - drop) * (1 - drop) * -s * 1.2 + Math.sin(drop * Math.PI) * s * 0.06 : 0;
    const fade = popped ? Math.max(0, 1 - Math.max(0, after - 0.4) / 0.4) : 1;
    if (fade > 0) {
      ctx.save();
      ctx.globalAlpha = fade;
      const idleBob = still || this.openedAt !== null ? 0 : Math.sin(this.t * 3) * s * 0.02;
      ctx.translate(this.x, this.y + bounce + idleBob);
      const shrink = popped ? 1 - Math.max(0, after - 0.4) * 0.4 : 1;
      ctx.scale(shrink, shrink);
      // Wiggles now and then while it waits; rattles harder and harder once tapped.
      let tilt = 0;
      if (!still && this.openedAt === null) tilt = (this.t % 1.8) < 0.4 ? Math.sin(((this.t % 1.8) / 0.4) * Math.PI * 4) * 0.06 : 0;
      if (!still && this.openedAt !== null && !popped) tilt = Math.sin(since * 70) * 0.05 * (1 + since / SHAKE);
      ctx.rotate(tilt);
      // Light pouring out of the open chest.
      if (popped) {
        const k = Math.max(0, 1 - after / 0.8);
        const g = ctx.createRadialGradient(0, -s * 0.15, 0, 0, -s * 0.15, s * (0.8 + after));
        g.addColorStop(0, `rgba(255,246,200,${0.9 * k})`);
        g.addColorStop(1, "rgba(255,246,200,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
      } else if (!still) {
        // A soft glow underneath while it waits, pulsing gently.
        const g = ctx.createRadialGradient(0, s * 0.1, 0, 0, s * 0.1, s * 0.9);
        g.addColorStop(0, `rgba(255,236,170,${0.35 + Math.sin(this.t * 4) * 0.1})`);
        g.addColorStop(1, "rgba(255,236,170,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-s, -s, s * 2, s * 2);
      }
      const lid = popped ? Math.min(1, after / 0.5) : 0;
      drawChest(ctx, s, { lid, happy: this.openedAt !== null, t: still ? 0 : this.t });
      ctx.restore();
      if (this.openedAt === null && !still) {
        // "Tap!" bobbing under it.
        ctx.save();
        ctx.font = `800 ${Math.round(s * 0.16)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = s * 0.05;
        ctx.strokeStyle = "rgba(255,251,247,0.95)";
        const ty = this.y + s * 0.62 + Math.sin(this.t * 5) * 3;
        ctx.globalAlpha = drop;
        ctx.strokeText("Tap to open!", this.x, ty);
        ctx.fillStyle = "#6b5448";
        ctx.fillText("Tap to open!", this.x, ty);
        ctx.restore();
      }
    }
    this.shower?.draw(ctx);
  }
}

/**
 * A chest in the Cozy style, centred on (0, 0) and `s` wide: warm wood planks, butter-gold straps, a heart lock
 * and a pair of googly eyes peeking out over it. `lid` (0..1) blows the lid up and away; `happy` squints the eyes.
 */
export function drawChest(ctx: CanvasRenderingContext2D, s: number, o: { lid: number; happy: boolean; t: number }): void {
  const w = s;
  const bodyTop = -s * 0.12;
  const bodyH = s * 0.5;
  // Body.
  ctx.fillStyle = "rgba(120,80,40,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, bodyTop + bodyH + s * 0.04, w * 0.52, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e5b487";
  ctx.beginPath();
  ctx.roundRect(-w / 2, bodyTop, w, bodyH, s * 0.08);
  ctx.fill();
  ctx.strokeStyle = "rgba(160,100,55,0.3)";
  ctx.lineWidth = Math.max(1, s * 0.015);
  for (const k of [0.36, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + s * 0.04, bodyTop + bodyH * k);
    ctx.lineTo(w / 2 - s * 0.04, bodyTop + bodyH * k);
    ctx.stroke();
  }
  // Inside of the chest, glowing gold once the lid is off.
  if (o.lid > 0) {
    ctx.fillStyle = "#fbe7a6";
    ctx.beginPath();
    ctx.ellipse(0, bodyTop, w * 0.46, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gold straps.
  ctx.fillStyle = "#f5c45a";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * w * 0.32 - s * 0.05, bodyTop, s * 0.1, bodyH, s * 0.03);
    ctx.fill();
  }
  // Heart lock.
  ctx.fillStyle = "#f5c45a";
  ctx.beginPath();
  ctx.roundRect(-s * 0.09, bodyTop - s * 0.02, s * 0.18, s * 0.2, s * 0.05);
  ctx.fill();
  ctx.fillStyle = "#ef8f86";
  const hy = bodyTop + s * 0.08;
  const hs = s * 0.045;
  ctx.beginPath();
  ctx.moveTo(0, hy + hs);
  ctx.bezierCurveTo(-hs * 1.4, hy, -hs * 0.7, hy - hs * 1.2, 0, hy - hs * 0.4);
  ctx.bezierCurveTo(hs * 0.7, hy - hs * 1.2, hs * 1.4, hy, 0, hy + hs);
  ctx.fill();
  // Googly eyes on the front, under the lid.
  const ey = bodyTop + bodyH * 0.6;
  for (const side of [-1, 1]) {
    const ex = side * s * 0.15;
    if (o.happy) {
      ctx.strokeStyle = "#4a3a33";
      ctx.lineWidth = Math.max(1.5, s * 0.025);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(ex, ey + s * 0.02, s * 0.045, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.065, 0, Math.PI * 2);
    ctx.fill();
    const look = Math.sin(o.t * 1.3) * s * 0.015;
    ctx.fillStyle = "#3d302a";
    ctx.beginPath();
    ctx.arc(ex + look, ey + s * 0.01, s * 0.042, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex + look - s * 0.014, ey - s * 0.004, s * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lid: a rounded dome that blows up and spins away.
  ctx.save();
  if (o.lid > 0) {
    ctx.translate(o.lid * s * 0.5, -o.lid * s * 1.1);
    ctx.rotate(o.lid * 0.9);
    ctx.globalAlpha *= 1 - o.lid;
  }
  ctx.fillStyle = "#eabf94";
  ctx.beginPath();
  ctx.moveTo(-w / 2, bodyTop);
  ctx.lineTo(-w / 2, bodyTop - s * 0.12);
  ctx.quadraticCurveTo(-w / 2, bodyTop - s * 0.36, 0, bodyTop - s * 0.36);
  ctx.quadraticCurveTo(w / 2, bodyTop - s * 0.36, w / 2, bodyTop - s * 0.12);
  ctx.lineTo(w / 2, bodyTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.18, bodyTop - s * 0.27, w * 0.16, s * 0.04, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5c45a";
  ctx.beginPath();
  ctx.roundRect(-w / 2 - s * 0.01, bodyTop - s * 0.045, w + s * 0.02, s * 0.06, s * 0.03);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * w * 0.32 - s * 0.05, bodyTop - s * 0.33, s * 0.1, s * 0.3, s * 0.03);
    ctx.fill();
  }
  ctx.restore();
}
