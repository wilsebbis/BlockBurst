/** The game's name, drawn as an animated logo: used for the opening splash and the win celebration. */

export const DISPLAY_FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const LOGO = "Block Burst";
const LOGO_COLOURS = ["#ef8f86", "#f6b26b", "#f2c14e", "#93cf74", "#6fb2ea", "#a990dc"];

export const easeOutBack = (k: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
export const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/**
 * The game's name in chunky pastel letters, centred on (cx, cy): each letter drops in with an overshoot and a
 * wobble, then they all bob in a gentle wave. `t` is seconds since it started; `still` shows it settled.
 */
export function drawLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, t: number, still = false): void {
  ctx.save();
  ctx.font = `900 ${Math.round(size)}px ${DISPLAY_FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const widths = [...LOGO].map((ch) => (ch === " " ? size * 0.32 : ctx.measureText(ch).width + size * 0.02));
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  let colour = 0;
  [...LOGO].forEach((ch, i) => {
    const w = widths[i]!;
    const mid = x + w / 2;
    x += w;
    if (ch === " ") return;
    const k = still ? 1 : clamp01((t - i * 0.06) / 0.45);
    if (k <= 0) {
      colour++;
      return;
    }
    // Once every letter has landed, a wave keeps rolling through the name, lifting and swelling each letter in
    // turn, for as long as it's on screen.
    const settled = still ? 0 : clamp01((t - 0.9) / 0.4);
    const wave = Math.max(0, Math.sin(t * 6 - i * 0.55)) * settled;
    const y = cy - (1 - easeOutBack(k)) * size * 2.2 - wave * size * 0.2;
    const tilt = still ? 0 : (1 - k) * 0.5 * (i % 2 ? 1 : -1) + Math.sin(t * 2 + i) * 0.03;
    const fill = LOGO_COLOURS[colour++ % LOGO_COLOURS.length]!;
    ctx.save();
    ctx.globalAlpha *= clamp01(k * 3);
    ctx.translate(mid, y);
    ctx.rotate(tilt);
    ctx.scale(1 + wave * 0.12, 1 + wave * 0.12);
    // A soft 3D extrusion, a thick cream outline, the letter and a shine.
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = "rgba(255,251,247,0.98)";
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = shade(fill, -0.22);
    ctx.fillText(ch, 0, size * 0.07);
    ctx.fillStyle = fill;
    ctx.fillText(ch, 0, 0);
    ctx.save();
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.rect(-w, -size * 0.5, w * 2, size * 0.32);
    ctx.clip();
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    if (ch === "o") {
      // The "o" peeks out with a pair of googly eyes.
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(side * size * 0.09, size * 0.04, size * 0.085, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3d302a";
        ctx.beginPath();
        ctx.arc(side * size * 0.09 + Math.sin(t * 1.4) * size * 0.02, size * 0.06, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });
  ctx.restore();
}

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

