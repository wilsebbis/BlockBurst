/**
 * The Cozy look (the default): soft pastel blocks that join into one rounded body per piece, each with a pair of
 * googly eyes. The eyes follow the piece you are holding, glance around and blink when idle, squint happily when
 * lines clear, and at the end of a game they all celebrate a win or cry over a loss. Purely visual: nothing here reads or changes the rules.
 */
import { SIZE } from "./board";
import { drawExpression, opacityOf, paintSurface, PLAIN, traceBody, type Species, type Temperament } from "./species";

/** Friendly pastels, one per colour index 1–7. */
// Seven hues spread round the wheel, with light and deep ones mixed, so pieces stay apart at a glance and in
// dim light: peach, sky, butter, violet, deep teal, spring green and rose.
export const COZY_PALETTE = [
  "#f6a07a",
  "#7fbcf2",
  "#f7cd5e",
  "#b49ce0",
  "#4fa597",
  "#a6db86",
  "#ea7f96",
];
export const COZY_GREY = "#d9d2cc";
/** The bar a line becomes just before it clears: bubblegum pink, a colour no piece uses. */
export const COZY_CLEARING = "#f5b5d4";

/** How a face feels right now; "worried" is the crowded-board look (sweat, raised brows, darting eyes). */
export type Mood = "normal" | "blink" | "happy" | "worried" | "celebrating" | "crying" | "relieved";

/** A cell offset inside a piece or a group of board cells: [row, column]. */
export type CellOffset = readonly [number, number];

export function drawCozyBoard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
): void {
  const size = cell * SIZE;
  const pad = cell * 0.22;
  ctx.save();
  // Layered like a photo frame: a warm lip peeking out under the white tray, which casts a soft shadow.
  ctx.fillStyle = "#e6d6c7";
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad + cell * 0.1, size + pad * 2, size + pad * 2, cell * 0.24);
  ctx.fill();
  ctx.shadowColor = "rgba(130,90,60,0.22)";
  ctx.shadowBlur = cell * 0.5;
  ctx.shadowOffsetY = cell * 0.1;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad, size + pad * 2, size + pad * 2, cell * 0.22);
  ctx.fill();
  ctx.restore();
  // The playing area is sunken: an inner shadow along its top edge, so pieces look like they click down into it.
  const well = cell * 0.04;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - well, y - well, size + well * 2, size + well * 2, cell * 0.18);
  ctx.fillStyle = "#faf7f4";
  ctx.fill();
  ctx.clip();
  ctx.shadowColor = "rgba(120,80,50,0.2)";
  ctx.shadowBlur = cell * 0.3;
  ctx.shadowOffsetY = cell * 0.07;
  ctx.lineWidth = cell * 0.4;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x - well - cell * 0.2, y - well - cell * 0.2, size + well * 2 + cell * 0.4, size + well * 2 + cell * 0.4, cell * 0.3);
  ctx.stroke();
  ctx.restore();
  const gap = cell * 0.05;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      ctx.fillStyle = "#f5f2ef";
      ctx.beginPath();
      ctx.roundRect(
        x + c * cell + gap,
        y + r * cell + gap,
        cell - gap * 2,
        cell - gap * 2,
        cell * 0.16,
      );
      ctx.fill();
      ctx.fillStyle = "#d8d2cd";
      ctx.beginPath();
      ctx.arc(
        x + (c + 0.5) * cell,
        y + (r + 0.5) * cell,
        Math.max(1, cell * 0.035),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
}

/**
 * One body covering every cell, in its species' shape and surface, with the seams between neighbouring cells
 * filled in and necks across corners.
 */
