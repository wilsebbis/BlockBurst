/**
 * Cozy creatures come in seven species, one per colour: each has its own body shape, surface and temperament, so
 * the board reads like a crowd of characters rather than a grid of coloured squares. Purely visual.
 *
 *   peach   soft blob,        terrazzo speckles,   cheerful (smiles)
 *   sky     rounded square,   see-through glass,   shy (blushes, looks away)
 *   butter  cloud,            soft gloss,          cheeky (winks, sticks its pink tongue out)
 *   violet  rounded square,   jelly gloss,         sarcastic (heavy lids, smirk)
 *   teal    cut corners,      speckled stone,      grumpy (frown, flat mouth)
 *   green   soft blob,        matte,               sleepy (droopy lids)
 *   rose    rounded square,   jelly gloss,         excited (sparkly eyes, open grin)
 */
import type { CellOffset, Link } from "./cozy";

export type BodyShape = "squircle" | "blob" | "cloud" | "angular";
export type Surface = "matte" | "speckle" | "gloss" | "glass";
export type Temperament = "cheerful" | "shy" | "excited" | "sarcastic" | "grumpy" | "sleepy" | "cheeky";

export interface Species {
  name: string;
  shape: BodyShape;
  surface: Surface;
  temperament: Temperament;
}

const SPECIES: readonly Species[] = [
  { name: "peach", shape: "blob", surface: "speckle", temperament: "cheerful" },
  { name: "sky", shape: "squircle", surface: "glass", temperament: "shy" },
  { name: "butter", shape: "cloud", surface: "gloss", temperament: "cheeky" },
  { name: "violet", shape: "squircle", surface: "gloss", temperament: "sarcastic" },
  { name: "teal", shape: "angular", surface: "speckle", temperament: "grumpy" },
  { name: "green", shape: "blob", surface: "matte", temperament: "sleepy" },
  // Excited, not cheeky: a pink tongue would vanish on rose skin, but shows inside an open grin.
  { name: "rose", shape: "squircle", surface: "gloss", temperament: "excited" },
];

/** A plain body for the grey game-over sweep and the clearing bar. */
export const PLAIN: Species = { name: "plain", shape: "squircle", surface: "matte", temperament: "cheerful" };

/** The species for a colour index (1–7); anything else is plain. */
export function speciesFor(colour: number): Species {
  return SPECIES[colour - 1] ?? PLAIN;
}

const keyOf = (r: number, c: number) => `${r},${c}`;

/** Deterministic 0..1 noise, so a cell's speckles stay put from frame to frame. */
function noise(a: number, b: number): number {
  const s = Math.sin(a * 91.7 + b * 47.3) * 24634.6345;
  return s - Math.floor(s);
}

/** A square with its corners cut off, drawn clockwise like roundRect so the pieces of a body unite. */
function chamfer(ctx: CanvasRenderingContext2D, left: number, top: number, side: number, cut: number): void {
  ctx.moveTo(left + cut, top);
  ctx.lineTo(left + side - cut, top);
  ctx.lineTo(left + side, top + cut);
  ctx.lineTo(left + side, top + side - cut);
  ctx.lineTo(left + side - cut, top + side);
  ctx.lineTo(left + cut, top + side);
  ctx.lineTo(left, top + side - cut);
  ctx.lineTo(left, top + cut);
  ctx.closePath();
}

/** A circle added to the current path as its own clockwise loop. */
function bump(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  ctx.moveTo(cx + radius, cy);
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
}

/**
 * The outline of a whole body as one path: every cell in the species' shape, the bridges that join neighbours
 * and the necks across corners. Fill it once, or clip to it for a surface.
 */
