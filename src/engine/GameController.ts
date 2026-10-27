/**
 * The game loop and input. Owns one run: its config, the logical state, the move log, and everything visual
 * (drag, snap, preview, animations, particles, shake). Rules live in rules.ts; this only asks them questions and
 * draws the answers.
 *
 * Input: drag a piece from the tray with touch, pen or mouse. On touch the piece floats above your finger so you
 * can see where it lands. Keyboard: 1/2/3 pick a piece, arrows move it, Enter or Space places it, Esc lets go.
 *
 * The loop only runs while something is moving (a drag, an animation, particles), so an idle board costs nothing.
 */
import { drawPraise, drawRainbowSweep, PRAISE_MS, praiseFor, type Praise } from './praise';
import { drawAccessory, sceneById, type Scene, type SceneId } from './scenes';
import type { BurstStyle } from '../lib/cosmetics';
import { masksOf, positions, SIZE } from './board';
import { bestMove } from './bot';
import { shapeById, type Shape } from './pieces';
import { BlockSprites, drawBoardBase, drawGem, Particles, type Skin, type Theme } from './renderer';
import { boardBodies, COZY_GREY, drawEmoteIcon, emoteFor, type EmoteKind, drawBlob, drawClearingBar, drawCozyBoard, drawEyes, faceAnchor, gazeTowards, idleGaze, isBlinking, shapeLinks, type CellOffset, type Mood } from './cozy';
import { drawEmbeddedGem, drawTearPuddle, drawTissue, isWinking, speciesFor } from './species';
import { applyRevive, reviveCells, applyMove, initialState, isLegal, previewLines } from './rules';
import type { GameState, Move, MoveEvents, RunConfig } from '../types/game';

export interface Look {
  skin: Skin;
  theme: Theme;
  burst: BurstStyle;
  reducedMotion: boolean;
  clearPreview: boolean;
  /** The Cozy look: pastel bodies with googly eyes (the default). False draws the Classic blocks. */
  cozy: boolean;
}

export interface ControllerEvents {
  onMove(events: MoveEvents, state: GameState, move: Move): void;
  onPick(): void;
  onReturn(): void;
  onOver(state: GameState): void;
  onChange(state: GameState): void;
  /** Cozy only: a nervous heartbeat while the board is nearly full (every beat). */
  onHeartbeat?(): void;
  /** Cozy only: few placements left, a soft patter of rain (every couple of seconds while it lasts). */
  onRain?(): void;
  /** A big clear: the scene's weather gets blown about. */
  onGust?(): void;
  /** A big clear earned praise (tier 1-5, 6 for an All Clear). */
  onPraise?(tier: number): void;
  /** Cozy only: a big clear took a nervous board back to roomy, and everyone sighs with relief. */
  onRelief?(): void;
}

interface Drag {
  slot: number;
  /** Pointer position (CSS px, canvas space). */
  px: number;
  py: number;
  lift: number;
  /** Where on the piece the finger took hold, as a fraction of its width and height, kept under the finger. */
  grab: { x: number; y: number };
  pointerId: number | null;
  keyboard: { r: number; c: number } | null;
}

interface Anim {
  kind: 'pop' | 'clear' | 'return' | 'deal' | 'over';
  t0: number;
  dur: number;
  cells?: { i: number; colour: number; gem?: boolean; delay?: number }[];
  slot?: number;
  from?: { x: number; y: number };
}

interface FloatText {
  text: string;
  x: number;
  y: number;
  t0: number;
  colour: string;
  big: boolean;
}

/** How full the board is (cells) when the creatures start to sweat. */
const NERVOUS_CELLS = 40;

/** On touch, how far above the fingertip the held piece's bottom edge floats, in cells. */
const TOUCH_LIFT_CELLS = 0.45;

/** How long a big clear holds before it pops (the anticipation beat). */
const HIT_STOP_MS = 90;

/** Fewer valid placements than this across the tray, and it starts to rain. */
const RAIN_BELOW_PLACEMENTS = 8;

/** Body colour code for cells a drop is about to clear (1–7 are pieces, 8 is game-over grey). */
const CLEARING_BODY = 9;

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

/** Score popups in the Cozy look: soft, readable colours on a white outline instead of neon on navy. */
function cozyText(colour: string): string {
  const COZY: Record<string, string> = { '#ffffff': '#8a6f5e', '#fde047': '#e59a4c', '#a5f3fc': '#5aa69a', '#f9a8d4': '#e0788a' };
  return COZY[colour] ?? '#8a6f5e';
}