export function drawBlob(
  ctx: CanvasRenderingContext2D,
  cells: readonly CellOffset[],
  x: number,
  y: number,
  size: number,
  colour: string,
  options: { seams?: boolean; links?: readonly Link[]; species?: Species } = {},
): void {
  const species = options.species ?? PLAIN;
  const has = new Set(cells.map(([r, c]) => `${r},${c}`));
  const alpha = ctx.globalAlpha;
  // A soft contact shadow just under the body, so it sits in the tray like a stamped silicone piece.
  traceBody(ctx, cells, x, y + size * 0.05, size, species.shape, options.links);
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = "rgba(120,80,50,0.28)";
  ctx.fill("nonzero");
  // One path for the whole body, filled once, so a faded piece has no darker seams where shapes overlap.
  traceBody(ctx, cells, x, y, size, species.shape, options.links);
  ctx.globalAlpha = alpha * opacityOf(species.surface);
  ctx.fillStyle = colour;
  ctx.fill("nonzero");
  ctx.globalAlpha = alpha;
  ctx.save();
  traceBody(ctx, cells, x, y, size, species.shape, options.links);
  ctx.clip("nonzero");
  if (species.surface !== "matte") paintSurface(ctx, cells, x, y, size, species.surface);
  // Pillowy bevel: a soft light band along every outer top edge and a little shade along every outer bottom one,
  // so the body looks moulded from matte silicone instead of cut from flat tiles.
  const band = size * 0.22;
  for (const [r, c] of cells) {
    const left = x + c * size;
    const top = y + r * size;
    if (!has.has(`${r - 1},${c}`)) {
      const g = ctx.createLinearGradient(0, top, 0, top + band);
      g.addColorStop(0, "rgba(255,255,255,0.32)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(left - 1, top, size + 2, band);
    }
    if (!has.has(`${r + 1},${c}`)) {
      const g = ctx.createLinearGradient(0, top + size, 0, top + size - band);
      g.addColorStop(0, "rgba(90,50,30,0.16)");
      g.addColorStop(1, "rgba(90,50,30,0)");
      ctx.fillStyle = g;
      ctx.fillRect(left - 1, top + size - band, size + 2, band);
    }
  }
  ctx.restore();
  if (options.seams === false) return;
  // Gummy-bead seams: a soft crease with a highlight beside it, so cells still count at a glance (a 4-bar never
  // reads as a 5-bar) while the body feels like linked beads rather than separate tiles.
  ctx.lineCap = "round";
  const seams = (dx: number, dy: number) => {
    ctx.beginPath();
    for (const [r, c] of cells) {
      const left = x + c * size + dx;
      const top = y + r * size + dy;
      if (has.has(`${r},${c + 1}`)) {
        ctx.moveTo(left + size, top + size * 0.22);
        ctx.lineTo(left + size, top + size * 0.78);
      }
      if (has.has(`${r + 1},${c}`)) {
        ctx.moveTo(left + size * 0.22, top + size);
        ctx.lineTo(left + size * 0.78, top + size);
      }
    }
    ctx.stroke();
  };
  const w = Math.max(1, size * 0.035);
  ctx.lineWidth = w;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  seams(w * 0.9, w * 0.9);
  ctx.strokeStyle = "rgba(80,50,30,0.16)";
  seams(0, 0);
}

/**
 * Where a body's face goes and how big it is, in cell units. The face sits on the top row, as far right as it
 * can while avoiding gift cells; on a row of two or more cells it straddles the last two, so long and big bodies
 * get wider-set, larger eyes while a single square gets a slightly smaller pair.
 */
export function faceAnchor(cells: readonly CellOffset[], avoid: ReadonlySet<string> = new Set()): { x: number; y: number; scale: number } {
  const top = Math.min(...cells.map(([r]) => r));
  const row = cells.filter(([r]) => r === top).map(([, c]) => c).sort((a, b) => a - b);
  const free = row.filter((c) => !avoid.has(`${top},${c}`));
  const choices = free.length > 0 ? free : row;
  const column = choices[choices.length - 1]!;
  const scale = cells.length === 1 ? 0.9 : cells.length < 4 ? 1.05 : 1.2;
  const hasLeftNeighbour = row.includes(column - 1) && !avoid.has(`${top},${column - 1}`);
  if (hasLeftNeighbour && cells.length >= 4) return { x: column, y: top + 0.44, scale: 1.3 };
  return { x: column + 0.5 + 0.03, y: top + 0.43, scale };
}

/** The line a drop is about to clear: drawn over the blocks, one seamless body with a soft pink glow. */
export function drawClearingBar(ctx: CanvasRenderingContext2D, cells: readonly CellOffset[], x: number, y: number, size: number): void {
  ctx.save();
  ctx.shadowColor = "rgba(245,140,190,0.55)";
  ctx.shadowBlur = size * 0.35;
  drawBlob(ctx, cells, x, y, size, COZY_CLEARING, { seams: false });
  ctx.restore();
}

/**
 * A pair of googly eyes centred at (x, y). `gaze` is where the pupils point, each axis -1..1.
 * Size is the cell size the eyes belong to.
 */
export function drawEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  gaze: { x: number; y: number },
  mood: Mood,
  scale = 1,
  character: { temperament: Temperament; skin: string; isWinking?: boolean; now?: number; pupilScale?: number } = { temperament: "cheerful", skin: "#ffffff" },
): void {
  size *= scale;
  // Toy eyes: big whites set tight together, oversized dark pupils with a bright catchlight.
  const white = size * 0.19;
  const spread = white * 1.12;
  const pupil = size * (character.temperament === "excited" ? 0.135 : 0.125) * (character.pupilScale ?? 1);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    const cx = x + side * spread;
    if (mood === "normal" && side === -1 && character.isWinking === true) {
      // A wink: the left eye shuts into a curve while the right one stays open.
      ctx.strokeStyle = "#4a3a33";
      ctx.lineWidth = Math.max(1.5, size * 0.045);
      ctx.beginPath();
      ctx.arc(cx, y - white * 0.2, white * 0.7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    if (mood === "relieved") {
      // A sigh of relief: eyes gently closed, curved downward and at rest.
      ctx.strokeStyle = "#4a3a33";
      ctx.lineWidth = Math.max(1.5, size * 0.045);
      ctx.beginPath();
      ctx.arc(cx, y - white * 0.45, white * 0.75, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      continue;
    }
    if (mood === "crying") {
      // > < : eyes squeezed shut.
      ctx.strokeStyle = "#4a3a33";
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx + side * white * 0.55, y - white * 0.5);
      ctx.lineTo(cx - side * white * 0.4, y);
      ctx.lineTo(cx + side * white * 0.55, y + white * 0.5);
      ctx.stroke();
      continue;
    }
    if (mood === "happy" || mood === "celebrating") {
      // ^ ^ : a happy squint.
      ctx.strokeStyle = "#4a3a33";
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.arc(
        cx,
        y + white * 0.35,
        white * 0.75,
        Math.PI * 1.15,
        Math.PI * 1.85,
      );
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, y, white, 0, Math.PI * 2);
    ctx.fill();
    // A faint rim, so the white reads as a rounded vinyl eye rather than a flat disc.
    ctx.strokeStyle = "rgba(70,45,30,0.14)";
    ctx.lineWidth = Math.max(1, size * 0.018);
    ctx.stroke();
    if (mood === "blink") {
      ctx.strokeStyle = "#4a3a33";
      ctx.lineWidth = Math.max(1.5, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(cx - white * 0.8, y);
      ctx.lineTo(cx + white * 0.8, y);
      ctx.stroke();
      continue;
    }
    const reach = white - pupil - size * 0.012;
    const px = cx + gaze.x * reach;
    const py = y + gaze.y * reach;
    ctx.fillStyle = "#3d302a";
    ctx.beginPath();
    ctx.arc(px, py, pupil, 0, Math.PI * 2);
    ctx.fill();
    // Catchlights: one big, one small, always top-left, like light on a glossy sticker.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px - pupil * 0.36, py - pupil * 0.36, pupil * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + pupil * 0.34, py + pupil * 0.3, pupil * (character.temperament === "excited" ? 0.2 : 0.13), 0, Math.PI * 2);
    ctx.fill();
  }
  drawExpression(ctx, x, y, spread, white, character.temperament, character.skin, mood, character.now ?? 0);
}

/** Two diagonal neighbours joined by a little neck, from the top cell to the lower one. */
export type Link = readonly [CellOffset, CellOffset];

/**
 * The creatures on the board. Cells of the same colour that touch, along a side or at a corner, are one
 * creature with one face, whichever pieces they came from; corner touches are joined by a neck. Owners < 0 mark
 * the clearing bar, which never joins anything and never grows necks.
 */
export function boardBodies(
  colours: readonly number[],
  owners: readonly number[],
): { colour: number; cells: CellOffset[]; links: Link[] }[] {
  const seen = new Uint8Array(SIZE * SIZE);
  const bodies: { colour: number; cells: CellOffset[]; links: Link[] }[] = [];
  const touching = (a: number, b: number) => colours[a] === colours[b] && (owners[a]! < 0) === (owners[b]! < 0);
  const linked = (a: number, b: number) => colours[a] === colours[b] && owners[a]! >= 0 && owners[b]! >= 0;
  for (let start = 0; start < SIZE * SIZE; start++) {
    if (seen[start] || !colours[start]) continue;
    const cells: CellOffset[] = [];
    const links: Link[] = [];
    const stack = [start];
    seen[start] = 1;
    // An explicit stack, not recursion: at most 64 cells are ever visited.
    while (stack.length > 0) {
      const i = stack.pop()!;
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      cells.push([r, c]);
      const sides = [r > 0 ? i - SIZE : -1, r < SIZE - 1 ? i + SIZE : -1, c > 0 ? i - 1 : -1, c < SIZE - 1 ? i + 1 : -1];
      for (const n of sides) {
        if (n >= 0 && !seen[n] && colours[n] && touching(i, n)) {
          seen[n] = 1;
          stack.push(n);
        }
      }
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        const n = nr * SIZE + nc;
        if (!colours[n] || !linked(i, n)) continue;
        // Already joined through a shared side: no neck needed.
        const sideA = r * SIZE + nc;
        const sideB = nr * SIZE + c;
        if ((colours[sideA] && touching(i, sideA)) || (colours[sideB] && touching(i, sideB))) continue;
        if (dr > 0) links.push([[r, c], [nr, nc]]);
        if (!seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    bodies.push({ colour: colours[start]!, cells, links });
  }
  return bodies;
}

/** The necks a piece needs between cells that only touch at a corner. */
export function shapeLinks(cells: readonly CellOffset[]): Link[] {
  const has = new Set(cells.map(([r, c]) => `${r},${c}`));
  const links: Link[] = [];
  for (const [r, c] of cells) {
    for (const dc of [-1, 1]) {
      if (has.has(`${r + 1},${c + dc}`) && !has.has(`${r},${c + dc}`) && !has.has(`${r + 1},${c}`)) links.push([[r, c], [r + 1, c + dc]]);
    }
  }
  return links;
}

/** Deterministic 0..1 noise for idle glances and blinks, so each body behaves a little differently. */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Where an idle body is looking right now, easing between random glances every second or two. */
export function idleGaze(seed: number, now: number): { x: number; y: number } {
  const period = 1400 + hash(seed, 1) * 1400;
  const step = Math.floor(now / period + seed);
  const k = Math.min(1, (now / period + seed - step) * 5);
  const from = {
    x: hash(seed, step - 1) * 2 - 1,
    y: (hash(step - 1, seed) * 2 - 1) * 0.7,
  };
  const to = {
    x: hash(seed, step) * 2 - 1,
    y: (hash(step, seed) * 2 - 1) * 0.7,
  };
  const ease = 1 - Math.pow(1 - k, 3);
  return {
    x: from.x + (to.x - from.x) * ease,
    y: from.y + (to.y - from.y) * ease,
  };
}

/** True for ~150 ms every few seconds, at a different moment for each body. */
export function isBlinking(seed: number, now: number): boolean {
  const period = 2600 + hash(seed, 7) * 2400;
  const phase = (now + hash(seed, 3) * period) % period;
  return phase < 150;
}

/** Unit-ish direction from a point to a target, for pupils that follow the held piece. */
export function gazeTowards(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

/** The separate pieces of a shape (a diagonal piece has several), so each one gets its own face. */
export function shapeParts(cells: readonly CellOffset[]): CellOffset[][] {
  const key = (cell: CellOffset) => `${cell[0]},${cell[1]}`;
  const left = new Map(cells.map((cell) => [key(cell), cell]));
  const parts: CellOffset[][] = [];
  for (const start of cells) {
    if (!left.has(key(start))) continue;
    left.delete(key(start));
    const part: CellOffset[] = [];
    const stack = [start];
    // An explicit stack, not recursion: a piece has at most nine cells.
    while (stack.length > 0) {
      const cell = stack.pop()!;
      part.push(cell);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const next = left.get(`${cell[0] + dr},${cell[1] + dc}`);
        if (next) {
          left.delete(key(next));
          stack.push(next);
        }
      }
    }
    parts.push(part);
  }
  return parts;
}

/**
 * Whether a piece that just landed (with no clear) earns a thought bubble, and where it goes in board cells.
 * Hemmed in on three quarters of its outline by walls and at least two other creatures" sides: squished (a bolt).
 * Snug against one other creature along three or more sides: they found each other (a heart).
 */
export function emoteFor(grid: readonly number[], cells: readonly (readonly [number, number])[], colour: number): { kind: "heart" | "bolt"; x: number; y: number } | null {
  const mine = new Set(cells.map(([r, c]) => r * SIZE + c));
  let edges = 0;
  let blocked = 0;
  const touches = new Map<number, { n: number; x: number; y: number }>();
  for (const [r, c] of cells) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && mine.has(nr * SIZE + nc)) continue;
      edges++;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) {
        blocked++;
        continue;
      }
      const other = grid[nr * SIZE + nc]!;
      if (!other) continue;
      blocked++;
      if (other === colour) continue;
      const t = touches.get(other) ?? { n: 0, x: 0, y: 0 };
      t.n++;
      t.x += c + 0.5 + dc * 0.5;
      t.y += r + 0.5 + dr * 0.5;
      touches.set(other, t);
    }
  }
  const contact = [...touches.values()].reduce((sum, t) => sum + t.n, 0);
  if (edges > 0 && blocked / edges >= 0.75 && contact >= 2) {
    const top = Math.min(...cells.map(([r]) => r));
    const right = Math.max(...cells.filter(([r]) => r === top).map(([, c]) => c));
    return { kind: "bolt", x: right + 0.9, y: top + 0.05 };
  }
  const best = [...touches.values()].sort((a, b) => b.n - a.n)[0];
  if (best && best.n >= 3) return { kind: "heart", x: best.x / best.n, y: best.y / best.n - 0.15 };
  return null;
}