export function traceBody(
  ctx: CanvasRenderingContext2D,
  cells: readonly CellOffset[],
  x: number,
  y: number,
  size: number,
  shape: BodyShape,
  links: readonly Link[] = [],
): void {
  const gap = size * 0.05;
  const inner = size - gap * 2;
  const has = new Set(cells.map(([r, c]) => keyOf(r, c)));
  const radius = { squircle: 0.24, blob: 0.36, cloud: 0.3, angular: 0 }[shape] * size;
  ctx.beginPath();
  for (const [r, c] of cells) {
    const left = x + c * size;
    const top = y + r * size;
    if (shape === "angular") chamfer(ctx, left + gap, top + gap, inner, size * 0.17);
    else ctx.roundRect(left + gap, top + gap, inner, inner, radius);
    const right = has.has(keyOf(r, c + 1));
    const down = has.has(keyOf(r + 1, c));
    if (right) ctx.rect(left + size - gap - size * 0.25, top + gap, gap * 2 + size * 0.5, inner);
    if (down) ctx.rect(left + gap, top + size - gap - size * 0.25, inner, gap * 2 + size * 0.5);
    if (right && down && has.has(keyOf(r + 1, c + 1))) ctx.rect(left + size - gap - 1, top + size - gap - 1, gap * 2 + 2, gap * 2 + 2);
    if (shape === "cloud") {
      // Puffs along every outside edge, so the body billows like a cloud.
      // Each puff pokes only a little past the cell, staying inside the gap between cells.
      const puff = size * 0.14;
      const edge = gap + puff * 0.8;
      if (!has.has(keyOf(r - 1, c))) for (const along of [0.3, 0.7]) bump(ctx, left + size * along, top + edge, puff);
      if (!down) for (const along of [0.3, 0.7]) bump(ctx, left + size * along, top + size - edge, puff);
      if (!has.has(keyOf(r, c - 1))) for (const along of [0.3, 0.7]) bump(ctx, left + edge, top + size * along, puff);
      if (!right) for (const along of [0.3, 0.7]) bump(ctx, left + size - edge, top + size * along, puff);
    }
  }
  // Necks between corner-touching cells: a rounded bar centred on the shared corner, turned 45 degrees. Turning
  // keeps the path's winding, so it unites with the cells instead of punching a hole.
  for (const [[r, c], [, nextColumn]] of links) {
    ctx.save();
    ctx.translate(x + Math.max(c, nextColumn) * size, y + (r + 1) * size);
    ctx.rotate(nextColumn > c ? Math.PI / 4 : -Math.PI / 4);
    ctx.roundRect(-size * 0.42, -size * 0.15, size * 0.84, size * 0.3, size * 0.15);
    ctx.restore();
  }
}

