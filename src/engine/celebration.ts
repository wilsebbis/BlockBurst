/**
 * The win celebration, in the Cozy style, in beats like the big puzzle games' reward screens:
 *
 *   1. the game's name bounces in letter by letter (the "o" has googly eyes),
 *   2. a banner pops ("Well done!", "Perfect!", "New best!"),
 *   3. a card rises with a ribbon naming the level,
 *   4. its stars land one by one on a plump cushion (a crown for a new best), each with a sparkle,
 *   5. a treasure chest drops in and waits to be tapped; it bursts into coins that fly to a coin counter in the
 *      corner, which ticks up "+N" as they arrive.
 *
 * Purely visual: the coins and stars shown were already earned when the game was recorded.
 */
import { TreasureChest, type CoinEvent } from "./coinShower";
import { clamp01, DISPLAY_FONT, drawLogo, easeOutBack, LOGO, shade } from "./logo";

const INK = "#6b5448";

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline?: string): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    const rad = k % 2 ? r * 0.48 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = r * 0.16;
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A plump pastel cushion with gold piping and tassels, centred on (x, y), `w` wide. */
function cushion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  const h = w * 0.32;
  ctx.fillStyle = "rgba(120,80,50,0.14)";
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.55, w * 0.5, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, "#f7c1d2");
  g.addColorStop(1, "#e999b3");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.bezierCurveTo(x - w * 0.5, y - h * 0.75, x + w * 0.5, y - h * 0.75, x + w * 0.5, y);
  ctx.bezierCurveTo(x + w * 0.5, y + h * 0.7, x - w * 0.5, y + h * 0.7, x - w * 0.5, y);
  ctx.fill();
  ctx.strokeStyle = "#f5c45a";
  ctx.lineWidth = Math.max(2, w * 0.03);
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.05, w * 0.47, h * 0.32, 0, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#f5c45a";
    ctx.beginPath();
    ctx.ellipse(x + side * w * 0.5, y + h * 0.25, w * 0.035, h * 0.3, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x - w * 0.15, y - h * 0.22, w * 0.18, h * 0.1, -0.1, 0, Math.PI * 2);
  ctx.fill();
}

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = "#f5c45a";
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.5);
  ctx.lineTo(x - r, y - r * 0.4);
  ctx.lineTo(x - r * 0.5, y + r * 0.05);
  ctx.lineTo(x, y - r * 0.75);
  ctx.lineTo(x + r * 0.5, y + r * 0.05);
  ctx.lineTo(x + r, y - r * 0.4);
  ctx.lineTo(x + r, y + r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e3a842";
  ctx.fillRect(x - r, y + r * 0.32, r * 2, r * 0.2);
  for (const [dx, colour] of [[-0.55, "#ef8f86"], [0, "#7fbcf2"], [0.55, "#a6db86"]] as const) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x + dx * r, y + r * 0.18, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface CelebrationSpec {
  /** The banner: "Well done!", "Perfect!" or "New best!". */
  title: string;
  /** The ribbon: "Level 12", "Classic", "Daily Board". */
  ribbon: string;
  /** Stars earned (0–3). */
  stars: number;
  /** A new best: one crown on the cushion instead of the three stars. */
  crown?: boolean;
  /** A lost round: empty stars, no chest, and a red FAIL stamp where the coins would be. */
  fail?: boolean;
  /** Height of whatever sits under the card (the prompt and buttons), so the whole stack can be centred. */
  below?: number;
  /** A small, gently pulsing line along the bottom of the card once it has settled ("Tap to continue"). */
  hint?: string;
  /** Coins this win paid, counted up as the coins fly in. */
  coins: number;
}

export type CelebrationEvent = CoinEvent | "letter" | "banner" | "star" | "chest" | "stamp";

const STAR_AT = 1.75;
const STAR_GAP = 0.38;
/** Seconds after the lid pops that the coin total appears, as the chest fades and the coins swoop up. */
const TOTAL_AT = 0.55;
/** Extra space between the coin total's letters, as a share of its font size. */
const TRACKING = 0.06;
/** Room kept clear at the top of the screen for the coin counter. */
const SAFE_TOP = 72;
/** From the top of the name to the top of the card (name, banner and ribbon). */
const HEADER = 156;
/** A lost round: when the FAIL stamp slams down. */
const STAMP_AT = 1.75;

/** The whole celebration on a w x h screen; tap the chest via `chest.open()`. */
export class Celebration {
  private t = 0;
  readonly chest: TreasureChest;
  private sparkles: { x: number; y: number; vx: number; vy: number; born: number; colour: string }[] = [];
  private fired = new Set<string>();
  readonly card: { x: number; y: number; w: number; h: number };

  constructor(
    private w: number,
    private h: number,
    private spec: CelebrationSpec,
    private onEvent: (e: CelebrationEvent, index: number) => void = () => {},
    seed = 1,
  ) {
    // The card leaves room underneath for the buttons.
    // The whole stack (name, banner, card and whatever sits under it) is centred on the screen, but never rides
    // up behind the coin counter in the top corner; the card gets shorter on short screens so it all fits.
    const cw = Math.min(w * 0.84, 360);
    const below = spec.below ?? 0;
    const ch = Math.max(240, Math.min(390, h - SAFE_TOP - HEADER - below - 16));
    const top = Math.max(SAFE_TOP, (h - (HEADER + ch + below)) / 2);
    this.card = { x: (w - cw) / 2, y: top + HEADER, w: cw, h: ch };
    const chestSize = Math.min(110, cw * 0.36);
    this.chest = new TreasureChest(w, h, onEvent, seed, { x: w / 2, y: this.card.y + ch * 0.74, size: chestSize });
  }

  /** The coins can arrive after the celebration starts (the game is recorded in the background). */
  setCoins(coins: number): void {
    this.spec = { ...this.spec, coins };
  }

  /** When the chest shows up (it can be opened from then on). */
  get chestAt(): number {
    if (this.spec.fail) return Infinity;
    return STAR_AT + Math.max(1, this.spec.crown ? 1 : this.spec.stars) * STAR_GAP + 0.3;
  }

  get chestReady(): boolean {
    return this.t >= this.chestAt + 0.3;
  }

  /** The coins have all landed in the counter (or, for a lost round, the stamp has landed). */
  get done(): boolean {
    return this.spec.fail ? this.t >= STAMP_AT + 0.5 : this.chest.done;
  }

  private once(key: string, at: number, fire: () => void): void {
    if (this.t >= at && !this.fired.has(key)) {
      this.fired.add(key);
      fire();
    }
  }

  private sparkle(x: number, y: number, n: number, speed: number): void {
    const colours = ["#ffffff", "#fff1a8", "#ffd9e6", "#d6f5e8", "#e3d9ff"];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.sparkles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: this.t, colour: colours[i % colours.length]! });
    }
  }

  step(dt: number): void {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    [...LOGO].forEach((ch, i) => ch !== " " && this.once(`letter${i}`, i * 0.06 + 0.2, () => this.onEvent("letter", i)));
    this.once("banner", 0.9, () => this.onEvent("banner", 0));
    const cushionY = this.cushionY;
    const slots = this.starSlots(cushionY);
    slots.forEach((slot, i) =>
      this.isEarned(i) &&
      this.once(`star${i}`, STAR_AT + i * STAR_GAP, () => {
        this.onEvent("star", i);
        this.sparkle(slot.x, slot.y, 14, 220);
      }),
    );
    this.once("chest", this.chestAt, () => this.onEvent("chest", 0));
    if (this.spec.fail) this.once("stamp", STAMP_AT, () => this.onEvent("stamp", 0));
    if (this.t >= this.chestAt) this.chest.step(dt);
    for (const s of this.sparkles) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.92;
      s.vy *= 0.92;
    }
    this.sparkles = this.sparkles.filter((s) => this.t - s.born < 0.7);
  }

  /** "+N coins" in warm, glowing letters that pop in one after another, ride a single wave, then sit still. */
  private drawTotal(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, still: boolean): void {
    const label = `+${this.spec.coins} coins`;
    ctx.save();
    // As big as the chest it replaces, so the space is filled, but never wider than the card.
    ctx.font = `900 100px ${DISPLAY_FONT}`;
    // Letters are spaced out a little (TRACKING of the size between each), so outlines and the wave never collide.
    const fit = ((this.card.w * 0.84) / (ctx.measureText(label).width + TRACKING * 100 * (label.length - 1))) * 100;
    const size = Math.min(fit, this.chest.size * 0.6);
    ctx.font = `900 ${size}px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const widths = [...label].map((ch, i) => (ch === " " ? size * 0.28 : ctx.measureText(ch).width) + (i < label.length - 1 ? size * TRACKING : 0));
    const total = widths.reduce((a, b) => a + b, 0);
    // A soft golden glow behind the words.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, total * 0.75);
    glow.addColorStop(0, `rgba(255,226,140,${0.45 * clamp01(t / 0.3)})`);
    glow.addColorStop(1, "rgba(255,226,140,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - total, cy - total * 0.5, total * 2, total);
    let x = cx - total / 2;
    [...label].forEach((ch, i) => {
      const cw = widths[i]!;
      const mid = x + cw / 2;
      x += cw;
      if (ch === " ") return;
      const k = still ? 1 : clamp01((t - i * 0.035) / 0.3);
      if (k <= 0) return;
      const pop = easeOutBack(k);
      // One wave rolls through once, left to right (each letter rises and swells in turn), then it rests.
      const phase = t * 7 - i * 0.55;
      const wave = still || phase < 0 || phase > Math.PI ? 0 : Math.sin(phase);
      const lift = Math.max(0, wave) * size * 0.24;
      const swell = 1 + Math.max(0, wave) * 0.18;
      ctx.save();
      ctx.translate(mid, cy - lift);
      ctx.scale(pop * swell, pop * swell);
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = "rgba(255,251,247,0.98)";
      ctx.strokeText(ch, 0, 0);
      ctx.fillStyle = "#e08a3c";
      ctx.fillText(ch, 0, size * 0.07);
      const fill = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
      fill.addColorStop(0, "#ffe27a");
      fill.addColorStop(0.55, "#f7b23f");
      fill.addColorStop(1, "#f28c5a");
      ctx.fillStyle = fill;
      ctx.fillText(ch, 0, 0);
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.rect(-cw, -size * 0.5, cw * 2, size * 0.3);
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      ctx.restore();
    });
    ctx.restore();
  }

  /** Where the cushion sits: a third of the way down the card, and always far enough below the ribbon for the stars. */
  private get cushionY(): number {
    return this.card.y + Math.max(this.card.h * 0.36, 112);
  }

  private isEarned(i: number): boolean {
    return !this.spec.fail && (this.spec.crown === true || i < this.spec.stars);
  }

  /** The red FAIL stamp, slamming down from above with a jolt, a little crooked, in slightly patchy ink. */
  private drawStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    const k = clamp01(t / 0.18);
    const scale = 2.4 - 1.4 * k * k;
    const size = Math.min(this.card.w * 0.2, 64, this.card.h * 0.16);
    ctx.save();
    ctx.globalAlpha = clamp01(t / 0.08);
    ctx.translate(cx, cy);
    ctx.rotate(-0.2);
    ctx.scale(scale, scale);
    ctx.font = `900 ${size}px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText("FAIL").width + size * 0.7;
    const th = size * 1.35;
    ctx.strokeStyle = "#e0565b";
    ctx.lineWidth = size * 0.1;
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -th / 2, tw, th, size * 0.2);
    ctx.stroke();
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.roundRect(-tw / 2 + size * 0.14, -th / 2 + size * 0.14, tw - size * 0.28, th - size * 0.28, size * 0.12);
    ctx.stroke();
    ctx.fillStyle = "#e0565b";
    ctx.fillText("FAIL", 0, size * 0.05);
    // Patchy ink: little flecks of the card showing through.
    ctx.fillStyle = "rgba(255,250,244,0.7)";
    for (let i = 0; i < 26; i++) {
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const fx = (a - Math.floor(a) - 0.5) * tw;
      const b = Math.sin(i * 78.233) * 12345.678;
      const fy = (b - Math.floor(b) - 0.5) * th;
      ctx.beginPath();
      ctx.arc(fx, fy, size * (0.015 + ((i * 7) % 5) * 0.008), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private starSlots(cushionY: number): { x: number; y: number; r: number }[] {
    const cx = this.w / 2;
    const r = Math.min(46, this.card.w * 0.13, this.card.h * 0.15);
    if (this.spec.crown) return [{ x: cx, y: cushionY - r * 0.9, r: r * 1.2 }];
    return [-1, 0, 1].map((k) => ({ x: cx + k * r * 2.1, y: cushionY - r * (k === 0 ? 1.15 : 0.75), r: k === 0 ? r * 1.15 : r }));
  }

  draw(ctx: CanvasRenderingContext2D, still = false): void {
    const t = still ? 99 : this.t;
    const { w, h, card } = this;
    // A soft cream veil over the game, so the celebration reads but the scene still shows through.
    ctx.fillStyle = `rgba(250,240,230,${0.62 * clamp01(t / 0.3)})`;
    ctx.fillRect(0, 0, w, h);
    const logoSize = Math.min(w * 0.12, 52);
    drawLogo(ctx, w / 2, card.y - 128, logoSize, t, still);
    // The card rises.
    const rise = clamp01((t - 0.6) / 0.45);
    if (rise > 0) {
      ctx.save();
      ctx.globalAlpha = rise;
      ctx.translate(0, (1 - easeOutBack(rise)) * 60);
      ctx.shadowColor = "rgba(120,80,50,0.25)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#fffaf4";
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 30);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#f3e2d0";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(card.x + 8, card.y + 8, card.w - 16, card.h - 16, 24);
      ctx.stroke();
      // A glow behind where the stars land (a cool grey one for a lost round).
      const cushionY = this.cushionY;
      const glow = ctx.createRadialGradient(w / 2, cushionY - 30, 0, w / 2, cushionY - 30, card.w * 0.5);
      glow.addColorStop(0, this.spec.fail ? "rgba(200,210,230,0.45)" : "rgba(255,236,170,0.55)");
      glow.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(card.x, card.y, card.w, card.h * 0.7);
      // Ribbon across the top, naming the level.
      const rw = card.w * 0.72;
      const ry = card.y - 18;
      ctx.fillStyle = shade("#a990dc", -0.18);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + side * rw * 0.5, ry + 10);
        ctx.lineTo(w / 2 + side * (rw * 0.5 + 26), ry + 10);
        ctx.lineTo(w / 2 + side * (rw * 0.5 + 14), ry + 32);
        ctx.lineTo(w / 2 + side * (rw * 0.5 + 26), ry + 54);
        ctx.lineTo(w / 2 + side * rw * 0.5, ry + 54);
        ctx.fill();
      }
      ctx.fillStyle = "#b9a3e6";
      ctx.beginPath();
      ctx.roundRect(w / 2 - rw / 2, ry, rw, 50, 14);
      ctx.fill();
      ctx.font = `900 26px ${DISPLAY_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(this.spec.ribbon, w / 2, ry + 26);
      cushion(ctx, w / 2, cushionY, card.w * 0.5);
      // Stars land one by one (empty slots show as soft outlines); a new best gets a crown.
      this.starSlots(cushionY).forEach((slot, i) => {
        const earned = this.isEarned(i);
        const k = clamp01((t - (STAR_AT + i * STAR_GAP)) / 0.35);
        if (!earned || k <= 0) {
          if (!this.spec.crown) star(ctx, slot.x, slot.y, slot.r, "rgba(214,190,160,0.35)");
          return;
        }
        const pop = easeOutBack(k);
        ctx.save();
        ctx.translate(slot.x, slot.y - (1 - k) * 80);
        ctx.scale(pop, pop);
        ctx.rotate((1 - k) * 0.8);
        if (this.spec.crown) crown(ctx, 0, 0, slot.r);
        else {
          star(ctx, 0, slot.r * 0.08, slot.r, "#e3a842");
          star(ctx, 0, 0, slot.r, "#f7cd5e", "#fff6dc");
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath();
          ctx.ellipse(-slot.r * 0.2, -slot.r * 0.3, slot.r * 0.22, slot.r * 0.12, -0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.restore();
    }
    // The banner pops over the card.
    const bk = clamp01((t - 0.9) / 0.4);
    if (bk > 0) {
      ctx.save();
      ctx.translate(w / 2, card.y - 62);
      const s = easeOutBack(bk);
      ctx.scale(s, s);
      ctx.rotate(-0.04);
      ctx.font = `900 40px ${DISPLAY_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(255,251,247,0.98)";
      ctx.strokeText(this.spec.title, 0, 0);
      ctx.fillStyle = this.spec.fail ? "#7d8fb8" : "#e3a842";
      ctx.fillText(this.spec.title, 0, 3);
      ctx.fillStyle = this.spec.fail ? "#9db0d6" : "#f6b26b";
      ctx.fillText(this.spec.title, 0, 0);
      ctx.restore();
    }
    // The coin counter in the corner, ticking up as the coins arrive.
    const counterK = clamp01((t - this.chestAt) / 0.3);
    if (counterK > 0) {
      const shown = still ? this.spec.coins : Math.round((this.spec.coins * this.chest.collected) / this.chest.coinCount);
      // The coin icon sits right where the flying coins land.
      const cx = w - 40;
      const cy = 44;
      ctx.save();
      ctx.globalAlpha = counterK;
      ctx.fillStyle = "rgba(255,251,247,0.95)";
      ctx.shadowColor = "rgba(120,80,50,0.2)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(cx - 110, cy - 20, 132, 40, 20);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.font = `900 22px ${DISPLAY_FONT}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = INK;
      ctx.fillText(`+${shown}`, cx - 22, cy + 1);
      ctx.fillStyle = "#f7cd5e";
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e3a842";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    for (const s of this.sparkles) {
      const k = 1 - (this.t - s.born) / 0.7;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = s.colour;
      const z = 3 + k * 3;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - z * 2);
      ctx.quadraticCurveTo(s.x, s.y, s.x + z * 2, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + z * 2);
      ctx.quadraticCurveTo(s.x, s.y, s.x - z * 2, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - z * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.t >= this.chestAt && !still) this.chest.draw(ctx);
    // As the coins swoop up out of the chest, the total pops up where the chest was (straight away when still),
    // and a wave keeps rolling through its letters.
    const sincePop = still ? 9 : this.chest.sincePop;
    // It sits halfway between the cushion and the bottom of the card.
    const cushionBottom = this.cushionY + card.w * 0.5 * 0.32 * 0.6;
    const totalY = (cushionBottom + card.y + card.h) / 2;
    if (this.spec.fail) {
      if (still || this.t >= STAMP_AT) this.drawStamp(ctx, w / 2, totalY, still ? 1 : this.t - STAMP_AT);
    } else if (sincePop !== null && sincePop >= TOTAL_AT) this.drawTotal(ctx, w / 2, totalY, sincePop - TOTAL_AT, still);
    if (this.spec.hint && (still || this.done)) {
      ctx.save();
      ctx.globalAlpha = still ? 0.85 : 0.55 + Math.sin(this.t * 3) * 0.3;
      ctx.font = `800 17px ${DISPLAY_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = INK;
      ctx.fillText(this.spec.hint, w / 2, card.y + card.h - 30);
      ctx.restore();
    }
  }
}