/** What a thought bubble holds. */
export type EmoteKind = "heart" | "bolt" | "note" | "sweat" | "zzz" | "wow" | "star" | "puzzled" | "sparkle";

export function drawEmoteIcon(ctx: CanvasRenderingContext2D, kind: EmoteKind, x: number, y: number, s: number): void {
  ctx.beginPath();
  const glyph = (text: string, colour: string, scale = 1.9, weight = 800) => {
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${Math.round(s * scale)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + s * 0.08);
  };
  switch (kind) {
    case "heart":
      ctx.fillStyle = "#ef8f86";
      ctx.moveTo(x, y + s * 0.85);
      ctx.bezierCurveTo(x - s * 1.25, y - s * 0.05, x - s * 0.6, y - s * 1.05, x, y - s * 0.4);
      ctx.bezierCurveTo(x + s * 0.6, y - s * 1.05, x + s * 1.25, y - s * 0.05, x, y + s * 0.85);
      ctx.fill();
      break;
    case "bolt":
      ctx.fillStyle = "#4fa597";
      ctx.moveTo(x + s * 0.25, y - s);
      ctx.lineTo(x - s * 0.55, y + s * 0.12);
      ctx.lineTo(x - s * 0.02, y + s * 0.12);
      ctx.lineTo(x - s * 0.25, y + s);
      ctx.lineTo(x + s * 0.55, y - s * 0.15);
      ctx.lineTo(x + s * 0.02, y - s * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    case "sweat":
      ctx.fillStyle = "#8cc8ee";
      ctx.moveTo(x, y - s * 0.95);
      ctx.quadraticCurveTo(x + s * 0.75, y + s * 0.1, x, y + s * 0.75);
      ctx.quadraticCurveTo(x - s * 0.75, y + s * 0.1, x, y - s * 0.95);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(x - s * 0.18, y + s * 0.2, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "star":
      glyph("★", "#f5c34d", 2.2);
      break;
    case "sparkle":
      ctx.fillStyle = "#c7a7f2";
      ctx.moveTo(x, y - s);
      ctx.quadraticCurveTo(x, y, x + s, y);
      ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y);
      ctx.quadraticCurveTo(x, y, x, y - s);
      ctx.fill();
      break;
    case "note":
      glyph("♪", "#9b86d6", 2.1);
      break;
    case "zzz":
      ctx.fillStyle = "#8f9cc9";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(s * 0.95)}px system-ui, sans-serif`;
      ctx.fillText("z", x - s * 0.45, y + s * 0.35);
      ctx.font = `800 ${Math.round(s * 1.25)}px system-ui, sans-serif`;
      ctx.fillText("z", x + s * 0.05, y);
      ctx.font = `800 ${Math.round(s * 0.8)}px system-ui, sans-serif`;
      ctx.fillText("z", x + s * 0.55, y - s * 0.45);
      break;
    case "wow":
      glyph("!", "#ef8f86", 2);
      break;
    case "puzzled":
      glyph("?", "#a48ad8", 1.9);
      break;
  }
}