/** The surface of a body: call with the body's path as the clip. */
export function paintSurface(
  ctx: CanvasRenderingContext2D,
  cells: readonly CellOffset[],
  x: number,
  y: number,
  size: number,
  surface: Surface,
): void {
  if (surface === "matte") return;
  const has = new Set(cells.map(([r, c]) => keyOf(r, c)));
  for (const [r, c] of cells) {
    const left = x + c * size;
    const top = y + r * size;
    if (surface === "speckle") {
      // Terrazzo: a scatter of darker and lighter chips, fixed per cell.
      for (let chip = 0; chip < 7; chip++) {
        const cx = left + size * (0.15 + noise(r * 8 + c, chip) * 0.7);
        const cy = top + size * (0.15 + noise(chip, r * 8 + c) * 0.7);
        ctx.fillStyle = chip % 3 === 0 ? "rgba(255,255,255,0.4)" : "rgba(60,35,20,0.14)";
        ctx.beginPath();
        ctx.arc(cx, cy, size * (0.018 + noise(c, chip * 3 + r) * 0.03), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (!has.has(keyOf(r - 1, c))) {
      // Jelly and glass: a soft light falling on the top of the body, fading down.
      const shine = ctx.createLinearGradient(0, top, 0, top + size * 0.55);
      shine.addColorStop(0, surface === "glass" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.32)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      ctx.fillRect(left, top, size, size * 0.6);
    }
    if (surface === "glass") {
      // A faint rainbow sheen, like iridescent glass tile.
      const sheen = ctx.createLinearGradient(left, top, left + size, top + size);
      sheen.addColorStop(0, "rgba(255,170,220,0.22)");
      sheen.addColorStop(0.5, "rgba(170,240,255,0.18)");
      sheen.addColorStop(1, "rgba(255,235,160,0.22)");
      ctx.fillStyle = sheen;
      ctx.fillRect(left, top, size, size);
      if (!has.has(keyOf(r - 1, c)) && !has.has(keyOf(r, c - 1))) {
        // A soft round glint in the top-left corner, like light pooling on polished glass.
        const gx = left + size * 0.28;
        const gy = top + size * 0.27;
        const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, size * 0.22);
        glint.addColorStop(0, "rgba(255,255,255,0.6)");
        glint.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glint;
        ctx.fillRect(left, top, size * 0.6, size * 0.6);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(gx - size * 0.03, gy - size * 0.03, size * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** How see-through a surface is: glass lets the board's dots show through. */
export const opacityOf = (surface: Surface) => (surface === "glass" ? 0.72 : 1);

const INK = "#4a3a33";

/** A darker shade of a body colour, for eyelids and frowns drawn in the creature's own skin. */
function deeper(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.max(0, ((value >> shift) & 255) - amount);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

/**
 * Everything a face has besides its eyeballs: lids, brows, cheeks and a mouth, by temperament. `spread` and
 * `white` are the eye spacing and eye radius the eyes were drawn with; `mood` overrides the resting look.
 */
export function drawExpression(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spread: number,
  white: number,
  temperament: Temperament,
  skin: string,
  mood: "normal" | "blink" | "happy" | "worried" | "celebrating" | "crying" | "relieved",
  now = 0,
): void {
  const mouthY = y + white * 1.75;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, white * 0.28);
  if (mood === "happy") {
    // Even the grumpy ones crack a smile when a line clears.
    ctx.beginPath();
    ctx.arc(x, mouthY - white * 0.35, white * 0.6, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    return;
  }
  if (mood === "relieved") {
    // Phew: a small round exhale and a little puff of wind drifting off to the side.
    ctx.beginPath();
    ctx.ellipse(x, mouthY, white * 0.2, white * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
    const drift = (now / 700) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${String(0.9 * (1 - drift))})`;
    ctx.lineWidth = Math.max(1.2, white * 0.18);
    for (let curl = 0; curl < 2; curl++) {
      const puffX = x + white * (0.5 + drift * 1.4) + curl * white * 0.25;
      const puffY = mouthY - curl * white * 0.45 - drift * white * 0.4;
      ctx.beginPath();
      ctx.arc(puffX, puffY, white * 0.22, Math.PI * 0.9, Math.PI * 2.3);
      ctx.stroke();
    }
    return;
  }
  if (mood === "celebrating") {
    // A won game: a big open grin and rosy cheeks, whatever the creature's usual temper.
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x - white * 0.8, mouthY - white * 0.35);
    ctx.quadraticCurveTo(x, mouthY + white * 1.25, x + white * 0.8, mouthY - white * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7a3b8";
    ctx.beginPath();
    ctx.ellipse(x, mouthY + white * 0.25, white * 0.36, white * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,130,160,0.45)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * (spread + white * 0.6), mouthY - white * 0.35, white * 0.45, white * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (mood === "crying") {
    // A lost game: tears stream from both squeezed eyes and the mouth wails open, upside down.
    for (const side of [-1, 1]) {
      const wobble = Math.sin(now / 160 + side) * white * 0.08;
      const tear = ctx.createLinearGradient(0, y + white * 0.4, 0, y + white * 2.4);
      tear.addColorStop(0, "rgba(150,210,255,0.95)");
      tear.addColorStop(1, "rgba(150,210,255,0)");
      ctx.fillStyle = tear;
      ctx.beginPath();
      ctx.roundRect(x + side * (spread + white * 0.25) - white * 0.24 + wobble, y + white * 0.35, white * 0.48, white * 2.6, white * 0.24);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x - white * 0.5, mouthY + white * 0.35);
    ctx.quadraticCurveTo(x, mouthY - white * 0.75, x + white * 0.5, mouthY + white * 0.35);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (mood === "worried") {
    // A crowded board: brows lift in the middle, the mouth wobbles and a bead of sweat runs down the side.
    ctx.lineWidth = Math.max(1.2, white * 0.26);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * (spread + white * 0.85), y - white * 1.05);
      ctx.lineTo(x + side * (spread - white * 0.55), y - white * 1.45);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - white * 0.5, mouthY);
    ctx.quadraticCurveTo(x - white * 0.25, mouthY - white * 0.22, x, mouthY);
    ctx.quadraticCurveTo(x + white * 0.25, mouthY + white * 0.22, x + white * 0.5, mouthY);
    ctx.stroke();
    const dropX = x + spread + white * 1.35;
    const dropY = y - white * 0.6;
    ctx.fillStyle = "rgba(150,210,255,0.95)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, white * 0.12);
    ctx.beginPath();
    ctx.moveTo(dropX, dropY - white * 0.55);
    ctx.quadraticCurveTo(dropX + white * 0.38, dropY + white * 0.05, dropX, dropY + white * 0.35);
    ctx.quadraticCurveTo(dropX - white * 0.38, dropY + white * 0.05, dropX, dropY - white * 0.55);
    ctx.fill();
    ctx.stroke();
    return;
  }
  const lid = (cover: number) => {
    // An upper eyelid in the creature's skin, covering the top `cover` of each eye.
    ctx.fillStyle = deeper(skin, 8);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + side * spread, y, white + 0.5, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillRect(x + side * spread - white - 1, y - white - 1, white * 2 + 2, white * 2 * cover + 1);
      ctx.restore();
    }
    // A thin lash line along the lid's edge, curved like a relaxed eyelid.
    ctx.lineWidth = Math.max(1, white * 0.16);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const lidY = y - white + white * 2 * cover;
      ctx.moveTo(x + side * spread - white * 0.85, lidY);
      ctx.quadraticCurveTo(x + side * spread, lidY + white * 0.18, x + side * spread + white * 0.85, lidY);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1.2, white * 0.28);
  };
  switch (temperament) {
    case "cheerful":
      ctx.beginPath();
      ctx.arc(x, mouthY - white * 0.4, white * 0.55, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      break;
    case "shy":
      ctx.fillStyle = "rgba(255,130,160,0.4)";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + side * (spread + white * 0.55), mouthY - white * 0.15, white * 0.5, white * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, mouthY, white * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "excited":
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x - white * 0.75, mouthY - white * 0.3);
      ctx.quadraticCurveTo(x, mouthY + white * 1.2, x + white * 0.75, mouthY - white * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f7a3b8";
      ctx.beginPath();
      ctx.ellipse(x, mouthY + white * 0.28, white * 0.34, white * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "sarcastic":
      if (mood === "normal") lid(0.45);
      ctx.beginPath();
      ctx.moveTo(x - white * 0.5, mouthY);
      ctx.quadraticCurveTo(x + white * 0.1, mouthY + white * 0.05, x + white * 0.55, mouthY - white * 0.3);
      ctx.stroke();
      break;
    case "grumpy":
      ctx.lineWidth = Math.max(1.5, white * 0.34);
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(x + side * (spread + white * 0.9), y - white * 1.25);
        ctx.lineTo(x + side * (spread - white * 0.6), y - white * 0.8);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - white * 0.45, mouthY + white * 0.05);
      ctx.lineTo(x + white * 0.45, mouthY + white * 0.05);
      ctx.stroke();
      break;
    case "sleepy":
      if (mood === "normal") lid(0.55);
      ctx.beginPath();
      ctx.ellipse(x, mouthY, white * 0.16, white * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "cheeky": {
      // A small tongue tucked under the right side of the smile: just its lower half shows, and the lip line is
      // drawn over its top so it hangs from the mouth rather than floating below it.
      const smileY = mouthY - white * 0.5;
      const smileRadius = white * 0.7;
      const tongueX = x + white * 0.2;
      const lipY = smileY + Math.sqrt(smileRadius ** 2 - (tongueX - x) ** 2);
      ctx.fillStyle = "#ec8aa0";
      ctx.beginPath();
      ctx.ellipse(tongueX, lipY, white * 0.27, white * 0.38, 0, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, smileY, smileRadius, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
}

/** Cheeky creatures wink now and then: true while the left eye should be shut. */
export function isWinking(seed: number, now: number): boolean {
  const period = 4200 + (seed % 7) * 300;
  return (now + seed * 977) % period < 260;
}

/**
 * A gem a creature has swallowed: a faceted jewel floating inside its body, in a soft pocket of shadow, with a
 * glint that twinkles. It reads the same on a head, a belly or a tail.
 */
export function drawEmbeddedGem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  now: number,
  options: { sharesFace?: boolean } = {},
): void {
  // On a square that carries the face, the treasure is worn instead: a crown on the creature's head.
  if (options.sharesFace === true) {
    drawCrown(ctx, x, y, cellSize, now);
    return;
  }
  const size = cellSize;
  const cx = x + cellSize * 0.5;
  const bob = Math.sin(now / 520) * size * 0.025;
  const cy = y + cellSize * 0.55 + bob;
  const width = size * 0.26;
  const pocket = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.34);
  pocket.addColorStop(0, "rgba(40,20,10,0.16)");
  pocket.addColorStop(1, "rgba(40,20,10,0)");
  ctx.fillStyle = pocket;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.fill();
  // A brilliant cut seen from the side: a flat crown over a pointed pavilion.
  const crownTop = cy - width * 0.55;
  const girdle = cy - width * 0.1;
  const tip = cy + width * 0.8;
  const body = ctx.createLinearGradient(cx - width, crownTop, cx + width, tip);
  body.addColorStop(0, "#e9fbff");
  body.addColorStop(0.55, "#8fdcf0");
  body.addColorStop(1, "#4fb3d6");
  ctx.fillStyle = body;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.55, crownTop);
  ctx.lineTo(cx + width * 0.55, crownTop);
  ctx.lineTo(cx + width, girdle);
  ctx.lineTo(cx, tip);
  ctx.lineTo(cx - width, girdle);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(cx - width, girdle);
  ctx.lineTo(cx + width, girdle);
  ctx.moveTo(cx - width * 0.3, girdle);
  ctx.lineTo(cx, tip);
  ctx.lineTo(cx + width * 0.3, girdle);
  ctx.stroke();
  // The twinkle: a four-point star that swells and fades.
  const twinkle = 0.5 + Math.sin(now / 300) * 0.5;
  const star = size * 0.07 * (0.6 + twinkle * 0.6);
  const sx = cx - width * 0.45;
  const sy = crownTop + width * 0.05;
  ctx.fillStyle = `rgba(255,255,255,${String(0.55 + twinkle * 0.45)})`;
  ctx.beginPath();
  ctx.moveTo(sx, sy - star);
  ctx.quadraticCurveTo(sx, sy, sx + star, sy);
  ctx.quadraticCurveTo(sx, sy, sx, sy + star);
  ctx.quadraticCurveTo(sx, sy, sx - star, sy);
  ctx.quadraticCurveTo(sx, sy, sx, sy - star);
  ctx.fill();
}

/** A little gold crown sitting on top of a head, set with a twinkling jewel. Fits above the eyes. */
export function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number): void {
  const cx = x + size * 0.5;
  const base = y + size * 0.27;
  const width = size * 0.42;
  const height = size * 0.17;
  const left = cx - width / 2;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.strokeStyle = "#b07a1c";
  const gold = ctx.createLinearGradient(0, base - height, 0, base);
  gold.addColorStop(0, "#ffe27a");
  gold.addColorStop(1, "#f2b632");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(left, base);
  ctx.lineTo(left, base - height * 0.55);
  ctx.lineTo(left + width * 0.22, base - height * 0.25);
  ctx.lineTo(cx, base - height);
  ctx.lineTo(left + width * 0.78, base - height * 0.25);
  ctx.lineTo(left + width, base - height * 0.55);
  ctx.lineTo(left + width, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Pearls on the outer points and a jewel in the middle.
  ctx.fillStyle = "#fff6d8";
  for (const [px, py] of [[left, base - height * 0.55], [left + width, base - height * 0.55], [cx, base - height]] as const) {
    ctx.beginPath();
    ctx.arc(px, py, size * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  const twinkle = 0.5 + Math.sin(now / 300) * 0.5;
  ctx.fillStyle = "#7fd3ec";
  ctx.beginPath();
  ctx.arc(cx, base - height * 0.38, size * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${String(0.5 + twinkle * 0.5)})`;
  ctx.beginPath();
  ctx.arc(cx - size * 0.012, base - height * 0.45, size * 0.013, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A tear running down from a crying creature's eyes to its feet, where a little puddle spreads on the board.
 * `elapsed` is how long the creature has been crying (ms), so the puddle grows and then stays.
 */
export function drawTearPuddle(ctx: CanvasRenderingContext2D, eyeX: number, eyeY: number, feetY: number, size: number, now: number, elapsed: number, seed: number): void {
  const fall = ((now + seed * 211) % 1100) / 1100;
  const dropY = eyeY + size * 0.25 + (feetY - eyeY - size * 0.3) * fall * fall;
  ctx.fillStyle = `rgba(150,210,255,${String(0.95 - fall * 0.3)})`;
  ctx.beginPath();
  ctx.moveTo(eyeX, dropY - size * 0.07);
  ctx.quadraticCurveTo(eyeX + size * 0.05, dropY, eyeX, dropY + size * 0.045);
  ctx.quadraticCurveTo(eyeX - size * 0.05, dropY, eyeX, dropY - size * 0.07);
  ctx.fill();
  const spread = Math.min(1, elapsed / 2500);
  if (spread <= 0) return;
  ctx.fillStyle = "rgba(150,210,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(eyeX, feetY - size * 0.06, size * (0.12 + spread * 0.3), size * (0.04 + spread * 0.05), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(eyeX - size * 0.06 * spread, feetY - size * 0.075, size * 0.06 * spread, size * 0.015, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A tissue dabbing a face dry during a revive: a soft white square with a folded corner that pats side to
 * side over the eyes. `progress` runs 0..1 over the dab.
 */
export function drawTissue(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, progress: number): void {
  const pat = Math.sin(progress * Math.PI * 5) * size * 0.18;
  const fade = progress < 0.85 ? 1 : (1 - progress) / 0.15;
  const side = size * 0.62;
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.translate(x + pat, y + size * 0.05);
  ctx.rotate(-0.25 + Math.sin(progress * Math.PI * 5) * 0.12);
  ctx.shadowColor = "rgba(120,90,70,0.25)";
  ctx.shadowBlur = size * 0.12;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(-side / 2, -side / 2, side, side, size * 0.08);
  ctx.fill();
  ctx.shadowBlur = 0;
  // A folded corner and a soft crease.
  ctx.fillStyle = "#eee6df";
  ctx.beginPath();
  ctx.moveTo(side / 2, -side / 2 + side * 0.35);
  ctx.lineTo(side / 2 - side * 0.35, -side / 2);
  ctx.lineTo(side / 2, -side / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(200,185,175,0.8)";
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(-side * 0.3, side * 0.1);
  ctx.quadraticCurveTo(0, side * 0.2, side * 0.3, side * 0.05);
  ctx.stroke();
  ctx.restore();
}