export class GameController {
  state: GameState;
  log: Move[] = [];
  hinted = false;
  private ctx: CanvasRenderingContext2D;
  private sprites: BlockSprites;
  private particles = new Particles();
  private drag: Drag | null = null;
  private anims: Anim[] = [];
  private floats: FloatText[] = [];
  private hint: Move | null = null;
  private raf = 0;
  private shake = 0;
  private paused = false;
  private destroyed = false;
  private overFired = false;
  private dpr = 1;
  // Layout (CSS px).
  private W = 0;
  private H = 0;
  private cell = 0;
  private bx = 0;
  private by = 0;
  private trayY = 0;
  private trayH = 0;
  /** Which placed piece each board cell came from, so a piece stays one body with one face. 0 = unknown. */
  private owners: number[] = new Array<number>(SIZE * SIZE).fill(0);
  private nextOwner = 1;
  /** Faces squint happily until this time, after a clear. */
  private happyUntil = 0;
  /** The cells of the piece that just landed, which bounce for a moment (squash and stretch). */
  private landing: { cells: Set<number>; t0: number } | null = null;
  /** When everyone last sighed with relief, and when the revive tissue started dabbing. */
  private reliefAt = -Infinity;
  private tissueAt = -Infinity;
  /** When the faces started crying or celebrating, for growing tear puddles. */
  private endedAt: number | null = null;
  private lastHeartbeat = 0;
  /** Cozy hit-stop: the cleared lines hold as one bar for a beat before they pop (anticipation). */
  private clearFlash: { cells: Set<number>; until: number } | null = null;
  /** Bursts waiting for the hit-stop to end. */
  private pendingBursts: { at: number; x: number; y: number; colour: string; count: number }[] = [];
  /** A light wave running out along the cleared lines from where the piece landed. */
  private shockwave: { rows: number[]; cols: number[]; row: number; column: number; t0: number } | null = null;
  /** Combo glow round the edges of the board from x4 up. */
  private comboGlow: { t0: number; strength: number } | null = null;
  private lastRain = 0;
  private lastCheer = 0;
  /**
   * Thought bubbles over the creatures (in board cells): hearts when pieces snuggle, bolts when squished, notes
   * and stars when lines clear, sweat on a crowded board, Zzz from the sleepy ones, "!" when a big piece lands
   * next door and "?" from a tray piece that fits nowhere.
   */
  private emotes: { kind: EmoteKind; x: number; y: number; t0: number }[] = [];
  private nextAmbientEmote = performance.now() + 4000;
  private puzzledKey = '';
  /** Praise for a big clear ("Sweet!" ... "Legendary!", "All Clear!"), and a soft white flash for the biggest. */
  private praise: (Praise & { t0: number }) | null = null;
  private flash: { t0: number; strength: number } | null = null;
  /** The scene the creatures are in: its outfit goes on every face and its little things burst from clears. */
  private scene: Scene | null = null;
  /** A game that ends on a new best is a happy ending, too: the creatures celebrate instead of crying. */
  private celebrate = false;
  /** How fast the held piece is moving (CSS px per ms), smoothed, for its stretch. */
  private dragVelocity = { x: 0, y: 0, at: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    public cfg: RunConfig,
    private look: Look,
    private ev: ControllerEvents,
    resume?: { log: Move[]; hinted: boolean },
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.state = initialState(cfg);
    if (resume) {
      for (const mv of resume.log) {
        if (this.state.over || !isLegal(this.state, mv)) break;
        this.state = applyMove(cfg, this.state, mv).state;
        this.log.push(mv);
      }
      this.hinted = resume.hinted;
    }
    this.sprites = new BlockSprites(look.skin, 1);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMoveP);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    this.resize();
    this.anims.push({ kind: 'deal', t0: performance.now(), dur: 260 });
    this.kick();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMoveP);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
  }

  setLook(look: Look): void {
    this.look = look;
    this.sprites = new BlockSprites(look.skin, this.dpr);
    this.kick();
  }

  setScene(id: SceneId | null): void {
    this.scene = id ? sceneById(id) : null;
    this.kick();
  }

  setCelebrate(on: boolean): void {
    this.celebrate = on;
  }

  private isHappyEnding(): boolean {
    return this.state.won || this.celebrate;
  }

  private addEmote(kind: EmoteKind, x: number, y: number, t0: number): void {
    if (this.emotes.length >= 3 || this.emotes.some((e) => Math.hypot(e.x - x, e.y - y) < 1.2)) return;
    this.emotes.push({ kind, x, y, t0 });
  }

  /** Every creature on the board, with where its thought bubble goes (by its face) in board cells. */
  private creatureSpots(): { x: number; y: number; colour: number; cells: readonly CellOffset[] }[] {
    return boardBodies(this.state.grid.slice(), this.owners.slice())
      .filter((b) => b.colour >= 1 && b.colour <= 7)
      .map((b) => {
        const a = faceAnchor(b.cells);
        return { x: Math.min(SIZE - 0.35, a.x + 0.45), y: Math.max(0.35, a.y - 0.55), colour: b.colour, cells: b.cells };
      });
  }

  /** Cozy clears pop into stars, mixed with the scene's own little things (petals, bubbles, snowflakes...). */
  private clearBurst(x: number, y: number, colour: string, count: number): void {
    if (!this.scene) {
      this.particles.burst(x, y, colour, this.cell, 'stars', count, true);
      return;
    }
    this.particles.burst(x, y, colour, this.cell, 'stars', Math.ceil(count / 2), true);
    this.particles.burstScene(x, y, colour, this.cell, this.scene.burst, Math.floor(count / 2) + 1);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.drag = null;
    this.kick();
  }

  /** Fit the canvas to its box: a square board with the tray below it. */
  resize(): void {
    const box = this.canvas.parentElement!.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.floor(box.width);
    const maxH = Math.floor(box.height);
    // Board is 8 cells plus padding; the tray needs ~3.4 cells beneath it.
    const cell = Math.floor(Math.min((W - 24) / SIZE, (maxH - 24) / (SIZE + 3.9)));
    this.cell = Math.max(12, cell);
    this.W = W;
    this.bx = Math.round((W - this.cell * SIZE) / 2);
    this.by = Math.round(this.cell * 0.4);
    this.trayY = this.by + this.cell * SIZE + this.cell * 0.55;
    this.trayH = this.cell * 3.1;
    this.H = Math.ceil(this.trayY + this.trayH);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.sprites = new BlockSprites(this.look.skin, this.dpr);
    this.kick();
  }

  // ----- moves -----

  private commit(mv: Move): void {
    const before = this.state;
    const filledBefore = before.grid.filter((v) => v !== 0).length;
    const r = applyMove(this.cfg, this.state, mv);
    this.state = r.state;
    this.log.push(mv);
    this.hint = null;
    const now = performance.now();
    const sh = shapeById(before.tray[mv.slot]!.shape);
    for (const [dr, dc] of sh.cells) this.owners[(mv.r + dr) * SIZE + mv.c + dc] = this.nextOwner;
    this.landing = { cells: new Set(sh.cells.map(([dr, dc]) => (mv.r + dr) * SIZE + mv.c + dc)), t0: now };
    this.nextOwner++;
    this.anims.push({ kind: 'pop', t0: now, dur: 160, cells: sh.cells.map(([dr, dc]) => ({ i: (mv.r + dr) * SIZE + mv.c + dc, colour: before.tray[mv.slot]!.colour })) });
    const e = r.events;
    if (e.cleared.length) {
      this.happyUntil = now + 1100;
      // A nervous board (the sweating kind) cleared back below 40% full: a collective sigh of relief.
      const filledAfter = this.state.grid.filter((v) => v !== 0).length;
      if (this.look.cozy && filledBefore >= NERVOUS_CELLS && filledAfter < SIZE * SIZE * 0.4) {
        this.reliefAt = now + 500;
        this.ev.onRelief?.();
      }
      const cx = mv.c + sh.w / 2;
      const cy = mv.r + sh.h / 2;
      const cells = e.cleared.map((x) => {
        const dist = Math.hypot((x.i % SIZE) + 0.5 - cx, Math.floor(x.i / SIZE) + 0.5 - cy);
        return { ...x, delay: this.look.reducedMotion ? 0 : dist * 22 };
      });
      this.anims.push({ kind: 'clear', t0: now, dur: this.look.reducedMotion ? 180 : 320, cells });
      // Cozy: the lines hold as one bar for a short beat, then pop; the bigger the clear, the longer the beat.
      const lineCount = e.rows.length + e.cols.length;
      const hitStop = this.look.cozy ? (lineCount >= 3 || e.combo >= 3 ? HIT_STOP_MS : lineCount >= 2 ? HIT_STOP_MS / 2 : 0) : 0;
      if (hitStop > 0) this.clearFlash = { cells: new Set(e.cleared.map((x) => x.i)), until: now + hitStop };
      if (this.look.cozy && !this.look.reducedMotion) {
        this.shockwave = { rows: e.rows, cols: e.cols, row: mv.r + sh.h / 2, column: mv.c + sh.w / 2, t0: now + hitStop };
        if (e.combo >= 4) {
          this.comboGlow = { t0: now + hitStop, strength: Math.min(1, (e.combo - 3) / 4) };
          this.shake = Math.max(this.shake, this.cell * 0.12);
        }
      }
      if (!this.look.reducedMotion) {
        const per = e.cleared.length > 24 ? 2 : 4;
        for (const x of e.cleared) {
          const px = this.bx + ((x.i % SIZE) + 0.5) * this.cell;
          const py = this.by + (Math.floor(x.i / SIZE) + 0.5) * this.cell;
          // Cozy creatures pop into stars in their own colour, once the hit-stop lets go.
          if (hitStop > 0) this.pendingBursts.push({ at: now + hitStop, x: px, y: py, colour: this.sprites.colourOf(x.colour), count: per });
          else if (this.look.cozy) this.clearBurst(px, py, this.sprites.colourOf(x.colour), per);
          else this.particles.burst(px, py, this.sprites.colourOf(x.colour), this.cell, this.look.burst, per);
        }
        const lines = e.rows.length + e.cols.length;
        if (lines >= 3 || e.perfect) this.shake = this.cell * (e.perfect ? 0.35 : 0.2);
      }
      const fx = this.bx + cx * this.cell;
      const fy = this.by + cy * this.cell;
      this.floats.push({ text: `+${e.placePoints + e.clearPoints + e.perfectPoints}`, x: fx, y: fy, t0: now, colour: '#ffffff', big: false });
      if (e.combo >= 2) this.floats.push({ text: `Combo x${e.combo}`, x: this.W / 2, y: this.by + this.cell * 2.2, t0: now + 60, colour: '#fde047', big: true });
      const cheer = this.look.cozy ? praiseFor(e.rows.length + e.cols.length, e.combo, e.perfect) : null;
      if (cheer) {
        // Cozy: a praise word over soft rays, confetti from both sides, and a flash on the biggest ones.
        this.praise = { ...cheer, t0: now + hitStop + 40 };
        this.ev.onPraise?.(cheer.tier);
        if (!this.look.reducedMotion) {
          const burst = this.scene?.burst ?? 'sparkle';
          const n = 4 + cheer.tier * 3;
          for (const side of [0, 1]) {
            for (let k = 0; k < 3; k++) {
              const px = this.bx + side * this.cell * SIZE;
              const py = this.by + this.cell * (2 + k * 2);
              this.particles.burstScene(px, py, '#f7cd5e', this.cell, burst, Math.ceil(n / 3));
              this.particles.burst(px, py, '#f7cd5e', this.cell, 'stars', 2, true);
            }
          }
          if (cheer.tier >= 3) this.flash = { t0: now + hitStop, strength: Math.min(1, cheer.tier / 6) };
        }
      } else if (e.perfect) this.floats.push({ text: 'Perfect Clear!', x: this.W / 2, y: this.by + this.cell * 4, t0: now + 120, colour: '#a5f3fc', big: true });
      else if (e.rows.length + e.cols.length >= 3) this.floats.push({ text: e.rows.length + e.cols.length >= 4 ? 'Incredible!' : 'Great!', x: this.W / 2, y: this.by + this.cell * 4, t0: now + 120, colour: '#f9a8d4', big: true });
    }
    if (this.look.cozy) this.reactToMove(e, mv, sh, before.tray[mv.slot]!.colour, now);
    if (e.dealt) this.anims.push({ kind: 'deal', t0: now + 120, dur: 260 });
    this.ev.onMove(e, this.state, mv);
    this.ev.onChange(this.state);
    if (this.state.over) this.anims.push({ kind: 'over', t0: now + 380, dur: this.look.reducedMotion ? 200 : 700 });
    this.kick();
  }

  /** Thought bubbles in answer to a move. */
  private reactToMove(e: MoveEvents, mv: Move, sh: Shape, colour: number, now: number): void {
    const placed = new Set(sh.cells.map(([dr, dc]) => (mv.r + dr) * SIZE + mv.c + dc));
    const spots = this.creatureSpots().filter((spot) => !spot.cells.some(([r, c]) => placed.has(r * SIZE + c)));
    if (e.cleared.length) {
      // Clears: the creatures nearest the lines sing (or see stars on a big one).
      const cy = e.rows.length ? e.rows.reduce((a, b) => a + b, 0) / e.rows.length + 0.5 : mv.r + sh.h / 2;
      const cx = e.cols.length ? e.cols.reduce((a, b) => a + b, 0) / e.cols.length + 0.5 : mv.c + sh.w / 2;
      const big = e.combo >= 3 || e.perfect || e.rows.length + e.cols.length >= 3;
      const near = spots.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, big ? 3 : 1);
      near.forEach((spot, k) => this.addEmote(big ? (k % 2 ? 'heart' : 'star') : 'note', spot.x, spot.y, now + 200 + k * 140));
      if (e.rows.length + e.cols.length >= 2) this.ev.onGust?.();
      return;
    }
    const cells = sh.cells.map(([dr, dc]) => [mv.r + dr, mv.c + dc] as const);
    const kind = emoteFor(this.state.grid, cells, colour);
    if (kind) {
      this.addEmote(kind.kind, kind.x, kind.y, now + 120);
      return;
    }
    // A big piece thumping down right next door startles the neighbours.
    if (sh.cells.length >= 5) {
      const next = spots.find((spot) => spot.cells.some(([r, c]) => [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => placed.has((r + dr) * SIZE + c + dc))));
      if (next) this.addEmote('wow', next.x, next.y, now + 120);
    }
  }

  /** Now and then, with nothing happening, someone has a little moment. */
  private ambientEmote(now: number): void {
    if (now < this.nextAmbientEmote || this.emotes.length > 0 || this.drag || this.paused || this.state.over) return;
    this.nextAmbientEmote = now + 3500 + Math.random() * 4500;
    // A piece that fits nowhere wonders why.
    for (let slot = 0; slot < 3; slot++) {
      const p = this.state.tray[slot];
      if (!p) continue;
      const sh = shapeById(p.shape);
      const key = `${this.log.length}:${slot}`;
      if (this.fitsAnywhere(sh) || this.puzzledKey === key) continue;
      this.puzzledKey = key;
      const o = this.trayOrigin(slot, sh);
      const tc = this.trayCell();
      this.addEmote('puzzled', (o.x + sh.w * tc - this.bx) / this.cell + 0.1, (o.y - this.by) / this.cell - 0.1, now);
      return;
    }
    const spots = this.creatureSpots();
    const spot = spots[Math.floor(Math.random() * spots.length)];
    if (!spot) return;
    const sleepy = speciesFor(spot.colour).temperament === 'sleepy';
    if (this.isTense()) this.addEmote('sweat', spot.x, spot.y, now);
    else if (sleepy) this.addEmote('zzz', spot.x, spot.y, now);
    else if (Math.random() < 0.5) this.addEmote((['note', 'heart', 'sparkle'] as const)[Math.floor(Math.random() * 3)]!, spot.x, spot.y, now);
  }

  /**
   * Revive a stuck game: clear the fewest blocks that let a tray piece fit (at least three) and play on. The run
   * no longer replays from its moves, so it counts as assisted, like a hinted game. Returns false if not stuck.
   */
  revive(): boolean {
    if (!this.state.over || this.state.won) return false;
    const cells = reviveCells(this.cfg, this.state);
    const now = performance.now();
    const colours = cells.map((i) => this.state.grid[i]!);
    this.state = applyRevive(this.state, cells);
    this.hinted = true;
    this.overFired = false;
    this.endedAt = null;
    this.anims = this.anims.filter((a) => a.kind !== 'over');
    this.anims.push({ kind: 'clear', t0: now + (this.look.cozy ? 700 : 0), dur: 320, cells: cells.map((i, k) => ({ i, colour: colours[k]!, delay: k * 60 })) });
    if (this.look.cozy) {
      // A tissue dabs every face dry, then the blocks pop away and everyone smiles again.
      this.tissueAt = now;
      this.happyUntil = now + 2200;
      if (!this.look.reducedMotion) {
        cells.forEach((i, k) => {
          const px = this.bx + ((i % SIZE) + 0.5) * this.cell;
          const py = this.by + (Math.floor(i / SIZE) + 0.5) * this.cell;
          this.particles.burst(px, py, this.sprites.colourOf(colours[k]!), this.cell, 'stars', 4);
        });
      }
    }
    this.ev.onChange(this.state);
    this.kick();
    return true;
  }

  /** Show Burst Bot's move (the labelled 💡 assist). Marks the game as hinted. */
  showHint(): Move | null {
    if (this.state.over) return null;
    this.hint = bestMove(this.state);
    if (this.hint) {
      this.hinted = true;
      this.ev.onChange(this.state);
    }
    this.kick();
    return this.hint;
  }

  /** Let Burst Bot make one move (dev and test hook: the PlayScreen exposes it as __burst.botMove in dev builds). */
  botMove(): boolean {
    const mv = this.state.over ? null : bestMove(this.state);
    if (mv) this.commit(mv);
    return !!mv;
  }

  // ----- geometry -----

  private slotRect(slot: number): { x: number; y: number; w: number; h: number } {
    const w = this.W / 3;
    return { x: slot * w, y: this.trayY, w, h: this.trayH };
  }

  private trayCell(): number {
    return this.cell * 0.55;
  }

  private trayOrigin(slot: number, sh: Shape): { x: number; y: number } {
    const r = this.slotRect(slot);
    const tc = this.trayCell();
    return { x: r.x + (r.w - sh.w * tc) / 2, y: r.y + (r.h - sh.h * tc) / 2 };
  }

  /** Board cell the dragged piece would snap to (its top-left), from its floating position. */
  private dragTarget(d: Drag): { r: number; c: number; x: number; y: number } | null {
    const p = this.state.tray[d.slot];
    if (!p) return null;
    const sh = shapeById(p.shape);
    if (d.keyboard) return { ...d.keyboard, x: this.bx + d.keyboard.c * this.cell, y: this.by + d.keyboard.r * this.cell };
    const x = d.px - d.grab.x * sh.w * this.cell;
    const y = d.py - d.grab.y * sh.h * this.cell - d.lift;
    return { r: Math.round((y - this.by) / this.cell), c: Math.round((x - this.bx) / this.cell), x, y };
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ----- pointer input -----

  private onDown = (e: PointerEvent) => {
    if (this.paused || this.state.over || this.drag) return;
    const { x, y } = this.local(e);
    if (y < this.trayY - this.cell * 0.4) return;
    const slot = Math.max(0, Math.min(2, Math.floor(x / (this.W / 3))));
    if (!this.state.tray[slot]) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture for a pointer that is already gone; the drag still works without it.
    }
    // 1:1 with the finger: the point of the piece that was touched in the tray stays under the fingertip,
    // scaled up to board size. A touch outside the piece's box takes hold of its nearest edge.
    const sh = shapeById(this.state.tray[slot]!.shape);
    const origin = this.trayOrigin(slot, sh);
    const size = this.trayCell();
    const grab = {
      x: Math.min(1, Math.max(0, (x - origin.x) / (sh.w * size))),
      y: Math.min(1, Math.max(0, (y - origin.y) / (sh.h * size))),
    };
    // On touch the piece floats just above the fingertip (like Block Blast), so the finger never hides the cells it
    // is aimed at: its bottom edge sits a small gap above the touch point. A mouse cursor hides nothing, so with a
    // mouse the grabbed point stays exactly under it.
    const isTouch = e.pointerType !== 'mouse';
    if (isTouch) grab.y = 1;
    const lift = isTouch ? this.cell * TOUCH_LIFT_CELLS : 0;
    this.drag = { slot, px: x, py: y, lift, grab, pointerId: e.pointerId, keyboard: null };
    this.ev.onPick();
    this.kick();
  };

  private onMoveP = (e: PointerEvent) => {
    if (!this.drag || this.drag.pointerId !== e.pointerId) return;
    const { x, y } = this.local(e);
    const at = performance.now();
    const elapsed = Math.max(1, at - this.dragVelocity.at);
    if (this.dragVelocity.at > 0 && elapsed < 100) {
      const blend = 0.35;
      this.dragVelocity.x += ((x - this.drag.px) / elapsed - this.dragVelocity.x) * blend;
      this.dragVelocity.y += ((y - this.drag.py) / elapsed - this.dragVelocity.y) * blend;
    }
    this.dragVelocity.at = at;
    this.drag.px = x;
    this.drag.py = y;
    this.kick();
  };

  private onUp = (e: PointerEvent) => {
    if (!this.drag || this.drag.pointerId !== e.pointerId) return;
    this.drop();
  };

  private onCancel = (e: PointerEvent) => {
    if (!this.drag || this.drag.pointerId !== e.pointerId) return;
    this.letGo();
  };

  private drop(): void {
    const d = this.drag!;
    const t = this.dragTarget(d);
    this.drag = null;
    if (t && isLegal(this.state, { slot: d.slot, r: t.r, c: t.c })) this.commit({ slot: d.slot, r: t.r, c: t.c });
    else {
      if (t) this.anims.push({ kind: 'return', t0: performance.now(), dur: 180, slot: d.slot, from: { x: t.x, y: t.y } });
      this.ev.onReturn();
      this.kick();
    }
  }

  private letGo(): void {
    if (!this.drag) return;
    const t = this.dragTarget(this.drag);
    if (t) this.anims.push({ kind: 'return', t0: performance.now(), dur: 180, slot: this.drag.slot, from: { x: t.x, y: t.y } });
    this.drag = null;
    this.kick();
  }

  // ----- keyboard input -----

  key(k: string): boolean {
    if (this.paused || this.state.over) return false;
    if (k === '1' || k === '2' || k === '3') {
      const slot = Number(k) - 1;
      if (!this.state.tray[slot]) return true;
      const sh = shapeById(this.state.tray[slot]!.shape);
      // Start on the free spot nearest the middle (or the middle, if the piece fits nowhere).
      const mid = { r: (SIZE - sh.h) / 2, c: (SIZE - sh.w) / 2 };
      let start = { r: Math.floor(mid.r), c: Math.floor(mid.c) };
      let bestD = Infinity;
      for (let r = 0; r + sh.h <= SIZE; r++) {
        for (let c = 0; c + sh.w <= SIZE; c++) {
          const d = Math.hypot(r - mid.r, c - mid.c);
          if (d < bestD && isLegal(this.state, { slot, r, c })) {
            bestD = d;
            start = { r, c };
          }
        }
      }
      this.drag = { slot, px: 0, py: 0, lift: 0, grab: { x: 0.5, y: 0.5 }, pointerId: null, keyboard: start };
      this.ev.onPick();
      this.kick();
      return true;
    }
    const d = this.drag;
    if (!d?.keyboard) return false;
    const sh = shapeById(this.state.tray[d.slot]!.shape);
    const kb = d.keyboard;
    if (k === 'ArrowUp') kb.r = Math.max(0, kb.r - 1);
    else if (k === 'ArrowDown') kb.r = Math.min(SIZE - sh.h, kb.r + 1);
    else if (k === 'ArrowLeft') kb.c = Math.max(0, kb.c - 1);
    else if (k === 'ArrowRight') kb.c = Math.min(SIZE - sh.w, kb.c + 1);
    else if (k === 'Enter' || k === ' ') {
      this.drop();
      return true;
    } else if (k === 'Escape') {
      this.drag = null;
      this.kick();
      return true;
    } else return false;
    this.kick();
    return true;
  }

  // ----- loop -----

  private kick(): void {
    if (this.destroyed || this.raf) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.destroyed) return;
    this.particles.step(this.cell, this.look.cozy ? 'stars' : this.look.burst);
    // The stretch relaxes once the finger slows down.
    this.dragVelocity.x *= 0.85;
    this.dragVelocity.y *= 0.85;
    this.anims = this.anims.filter((a) => {
      const done = now - a.t0 >= a.dur + (a.cells ? Math.max(0, ...a.cells.map((c) => c.delay ?? 0)) : 0);
      if (done && a.kind === 'over' && !this.overFired) {
        this.overFired = true;
        this.ev.onOver(this.state);
      }
      return !done;
    });
    this.floats = this.floats.filter((f) => now - f.t0 < this.floatMs());
    this.shake *= 0.85;
    if (this.shake < 0.3) this.shake = 0;
    this.draw(now);
    // A won board keeps throwing little bursts of stars from its celebrating creatures.
    if (this.look.cozy) this.ambientEmote(now);
    if (this.look.cozy && this.state.over && this.isHappyEnding() && !this.look.reducedMotion && now - this.lastCheer > 380) {
      this.lastCheer = now;
      // Hearts and stars pop up over the party, a few at a time.
      if (Math.random() < 0.35) {
        const spots = this.creatureSpots();
        const spot = spots[Math.floor(Math.random() * spots.length)];
        if (spot) this.addEmote(Math.random() < 0.5 ? 'heart' : 'star', spot.x, spot.y, now);
      }
      const filled = this.state.grid.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      const pick = filled[Math.floor(Math.random() * filled.length)];
      if (pick !== undefined) {
        const colour = this.state.grid[pick]!;
        this.particles.burst(this.bx + ((pick % SIZE) + 0.5) * this.cell, this.by + Math.floor(pick / SIZE) * this.cell, this.sprites.colourOf(colour), this.cell, 'stars', 6);
      }
    }
    if (this.pendingBursts.length > 0) {
      const due = this.pendingBursts.filter((burst) => burst.at <= now);
      this.pendingBursts = this.pendingBursts.filter((burst) => burst.at > now);
      for (const burst of due) this.clearBurst(burst.x, burst.y, burst.colour, burst.count);
    }
    // Nearly locked: a soft patter of rain while few placements are left.
    if (this.look.cozy && !this.paused && !this.state.over && now - this.lastRain > 1800 && this.isNearlyLocked()) {
      this.lastRain = now;
      this.ev.onRain?.();
    }
    // A soft heartbeat while three quarters of the board is full.
    if (this.look.cozy && !this.paused && !this.state.over && now - this.lastHeartbeat > 900 && this.state.grid.filter((v) => v !== 0).length >= SIZE * SIZE * 0.75) {
      this.lastHeartbeat = now;
      this.ev.onHeartbeat?.();
    }
    const pulsing = !!this.hint || this.state.gems.length > 0 || this.emotes.length > 0 || this.praise !== null || this.flash !== null;
    if (this.drag || this.anims.length || this.floats.length || this.particles.active || this.shake || (pulsing && !this.paused) || (this.look.cozy && !this.look.reducedMotion && !this.paused)) this.kick();
  };

  private draw(now: number): void {
    const ctx = this.ctx;
    const cell = this.cell;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.shake) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    if (this.look.cozy) {
      drawCozyBoard(ctx, this.bx, this.by, cell);
      this.drawComboGlow(now);
    }
    else drawBoardBase(ctx, this.bx, this.by, cell, this.look.theme);

    const clearing = new Map<number, { colour: number; k: number; gem: boolean }>();
    const popping = new Map<number, number>();
    let over: number | null = null;
    for (const a of this.anims) {
      const t = now - a.t0;
      if (a.kind === 'clear') for (const c of a.cells!) clearing.set(c.i, { colour: c.colour, k: Math.min(1, Math.max(0, (t - (c.delay ?? 0)) / a.dur)), gem: !!c.gem });
      if (a.kind === 'pop') for (const c of a.cells!) popping.set(c.i, Math.min(1, Math.max(0, t / a.dur)));
      if (a.kind === 'over') over = Math.min(1, Math.max(0, t / a.dur));
    }
    if (this.state.over && !this.anims.some((a) => a.kind === 'over')) over = 1;

    // Line-clear preview: the lines a drop would complete, tinted in the piece's colour (Block Blast's tell).
    let preview: { r: number; c: number; rows: number[]; cols: number[]; colour: number } | null = null;
    if (this.drag) {
      const t = this.dragTarget(this.drag);
      if (t) {
        const lines = previewLines(this.state, { slot: this.drag.slot, r: t.r, c: t.c });
        if (lines) preview = { r: t.r, c: t.c, rows: lines.rows, cols: lines.cols, colour: this.state.tray[this.drag.slot]!.colour };
      }
    }
    const lineSet = new Set<number>();
    if (preview && this.look.clearPreview) {
      for (const r of preview.rows) for (let c = 0; c < SIZE; c++) lineSet.add(r * SIZE + c);
      for (const c of preview.cols) for (let r = 0; r < SIZE; r++) lineSet.add(r * SIZE + c);
    }
    const gemSet = new Set(this.state.gems);
    // Where the held piece would land (cells the bar doesn't take), so its new neighbours can react.
    const ghost = new Set<number>();
    if (preview) for (const [dr, dc] of shapeById(this.state.tray[this.drag!.slot]!.shape).cells) ghost.add((preview.r + dr) * SIZE + preview.c + dc);
    if (this.look.cozy) this.drawBodies(now, lineSet, over, ghost);

    for (let i = 0; i < SIZE * SIZE; i++) {
      const x = this.bx + (i % SIZE) * cell;
      const y = this.by + Math.floor(i / SIZE) * cell;
      const v = this.state.grid[i];
      if (v && !this.look.cozy) {
        const k = popping.get(i);
        const s = k === undefined ? 1 : 1 + Math.sin(k * Math.PI) * 0.12;
        let colour = lineSet.has(i) ? preview!.colour : v;
        if (over !== null) {
          // Game over: a sweep greys the board out, top to bottom.
          const row = Math.floor(i / SIZE);
          if (over * (SIZE + 2) > row) colour = 0;
        }
        const img = this.sprites.get(colour, cell);
        const d = (cell * (s - 1)) / 2;
        ctx.drawImage(img, x - d, y - d, cell * s, cell * s);
        if (gemSet.has(i)) drawGem(ctx, x, y, cell, now);
      }
      const cl = clearing.get(i);
      // Cozy: cleared lines vanish the moment the piece lands (the bar already showed what would go).
      if (cl && !this.look.cozy) {
        const s = 1 - ease(cl.k);
        if (s > 0) {
          ctx.globalAlpha = s;
          const img = this.sprites.get(cl.colour, cell);
          const d = (cell * (1 - s)) / 2;
          ctx.drawImage(img, x + d, y + d, cell * s, cell * s);
          if (cl.k < 0.35) {
            ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - cl.k / 0.35)})`;
            ctx.fillRect(x + d, y + d, cell * s, cell * s);
          }
          if (cl.gem) this.gem(x + d, y + d - (1 - s) * cell, cell * s, now);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Ghost where the dragged piece would land.
    if (preview) {
      const sh = shapeById(this.state.tray[this.drag!.slot]!.shape);
      ctx.globalAlpha = 0.38;
      if (this.look.cozy) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.bx, this.by, cell * SIZE, cell * SIZE);
        ctx.clip();
        const outside = sh.cells.filter(([dr, dc]) => !lineSet.has((preview.r + dr) * SIZE + preview.c + dc));
        drawBlob(ctx, outside, this.bx + preview.c * cell, this.by + preview.r * cell, cell, this.sprites.colourOf(preview.colour), { links: shapeLinks(outside), species: speciesFor(preview.colour) });
        ctx.restore();
      }
      else {
        const img = this.sprites.get(preview.colour, cell);
        for (const [dr, dc] of sh.cells) ctx.drawImage(img, this.bx + (preview.c + dc) * cell, this.by + (preview.r + dr) * cell, cell, cell);
      }
      ctx.globalAlpha = 1;
    }

    // Hint: Burst Bot's move, outlined.
    if (this.hint && this.state.tray[this.hint.slot]) {
      const sh = shapeById(this.state.tray[this.hint.slot]!.shape);
      const pulse = this.look.reducedMotion ? 0.8 : 0.55 + Math.sin(now / 180) * 0.35;
      ctx.strokeStyle = `rgba(253,224,71,${pulse})`;
      ctx.lineWidth = Math.max(2, cell * 0.08);
      for (const [dr, dc] of sh.cells) ctx.strokeRect(this.bx + (this.hint.c + dc) * cell + 3, this.by + (this.hint.r + dr) * cell + 3, cell - 6, cell - 6);
      const r = this.slotRect(this.hint.slot);
      ctx.strokeRect(r.x + 6, r.y + 2, r.w - 12, r.h - 4);
    }

    // Tray.
    const deal = this.anims.find((a) => a.kind === 'deal');
    const dealK = deal ? ease(Math.min(1, Math.max(0, (now - deal.t0) / deal.dur))) : 1;
    const tc = this.trayCell();
    if (this.look.cozy) {
      // The pen: a soft, dashed corral that keeps the pieces in waiting apart from the board.
      const m = Math.min(this.W * 0.03, cell * 0.3);
      const px = Math.max(m, this.bx - cell * 0.22);
      const pw = Math.min(this.W - m * 2, cell * SIZE + cell * 0.44);
      ctx.fillStyle = 'rgba(232,220,207,0.55)';
      ctx.beginPath();
      ctx.roundRect(px, this.trayY, pw, this.trayH, cell * 0.35);
      ctx.fill();
      ctx.setLineDash([cell * 0.16, cell * 0.16]);
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      const inset = cell * 0.14;
      ctx.beginPath();
      ctx.roundRect(px + inset, this.trayY + inset, pw - inset * 2, this.trayH - inset * 2, cell * 0.25);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (let slot = 0; slot < 3; slot++) {
      const p = this.state.tray[slot];
      if (!p || this.drag?.slot === slot) continue;
      const sh = shapeById(p.shape);
      const o = this.trayOrigin(slot, sh);
      const ret = this.anims.find((a) => a.kind === 'return' && a.slot === slot);
      const m = this.state.over ? false : this.fitsAnywhere(sh);
      let ox = o.x;
      let oy = o.y + (1 - dealK) * cell * 1.5;
      let size = tc;
      if (ret) {
        const k = ease(Math.min(1, (now - ret.t0) / ret.dur));
        ox = ret.from!.x + (o.x - ret.from!.x) * k;
        oy = ret.from!.y + (o.y - ret.from!.y) * k;
        size = cell + (tc - cell) * k;
      }
      ctx.globalAlpha = (m ? 1 : 0.35) * (deal ? dealK : 1);
      if (this.look.cozy) {
        // At the end of a game the tray keeps its colour and shares the board's mood; before that, a piece that
        // fits nowhere greys out and dozes.
        const isEnded = this.state.over;
        const isAwake = m || isEnded;
        if (isEnded) ctx.globalAlpha = 1;
        const endMood: Mood = this.isHappyEnding() ? 'celebrating' : 'crying';
        drawBlob(ctx, sh.cells, ox, oy, size, isAwake ? this.sprites.colourOf(p.colour) : COZY_GREY, { links: shapeLinks(sh.cells), species: speciesFor(p.colour) });
        this.face(sh.cells, ox, oy, size, now, 100 + slot, isEnded ? endMood : m ? 'normal' : 'blink', undefined, undefined, isAwake ? p.colour : 8);
      } else {
        const img = this.sprites.get(m ? p.colour : 0, size);
        for (const [dr, dc] of sh.cells) ctx.drawImage(img, ox + dc * size, oy + dr * size, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // The dragged piece, full size, floating above the finger.
    if (this.drag && !this.drag.keyboard) {
      const p = this.state.tray[this.drag.slot];
      if (p) {
        const sh = shapeById(p.shape);
        const t = this.dragTarget(this.drag)!;
        const img = this.sprites.get(p.colour, cell);
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = cell * 0.4;
        if (this.look.cozy) {
          ctx.save();
          this.stretchHeld(t.x + (sh.w * cell) / 2, t.y + (sh.h * cell) / 2);
          ctx.shadowColor = 'rgba(150,110,80,0.3)';
          drawBlob(ctx, sh.cells, t.x, t.y, cell, this.sprites.colourOf(p.colour), { links: shapeLinks(sh.cells), species: speciesFor(p.colour) });
          ctx.shadowBlur = 0;
          // The held piece looks down at where it is about to land, wide-eyed and grinning over a spot it fits.
          this.face(sh.cells, t.x, t.y, cell, now, 99, 'normal', { x: 0, y: 1 }, undefined, p.colour, { isThrilled: preview !== null });
          ctx.restore();
        } else for (const [dr, dc] of sh.cells) ctx.drawImage(img, t.x + dc * cell, t.y + dr * cell, cell, cell);
        ctx.shadowBlur = 0;
      }
    }
    // Keyboard cursor: a dashed outline when the spot is taken.
    if (this.drag?.keyboard && !preview) {
      const p = this.state.tray[this.drag.slot]!;
      const sh = shapeById(p.shape);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      for (const [dr, dc] of sh.cells) ctx.strokeRect(this.bx + (this.drag.keyboard.c + dc) * cell + 2, this.by + (this.drag.keyboard.r + dr) * cell + 2, cell - 4, cell - 4);
      ctx.setLineDash([]);
    }

    this.particles.draw(ctx);
    for (const e of this.emotes.slice()) this.drawEmote(e, now);
    if (this.flash) {
      const k = (now - this.flash.t0) / 260;
      if (k >= 1) this.flash = null;
      else if (k >= 0) {
        ctx.fillStyle = `rgba(255,252,240,${0.45 * this.flash.strength * (1 - k)})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }
    }
    if (this.praise) {
      const t = now - this.praise.t0;
      if (t > PRAISE_MS) this.praise = null;
      else if (t >= 0) {
        if (this.praise.tier >= 6 && !this.look.reducedMotion) drawRainbowSweep(ctx, this.bx, this.by, cell * SIZE, t);
        drawPraise(ctx, this.praise, this.W / 2, this.by + cell * 4, cell * 1.55, t, this.look.reducedMotion, cell * SIZE * 0.92);
      }
    }

    for (const f of this.floats) {
      const k = Math.max(0, (now - f.t0) / this.floatMs());
      if (now < f.t0) continue;
      const rise = this.look.reducedMotion ? 0 : k * cell * 1.2;
      const scale = f.big && !this.look.reducedMotion ? 1 + Math.max(0, 0.3 - k) : 1;
      // Cozy rewards are see-through, so the grid stays readable under them.
      ctx.globalAlpha = (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3) * (this.look.cozy && !this.state.over ? 0.6 : 1);
      ctx.font = `800 ${Math.round((f.big ? cell * 0.75 : cell * 0.5) * scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = cell * 0.12;
      ctx.strokeStyle = this.look.cozy ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.85)';
      ctx.strokeText(f.text, f.x, f.y - rise);
      ctx.fillStyle = this.look.cozy ? cozyText(f.colour) : f.colour;
      ctx.fillText(f.text, f.x, f.y - rise);
      ctx.globalAlpha = 1;
    }
  }

  /** A copy of the board as it looks right now (creatures, moods and all), for the Polaroid keepsake. */
  snapshot(): HTMLCanvasElement {
    const pad = this.cell * 0.3;
    const side = this.cell * SIZE + pad * 2;
    const out = document.createElement('canvas');
    out.width = Math.round(side * this.dpr);
    out.height = out.width;
    out.getContext('2d')!.drawImage(this.canvas, (this.bx - pad) * this.dpr, (this.by - pad) * this.dpr, side * this.dpr, side * this.dpr, 0, 0, out.width, out.height);
    return out;
  }

  /** The thought bubble: pops in, floats up a touch and fades after about a second and a half. */
  private drawEmote(e: { kind: EmoteKind; x: number; y: number; t0: number }, now: number): void {
    const t = now - e.t0;
    if (t < 0) return;
    if (t > EMOTE_MS) {
      this.emotes = this.emotes.filter((other) => other !== e);
      return;
    }
    const ctx = this.ctx;
    const cell = this.cell;
    const still = this.look.reducedMotion;
    const pop = still ? 1 : t < 180 ? ease(t / 180) * 1.15 : t < 280 ? 1.15 - ((t - 180) / 100) * 0.15 : 1;
    const x = this.bx + e.x * cell;
    const y = this.by + e.y * cell - (still ? 0 : (t / EMOTE_MS) * cell * 0.25);
    const r = cell * 0.34 * pop;
    ctx.save();
    ctx.globalAlpha = t > EMOTE_MS - 300 ? (EMOTE_MS - t) / 300 : 1;
    ctx.shadowColor = 'rgba(120,80,50,0.25)';
    ctx.shadowBlur = cell * 0.2;
    ctx.shadowOffsetY = cell * 0.04;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x + r * 0.95, y + r * 1.05);
    ctx.arc(x + r * 0.8, y + r * 1.05, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    drawEmoteIcon(ctx, e.kind, x, y, r * 0.55);
    ctx.restore();
  }

  /** How long score popups stay: shorter in Cozy, where the board has to read clearly between moves. */
  private floatMs(): number {
    return this.look.cozy ? 650 : 900;
  }

  /** Squash and stretch for the held piece: longer along the way it moves, thinner across, keeping its volume. */
  private stretchHeld(cx: number, cy: number): void {
    if (this.look.reducedMotion) return;
    const speed = Math.hypot(this.dragVelocity.x, this.dragVelocity.y);
    const stretch = Math.min(0.16, speed * 0.05);
    if (stretch < 0.005) return;
    const angle = Math.atan2(this.dragVelocity.y, this.dragVelocity.x);
    this.ctx.translate(cx, cy);
    this.ctx.rotate(angle);
    this.ctx.scale(1 + stretch, 1 / (1 + stretch));
    this.ctx.rotate(-angle);
    this.ctx.translate(-cx, -cy);
  }

  /**
   * A creature's living motion, anchored at its feet: a slow breath while idle, and a springy squash when the
   * piece it holds has just landed (flattens, then rebounds a little taller, then settles).
   */
  private bodyMotion(cells: readonly CellOffset[], seed: number, now: number, mood: Mood = 'normal'): void {
    if (this.look.reducedMotion) return;
    let scaleY = 1 + Math.sin(now / 900 + seed) * 0.014;
    let scaleX = 1 / Math.sqrt(scaleY);
    let lift = 0;
    // Celebrating creatures hop on the spot, each to its own beat; crying ones shake with little sobs.
    if (mood === 'celebrating') {
      const hop = Math.abs(Math.sin(now / 260 + seed));
      lift = hop * this.cell * 0.2;
      scaleY *= 1 + (hop - 0.5) * 0.06;
    } else if (mood === 'relieved') {
      // The exhale: everyone sinks a touch and settles back.
      const sigh = Math.sin(Math.min(1, (now - this.reliefAt) / 1600) * Math.PI);
      scaleY *= 1 - sigh * 0.05;
      scaleX = 1 / Math.sqrt(scaleY);
    } else if (mood === 'crying') {
      scaleY *= 1 + Math.sin(now / 90 + seed) * 0.02 - 0.03;
      scaleX = 1 / Math.sqrt(scaleY);
    }
    const landing = this.landing;
    const isLanding = landing !== null && cells.some(([r, c]) => landing.cells.has(r * SIZE + c));
    const isNeighbour =
      landing !== null && !isLanding && cells.some(([r, c]) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([nr, nc]) => landing.cells.has(nr! * SIZE + nc!)));
    if (landing && isNeighbour) {
      // The neighbours feel the thump: a smaller, slightly later jiggle.
      const progress = (now - landing.t0 - 40) / 300;
      if (progress > 0 && progress < 1) {
        const jiggle = Math.sin(progress * Math.PI * 3) * (1 - progress) * 0.06;
        scaleY *= 1 - jiggle;
        scaleX *= 1 + jiggle * 0.8;
      }
    }
    if (landing && isLanding) {
      const progress = (now - landing.t0) / 380;
      if (progress < 1) {
        const squash = Math.sin(progress * Math.PI * 2.5) * (1 - progress) * 0.16;
        scaleY *= 1 - squash;
        scaleX *= 1 + squash * 0.8;
      }
    }
    const left = Math.min(...cells.map(([, c]) => c));
    const right = Math.max(...cells.map(([, c]) => c)) + 1;
    const feetX = this.bx + ((left + right) / 2) * this.cell;
    const feetY = this.by + (Math.max(...cells.map(([r]) => r)) + 1) * this.cell;
    this.ctx.translate(feetX, feetY - lift);
    this.ctx.scale(scaleX, scaleY);
    this.ctx.translate(-feetX, -(feetY - lift));
  }

  /** A bright band running out along each cleared line from where the piece landed, gone within 300 ms. */
  private drawShockwave(now: number): void {
    const wave = this.shockwave;
    if (!wave) return;
    const progress = (now - wave.t0) / 300;
    if (progress < 0) return;
    if (progress >= 1) {
      this.shockwave = null;
      return;
    }
    const ctx = this.ctx;
    const reach = (0.5 + progress * SIZE) * this.cell;
    ctx.fillStyle = `rgba(255,255,255,${String(0.6 * (1 - progress))})`;
    for (const row of wave.rows) {
      const centre = this.bx + wave.column * this.cell;
      ctx.beginPath();
      ctx.roundRect(centre - reach, this.by + (row + 0.3) * this.cell, reach * 2, this.cell * 0.4, this.cell * 0.2);
      ctx.fill();
    }
    for (const column of wave.cols) {
      const centre = this.by + wave.row * this.cell;
      ctx.beginPath();
      ctx.roundRect(this.bx + (column + 0.3) * this.cell, centre - reach, this.cell * 0.4, reach * 2, this.cell * 0.2);
      ctx.fill();
    }
  }

  /** Nearly locked: thin streaks of rain over the board, faint enough that every cell stays readable. */
  private drawRain(now: number): void {
    const ctx = this.ctx;
    const size = this.cell * SIZE;
    ctx.strokeStyle = 'rgba(120,170,220,0.22)';
    ctx.lineWidth = Math.max(1, this.cell * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let drop = 0; drop < 28; drop++) {
      const lane = ((drop * 0.618) % 1) * (size + this.cell * 2) - this.cell;
      const fall = ((now / 900 + drop * 0.37) % 1) * (size + this.cell * 2) - this.cell;
      const x = this.bx + lane;
      const y = this.by + fall;
      ctx.moveTo(x, y);
      ctx.lineTo(x - this.cell * 0.12, y + this.cell * 0.4);
    }
    ctx.stroke();
  }

  /** From combo x4 up, the board's edge glows warm for a moment. */
  private drawComboGlow(now: number): void {
    const glow = this.comboGlow;
    if (!glow) return;
    const progress = (now - glow.t0) / 350;
    if (progress < 0) return;
    if (progress >= 1) {
      this.comboGlow = null;
      return;
    }
    const ctx = this.ctx;
    const pad = this.cell * 0.22;
    ctx.save();
    ctx.strokeStyle = `rgba(255,190,90,${String((1 - progress) * (0.45 + glow.strength * 0.4))})`;
    ctx.shadowColor = 'rgba(255,170,60,0.9)';
    ctx.shadowBlur = this.cell * (0.5 + glow.strength * 0.6);
    ctx.lineWidth = this.cell * 0.12;
    ctx.beginPath();
    ctx.roundRect(this.bx - pad, this.by - pad, this.cell * SIZE + pad * 2, this.cell * SIZE + pad * 2, this.cell * 0.22);
    ctx.stroke();
    ctx.restore();
  }

  private placementKey = '';
  private placementCount = 0;

  /** Few valid placements left across the whole tray (but some): the board is close to locking up. */
  private isNearlyLocked(): boolean {
    const key = `${this.state.grid.join('')}|${this.state.tray.map((piece) => piece?.shape ?? '-').join(',')}`;
    if (key !== this.placementKey) {
      this.placementKey = key;
      const masks = masksOf(this.state.grid);
      this.placementCount = this.state.tray.reduce((total, piece) => total + (piece ? positions(masks, shapeById(piece.shape)).length : 0), 0);
    }
    return this.placementCount > 0 && this.placementCount < RAIN_BELOW_PLACEMENTS;
  }

  /** The board is getting tight: most of it is full, or a piece in the tray fits nowhere. */
  private isTense(): boolean {
    if (this.state.over) return false;
    const filled = this.state.grid.filter((value) => value !== 0).length;
    if (filled >= NERVOUS_CELLS) return true;
    return this.state.tray.some((piece) => piece !== null && !this.fitsAnywhere(shapeById(piece.shape)));
  }

  /**
   * Cozy board: every placed piece is one pastel body with a face. While a drop would clear lines, everything in
   * those lines melts into one faceless bar in its own colour; what is left of each piece keeps the face.
   */
  private drawBodies(now: number, lineSet: Set<number>, over: number | null, ghost: ReadonlySet<number> = new Set()): void {
    const colours: number[] = [];
    const owners: number[] = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const v = this.state.grid[i];
      // Lines about to clear (the drag preview) and lines holding for the hit-stop both show as the bar.
      const isClearing = lineSet.has(i) || (this.clearFlash !== null && now < this.clearFlash.until && this.clearFlash.cells.has(i));
      let colour = isClearing ? CLEARING_BODY : v;
      owners.push(isClearing ? -1 : this.owners[i]);
      colours.push(colour);
    }
    // The game's end reaches the faces as soon as its moment starts (there is no grey sweep in the Cozy look).
    const isOver = this.state.over && over !== null;
    const bodies = boardBodies(colours, owners);
    const ctx = this.ctx;
    // Everything on the board stays inside the board: nothing spills over its edge (hats on the top row may
    // peek up into the frame).
    ctx.save();
    ctx.beginPath();
    const hatRoom = this.scene ? this.cell * 0.2 : 0;
    ctx.rect(this.bx, this.by - hatRoom, this.cell * SIZE, this.cell * SIZE + hatRoom);
    ctx.clip();
    // Gem blocks hold a swallowed jewel; inside a clearing bar it vanishes with the colour, about to be freed.
    const gifts = new Set<string>();
    for (const gem of this.state.gems) {
      if (this.state.grid[gem] && !lineSet.has(gem)) gifts.add(`${Math.floor(gem / SIZE)},${gem % SIZE}`);
    }
    const creatures = bodies.filter((body) => body.colour !== CLEARING_BODY);
    const centreOf = (cells: readonly CellOffset[]) => ({
      x: this.bx + (cells.reduce((sum, [, c]) => sum + c, 0) / cells.length + 0.5) * this.cell,
      y: this.by + (cells.reduce((sum, [r]) => sum + r, 0) / cells.length + 0.5) * this.cell,
    });
    const centres = creatures.map((body) => centreOf(body.cells));
    const isTense = this.isTense();
    const endMood: Mood = this.isHappyEnding() ? 'celebrating' : 'crying';
    if (isOver && this.endedAt === null) this.endedAt = now;
    const tissue = (now - this.tissueAt) / 900;
    const isDabbing = tissue >= 0 && tissue < 1;
    const isSighing = now >= this.reliefAt && now - this.reliefAt < 1600;
    creatures.forEach((body, index) => {
      const pieces = body.cells.map(([r, c]) => owners[r * SIZE + c]!);
      const [firstRow, firstColumn] = body.cells[0]!;
      // Seeded by the oldest piece in the creature, so its glances don't jump when another piece joins it.
      const seed = Math.min(...pieces.map((owner) => (owner > 0 ? owner : 1000 + firstRow * SIZE + firstColumn))) * 7;
      ctx.save();
      this.bodyMotion(body.cells, seed, now, isOver ? endMood : isSighing ? 'relieved' : 'normal');
      const fill = body.colour === 8 ? COZY_GREY : this.sprites.colourOf(body.colour);
      drawBlob(ctx, body.cells, this.bx, this.by, this.cell, fill, { links: body.links, species: speciesFor(body.colour) });
      // A face only lands on a gem square when the body's whole top row holds gems; that gem is worn as a crown.
      const top = Math.min(...body.cells.map(([r]) => r));
      const topRow = body.cells.filter(([r]) => r === top);
      const isFaceOnGems = topRow.every(([r, c]) => gifts.has(`${r},${c}`));
      for (const [r, c] of body.cells) {
        if (!gifts.has(`${r},${c}`)) continue;
        // The face sits on the right-most top cell, so only that gem becomes a crown.
        const sharesFace = isFaceOnGems && r === top && c === Math.max(...topRow.map(([, column]) => column));
        drawEmbeddedGem(ctx, this.bx + c * this.cell, this.by + r * this.cell, this.cell, this.look.reducedMotion ? 0 : now, { sharesFace });
      }
      // Every creature has exactly one face: same-coloured cells that touch (side or corner) are one creature,
      // and a creature on its own, however it got there, always has eyes.
      let nearest: { x: number; y: number } | undefined;
      let nearestDistance = Infinity;
      centres.forEach((centre, other) => {
        const distance = Math.hypot(centre.x - centres[index]!.x, centre.y - centres[index]!.y);
        if (other !== index && distance < nearestDistance) {
          nearestDistance = distance;
          nearest = centre;
        }
      });
      let mood: Mood = isTense ? 'worried' : 'normal';
      if (isSighing) mood = 'relieved';
      if (isDabbing && tissue < 0.6) mood = 'crying';
      if (isOver) mood = endMood;
      // While a piece hovers over a spot: creatures right next to lines it would clear perk up; ones it would
      // crowd without clearing anything get small, darting pupils.
      const touches = (set: ReadonlySet<number>) => body.cells.some(([r, c]) => [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => r + dr >= 0 && r + dr < SIZE && c + dc >= 0 && c + dc < SIZE && set.has((r + dr) * SIZE + c + dc)));
      const isPerky = mood === 'normal' && lineSet.size > 0 && touches(lineSet);
      const isCrowded = mood === 'normal' && !isPerky && ghost.size > 0 && touches(ghost);
      const face = this.face(body.cells, this.bx, this.by, this.cell, now, seed, mood, undefined, gifts, body.colour, { glanceAt: nearest, isThrilled: isPerky, isCrowded });
      const elapsed = this.endedAt === null ? 0 : now - this.endedAt;
      if (mood === 'crying' && !this.look.reducedMotion) {
        // Tears drip down to the creature's feet under each eye and pool on the board.
        const column = Math.floor((face.x - this.bx) / this.cell);
        const feetRow = Math.max(...body.cells.filter(([, c]) => Math.abs(c - column) <= 1).map(([r]) => r));
        const feetY = this.by + (feetRow + 1) * this.cell;
        for (const side of [-1, 1]) drawTearPuddle(ctx, face.x + side * face.spread, face.y, feetY, face.size, now, isDabbing ? 0 : elapsed, seed + side);
      }
      if (isDabbing) drawTissue(ctx, face.x, face.y, face.size, tissue);
      ctx.restore();
    });
    // The lines about to clear go on top of everything, masked to the board, with a soft glow.
    for (const body of bodies) if (body.colour === CLEARING_BODY) drawClearingBar(ctx, body.cells, this.bx, this.by, this.cell);
    this.drawShockwave(now);
    if (!this.look.reducedMotion && !this.state.over && this.isNearlyLocked()) this.drawRain(now);
    ctx.restore();
  }

  /**
   * Draw a body's googly eyes. They follow the held piece, otherwise glance around and blink now and then;
   * after a clear they squint happily. Reduced motion keeps them still and looking ahead.
   */
  private face(cells: readonly CellOffset[], ox: number, oy: number, size: number, now: number, seed: number, mood: Mood, fixedGaze?: { x: number; y: number }, avoid?: ReadonlySet<string>, colour = 0, extras: { isThrilled?: boolean; isCrowded?: boolean; glanceAt?: { x: number; y: number } } = {}): { x: number; y: number; size: number; spread: number } {
    const isThrilled = extras.isThrilled === true;
    const temperament = isThrilled ? 'excited' : speciesFor(colour).temperament;
    const anchor = faceAnchor(cells, avoid);
    if (isThrilled) anchor.scale *= 1.15;
    const ex = ox + anchor.x * size;
    const ey = oy + anchor.y * size;
    let gaze = fixedGaze ?? { x: 0, y: 0 };
    let shown = mood;
    if (mood === 'worried' && !fixedGaze && !this.look.reducedMotion) {
      // Anxious: darting glances, half of them at the nearest neighbour.
      const phase = (now / 700 + seed * 0.37) % 1;
      if (extras.glanceAt && phase < 0.5) gaze = gazeTowards(ex, ey, extras.glanceAt.x, extras.glanceAt.y);
      else gaze = idleGaze(seed, now * 2.2);
    }
    if (mood === 'normal' && !fixedGaze) {
      // In suspense: while a piece is held, everyone on the board watches the finger with slightly wider eyes.
      if (this.drag && this.look.cozy) anchor.scale *= 1.08;
      if (this.drag && !this.drag.keyboard) gaze = gazeTowards(ex, ey, this.drag.px, this.drag.py);
      else if (this.drag?.keyboard) gaze = gazeTowards(ex, ey, this.bx + (this.drag.keyboard.c + 0.5) * this.cell, this.by + (this.drag.keyboard.r + 0.5) * this.cell);
      else if (!this.look.reducedMotion) gaze = idleGaze(seed, now);
      // Shy ones keep their eyes down and to the side; sleepy ones barely look around.
      if (temperament === 'shy') gaze = { x: gaze.x * 0.4 - 0.45, y: 0.55 };
      if (temperament === 'sleepy') gaze = { x: gaze.x * 0.3, y: 0.35 };
      // Crowded: nervous glances from side to side.
      if (extras.isCrowded && !this.look.reducedMotion) gaze = { x: Math.sin(now / 150 + seed) > 0 ? 0.9 : -0.9, y: 0.1 };
    }
    const canEmote = mood === 'normal' || mood === 'worried';
    if (canEmote && now < this.happyUntil) shown = 'happy';
    else if (canEmote && !this.look.reducedMotion && isBlinking(seed, now)) shown = 'blink';
    const skin = colour >= 1 && colour <= 7 ? this.sprites.colourOf(colour) : COZY_GREY;
    const winking = temperament === 'cheeky' && shown === 'normal' && !this.look.reducedMotion && isWinking(seed, now);
    drawEyes(this.ctx, ex, ey, size, gaze, shown, anchor.scale, { temperament, skin, isWinking: winking, now: this.look.reducedMotion ? 0 : now, pupilScale: extras.isCrowded ? 0.65 : 1 });
    if (this.scene && this.look.cozy) drawAccessory(this.ctx, this.scene.accessory, ex, ey, size, size * anchor.scale, size * anchor.scale * 0.19 * 1.12, this.look.reducedMotion ? 0 : now);
    return { x: ex, y: ey, size: size * anchor.scale, spread: size * anchor.scale * 0.2 };
  }

  private gem(x: number, y: number, size: number, now: number): void {
    drawGem(this.ctx, x, y, size, now);
  }

  private fitCache = new Map<string, boolean>();
  private fitKey = '';

  private fitsAnywhere(sh: Shape): boolean {
    const key = this.state.grid.join('');
    if (key !== this.fitKey) {
      this.fitKey = key;
      this.fitCache.clear();
    }
    let v = this.fitCache.get(sh.id);
    if (v === undefined) {
      v = false;
      for (let r = 0; r + sh.h <= SIZE && !v; r++) for (let c = 0; c + sh.w <= SIZE && !v; c++) if (sh.cells.every(([dr, dc]) => !this.state.grid[(r + dr) * SIZE + c + dc])) v = true;
      this.fitCache.set(sh.id, v);
    }
    return v;
  }
}

const EMOTE_MS = 1500;
