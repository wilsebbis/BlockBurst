/**
 * Praise for a big clear, the way the big puzzle games cheer you on, in the Cozy voice: "Sweet!", "Lovely!",
 * "Dreamy!", "Magical!", "Legendary!" as clears get bigger and combos run longer, and "All Clear!" for an empty
 * board. The word bounces in letter by letter over soft rays of light, then floats off. Purely visual.
 */
import { clamp01, DISPLAY_FONT, easeOutBack } from "./logo";

const WORDS = ["Sweet!", "Lovely!", "Dreamy!", "Magical!", "Legendary!"] as const;
const LETTER_COLOURS = ["#ef8f86", "#f6b26b", "#f2c14e", "#93cf74", "#6fb2ea", "#a990dc"];

/** How long the word stays up, in ms. */
export const PRAISE_MS = 1300;

export interface Praise {
  word: string;
  /** 1 (a double) up to 5; 6 for an All Clear. */
  tier: number;
}

/**
 * The praise a move earns, or null for an ordinary one. Two lines start it; every extra line and a combo of 3+
 * (and again at 5+) climb a step.
 */
export function praiseFor(lines: number, combo: number, perfect: boolean): Praise | null {
  if (perfect) return { word: "All Clear!", tier: 6 };
  if (lines < 2 && combo < 3) return null;
  const tier = Math.min(5, Math.max(1, lines - 1 + (combo >= 3 ? 1 : 0) + (combo >= 5 ? 1 : 0)));
  return { word: WORDS[tier - 1]!, tier };
}

/** The word and its rays, centred on (cx, cy); `t` is ms since it appeared. */
export function drawPraise(ctx: CanvasRenderingContext2D, p: Praise, cx: number, cy: number, size: number, t: number, still: boolean, maxWidth = Infinity): void {
  const k = t / PRAISE_MS;
  const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  // Soft rays turning slowly behind the word; bigger praise, more rays.
  if (!still) {
    const rays = 8 + p.tier * 2;
    const reach = size * (2.2 + p.tier * 0.25) * clamp01(t / 250);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t / 1600);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * reach, Math.sin(a) * reach);
      g.addColorStop(0, "rgba(255,226,140,0.75)");
      g.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, reach, a - Math.PI / rays / 2, a + Math.PI / rays / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  let s = size * (p.tier >= 6 ? 1.15 : 0.85 + p.tier * 0.07);
  ctx.font = `900 ${Math.round(s)}px ${DISPLAY_FONT}`;
  // Never wider than the board.
  const natural = ctx.measureText(p.word).width * 1.05;
  if (natural > maxWidth) {
    s *= maxWidth / natural;
    ctx.font = `900 ${Math.round(s)}px ${DISPLAY_FONT}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const chars = [...p.word];
  const widths = chars.map((ch) => ctx.measureText(ch).width + s * 0.03);
  const total = widths.reduce((a, b) => a + b, 0);
  // A soft cream cloud behind the word, so it reads over a busy board.
  const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, total * 0.62);
  cloud.addColorStop(0, `rgba(255,251,244,${0.85 * clamp01(t / 150)})`);
  cloud.addColorStop(1, "rgba(255,251,244,0)");
  ctx.fillStyle = cloud;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.55);
  ctx.beginPath();
  ctx.arc(0, 0, total * 0.62, 0, Math.PI * 2);
  ctx.restore();
  ctx.fill();
  let x = cx - total / 2;
  // Floats up a little as it fades.
  const rise = still ? 0 : Math.max(0, k - 0.6) * s * 0.8;
  chars.forEach((ch, i) => {
    const w = widths[i]!;
    const mid = x + w / 2;
    x += w;
    const pop = still ? 1 : easeOutBack(clamp01((t - i * 35) / 260));
    if (pop <= 0) return;
    const wave = still ? 0 : Math.max(0, Math.sin(t / 110 - i * 0.6)) * s * 0.08;
    const fill = p.tier >= 6 ? LETTER_COLOURS[i % LETTER_COLOURS.length]! : LETTER_COLOURS[(i + p.tier) % LETTER_COLOURS.length]!;
    ctx.save();
    ctx.translate(mid, cy - wave - rise);
    ctx.scale(pop, pop);
    ctx.lineWidth = s * 0.22;
    ctx.strokeStyle = "rgba(255,251,247,0.98)";
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = "rgba(90,60,40,0.25)";
    ctx.fillText(ch, 0, s * 0.07);
    ctx.fillStyle = fill;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

/** All Clear: a pastel rainbow sweeping diagonally across the board. */
export function drawRainbowSweep(ctx: CanvasRenderingContext2D, x: number, y: number, side: number, t: number): void {
  const k = clamp01(t / 900);
  if (k >= 1) return;
  const colours = ["#f7b9b9", "#f8d6a8", "#f7ecaa", "#c5e8b7", "#b8daf3", "#d2c3f1"];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, side, side);
  ctx.clip();
  ctx.globalAlpha = 0.55 * (1 - k);
  const band = side * 0.12;
  const front = -side + k * side * 3;
  colours.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    const o = front - i * band;
    ctx.moveTo(x + o, y);
    ctx.lineTo(x + o + band, y);
    ctx.lineTo(x + o + band - side, y + side);
    ctx.lineTo(x + o - side, y + side);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}
