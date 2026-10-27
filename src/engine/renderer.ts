/**
 * Canvas 2D renderer. It only draws what the rules decided: board, tray, the dragged piece, the line-clear
 * preview, clear animations and particles.
 *
 * Performance rules from the reference: every block face is pre-rendered once per (skin, colour, size) into an
 * offscreen sprite (a texture atlas in all but name) and blitted with drawImage; particles come from a fixed pool
 * that is reused rather than allocated mid-game; everything animates by position, scale and alpha only.
 */
import type { ClearBurst } from './scenes';
import type { BurstStyle, SkinStyle } from '../lib/cosmetics';
import { SIZE } from './board';

export interface Skin {
  style: SkinStyle;
  palette: string[];
}

export interface Theme {
  bg: string;
  cell: string;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function paintBlock(ctx: CanvasRenderingContext2D, s: number, base: string, style: SkinStyle): void {
  const inset = Math.max(1, s * 0.04);
  const x = inset;
  const y = inset;
  const w = s - inset * 2;
  const r = style === 'pixel' ? 0 : style === 'jelly' || style === 'candy' ? w * 0.28 : w * 0.14;
  switch (style) {
    case 'cozy':
      ctx.fillStyle = base;
      roundRect(ctx, x, y, w, w, w * 0.24);
      ctx.fill();
      break;
    case 'flat':
      ctx.fillStyle = base;
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + r, y + w - w * 0.1, w - 2 * r, w * 0.1);
      break;
    case 'pixel': {
      const p = Math.max(1, Math.round(w / 8));
      ctx.fillStyle = shade(base, -60);
      ctx.fillRect(x, y, w, w);
      ctx.fillStyle = base;
      ctx.fillRect(x + p, y + p, w - 2 * p, w - 2 * p);
      ctx.fillStyle = shade(base, 70);
      ctx.fillRect(x + p, y + p, w - 3 * p, p);
      ctx.fillRect(x + p, y + p, p, w - 3 * p);
      ctx.fillStyle = shade(base, -30);
      ctx.fillRect(x + 2 * p, y + w - 2 * p, w - 3 * p, p);
      break;
    }
    case 'gem': {
      const k = w * 0.24;
      ctx.fillStyle = base;
      ctx.fillRect(x, y, w, w);
      const tri = (pts: number[], col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.closePath();
        ctx.fill();
      };
      tri([x, y, x + w, y, x + w - k, y + k, x + k, y + k], shade(base, 70));
      tri([x, y, x + k, y + k, x + k, y + w - k, x, y + w], shade(base, 35));
      tri([x + w, y, x + w, y + w, x + w - k, y + w - k, x + w - k, y + k], shade(base, -35));
      tri([x, y + w, x + k, y + w - k, x + w - k, y + w - k, x + w, y + w], shade(base, -65));
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + k * 1.2, y + k * 1.2, w * 0.18, w * 0.1);
      break;
    }
    case 'neon':
      ctx.fillStyle = shade(base, -150);
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.shadowColor = base;
      ctx.shadowBlur = s * 0.25;
      ctx.strokeStyle = base;
      ctx.lineWidth = s * 0.1;
      roundRect(ctx, x + s * 0.08, y + s * 0.08, w - s * 0.16, w - s * 0.16, r * 0.7);
      ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    case 'wood': {
      ctx.fillStyle = base;
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.strokeStyle = shade(base, -45);
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + w * 0.1, y + (w * i) / 4);
        ctx.bezierCurveTo(x + w * 0.4, y + (w * i) / 4 - w * 0.08, x + w * 0.6, y + (w * i) / 4 + w * 0.08, x + w * 0.9, y + (w * i) / 4);
        ctx.stroke();
      }
      break;
    }
    case 'candy': {
      ctx.fillStyle = base;
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.save();
      roundRect(ctx, x, y, w, w, r);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = w * 0.12;
      for (let i = -2; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (i * w) / 2.5, y + w);
        ctx.lineTo(x + (i * w) / 2.5 + w, y);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'ice': {
      ctx.fillStyle = base;
      ctx.globalAlpha = 0.85;
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1, s * 0.05);
      roundRect(ctx, x + 1, y + 1, w - 2, w - 2, r);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + w * 0.7);
      ctx.lineTo(x + w * 0.7, y + w * 0.2);
      ctx.lineTo(x + w * 0.78, y + w * 0.28);
      ctx.lineTo(x + w * 0.28, y + w * 0.78);
      ctx.fill();
      break;
    }
    case 'lava': {
      ctx.fillStyle = shade(base, -80);
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.strokeStyle = shade(base, 90);
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, y + w * 0.3);
      ctx.lineTo(x + w * 0.45, y + w * 0.45);
      ctx.lineTo(x + w * 0.4, y + w * 0.8);
      ctx.moveTo(x + w * 0.45, y + w * 0.45);
      ctx.lineTo(x + w * 0.85, y + w * 0.35);
      ctx.stroke();
      break;
    }
    case 'jelly': {
      const g = ctx.createRadialGradient(x + w * 0.35, y + w * 0.3, w * 0.05, x + w * 0.5, y + w * 0.5, w * 0.75);
      g.addColorStop(0, shade(base, 80));
      g.addColorStop(1, base);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.32, y + w * 0.26, w * 0.14, w * 0.08, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // Glossy: the classic Block Blast bevel.
      ctx.fillStyle = shade(base, -55);
      roundRect(ctx, x, y, w, w, r);
      ctx.fill();
      const b = w * 0.12;
      ctx.fillStyle = shade(base, 45);
      roundRect(ctx, x, y, w, w - b, r);
      ctx.fill();
      ctx.fillStyle = base;
      roundRect(ctx, x + b * 0.7, y + b * 0.7, w - b * 1.4, w - b * 1.9, r * 0.7);
      ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + w * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      roundRect(ctx, x + b * 0.7, y + b * 0.7, w - b * 1.4, w * 0.35, r * 0.7);
      ctx.fill();
    }
  }
}

/** Sprite cache: one canvas per (style, colour, size, alpha-free). Cleared when the skin or size changes. */
export class BlockSprites {
  private cache = new Map<string, HTMLCanvasElement>();
  constructor(
    public skin: Skin,
    public dpr: number,
  ) {}

  get(colour: number, size: number): HTMLCanvasElement {
    const px = Math.max(4, Math.round(size * this.dpr));
    const key = `${colour}|${px}`;
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = px;
      c.height = px;
      const ctx = c.getContext('2d')!;
      const base = colour === 0 ? '#64748b' : this.skin.palette[(colour - 1) % this.skin.palette.length];
      paintBlock(ctx, px, base, this.skin.style);
      this.cache.set(key, c);
    }
    return c;
  }

  colourOf(colour: number): string {
    return this.skin.palette[(colour - 1) % this.skin.palette.length];
  }
}

export function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const k = s * 0.3 * (1 + Math.sin(t / 300) * 0.04);
  ctx.fillStyle = '#e0f2fe';
  ctx.strokeStyle = '#0c4a6e';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx, cy - k);
  ctx.lineTo(cx + k, cy - k * 0.2);
  ctx.lineTo(cx, cy + k);
  ctx.lineTo(cx - k, cy - k * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(cx - k, cy - k * 0.2);
  ctx.lineTo(cx + k, cy - k * 0.2);
  ctx.lineTo(cx, cy + k);
  ctx.closePath();
  ctx.fill();
}

interface Particle {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  colour: string;
  spin: number;
  shape: 'sq' | 'circle' | 'star' | 'heart' | ClearBurst;
  /** Per-particle gravity (CSS px per frame²), or null to use the burst style's. */
  grav: number | null;
}

/** Soft pastel tints for scene bursts that aren't in the piece's own colour. */
const SCENE_TINTS: Partial<Record<ClearBurst, readonly string[]>> = {
  petal: ['#f9cddc', '#ffffff', '#d9c8f7'],
  leaf: ['#bfd99a', '#f3c58c', '#eaa38f'],
  drop: ['#bcdcf2', '#d7ebf7'],
  bubble: ['#ffffff'],
  flake: ['#ffffff', '#e4eefa'],
  puff: ['#ffffff'],
  heart: ['#f7a8bf', '#f6c3d2'],
  firefly: ['#fff1a8'],
};

const POOL = 360;

/** A fixed pool of particles, recycled. */
export class Particles {
  private ps: Particle[] = Array.from({ length: POOL }, () => ({ live: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, colour: '#fff', spin: 0, shape: 'sq' as Particle['shape'], grav: null as number | null }));
  private next = 0;
  active = 0;

  /** `quick` bursts burn out within ~350 ms (Cozy line clears), so the board is readable again before the next move. */
  burst(x: number, y: number, colour: string, cell: number, style: BurstStyle, n: number, quick = false): void {
    for (let i = 0; i < n; i++) {
      const p = this.ps[this.next];
      this.next = (this.next + 1) % POOL;
      if (!p.live) this.active++;
      const a = Math.random() * Math.PI * 2;
      const sp = cell * (0.04 + Math.random() * 0.1) * (quick ? 1.3 : 1);
      p.live = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - (style === 'bubbles' || style === 'embers' ? cell * 0.05 : cell * 0.03);
      p.life = 0;
      p.max = quick ? 14 + Math.random() * 7 : 28 + Math.random() * 22;
      p.size = cell * (style === 'pixels' ? 0.22 : 0.14 + Math.random() * 0.1);
      p.colour = style === 'snow' ? '#f8fafc' : style === 'embers' ? (Math.random() < 0.5 ? '#f97316' : '#facc15') : style === 'confetti' ? `hsl(${Math.floor(Math.random() * 360)},90%,60%)` : colour;
      p.spin = (Math.random() - 0.5) * 0.3;
      p.shape = style === 'stars' ? 'star' : style === 'hearts' ? 'heart' : style === 'bubbles' || style === 'snow' || style === 'embers' ? 'circle' : 'sq';
      p.grav = null;
    }
  }

  /**
   * A scene's own clear burst (petals in the meadow, bubbles under the sea...): they drift, float or flutter
   * rather than fall, and burn out as quickly as the Cozy stars do.
   */
  burstScene(x: number, y: number, colour: string, cell: number, kind: ClearBurst, n: number): void {
    const tints = SCENE_TINTS[kind];
    const rises = kind === 'bubble' || kind === 'firefly' || kind === 'puff' || kind === 'heart';
    for (let i = 0; i < n; i++) {
      const p = this.ps[this.next];
      this.next = (this.next + 1) % POOL;
      if (!p.live) this.active++;
      const a = Math.random() * Math.PI * 2;
      const sp = cell * (0.03 + Math.random() * 0.07);
      p.live = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - (rises ? cell * 0.03 : 0);
      p.life = 0;
      p.max = 18 + Math.random() * 10;
      p.size = cell * (0.16 + Math.random() * 0.1);
      p.colour = tints ? tints[Math.floor(Math.random() * tints.length)]! : colour;
      p.spin = (Math.random() - 0.5) * 0.3;
      p.shape = kind;
      p.grav = rises ? -cell * 0.0015 : kind === 'drop' ? cell * 0.006 : cell * 0.0015;
    }
  }

  step(cell: number, style: BurstStyle): void {
    const gravity = style === 'bubbles' || style === 'embers' ? -cell * 0.002 : style === 'snow' ? cell * 0.0008 : cell * 0.005;
    for (const p of this.ps) {
      if (!p.live) continue;
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.grav ?? gravity;
      p.vx *= 0.98;
      if (p.life >= p.max) {
        p.live = false;
        this.active--;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.ps) {
      if (!p.live) continue;
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.colour;
      const s = p.size * (0.5 + k * 0.5);
      if (p.shape !== 'sq' && p.shape !== 'circle' && p.shape !== 'star' && p.shape !== 'heart') {
        drawSceneParticle(ctx, p.shape, p.x, p.y, s, p.life * p.spin);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star' || p.shape === 'heart') {
        ctx.font = `${Math.round(s * 1.8)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.shape === 'star' ? '★' : '♥', p.x, p.y);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * p.spin);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    for (const p of this.ps) p.live = false;
    this.active = 0;
  }
}

function drawSceneParticle(ctx: CanvasRenderingContext2D, kind: ClearBurst, x: number, y: number, s: number, turn: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.beginPath();
  switch (kind) {
    case 'petal':
    case 'leaf':
      ctx.ellipse(0, 0, s * 0.6, s * (kind === 'leaf' ? 0.28 : 0.36), 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'drop':
      ctx.moveTo(0, -s * 0.6);
      ctx.quadraticCurveTo(s * 0.45, 0, 0, s * 0.4);
      ctx.quadraticCurveTo(-s * 0.45, 0, 0, -s * 0.6);
      ctx.fill();
      break;
    case 'bubble':
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1, s * 0.1);
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'crystal':
      ctx.moveTo(0, -s * 0.6);
      ctx.lineTo(s * 0.3, 0);
      ctx.lineTo(0, s * 0.6);
      ctx.lineTo(-s * 0.3, 0);
      ctx.fill();
      break;
    case 'flake':
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1, s * 0.09);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        ctx.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
        ctx.lineTo(-Math.cos(a) * s * 0.45, -Math.sin(a) * s * 0.45);
      }
      ctx.stroke();
      break;
    case 'puff':
      ctx.arc(-s * 0.2, 0, s * 0.3, 0, Math.PI * 2);
      ctx.arc(s * 0.2, -s * 0.05, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'heart':
      ctx.moveTo(0, s * 0.4);
      ctx.bezierCurveTo(-s * 0.6, 0, -s * 0.3, -s * 0.5, 0, -s * 0.2);
      ctx.bezierCurveTo(s * 0.3, -s * 0.5, s * 0.6, 0, 0, s * 0.4);
      ctx.fill();
      break;
    case 'firefly': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.6);
      g.addColorStop(0, '#fff6c2');
      g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g;
      ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sparkle':
      ctx.moveTo(0, -s * 0.6);
      ctx.quadraticCurveTo(0, 0, s * 0.6, 0);
      ctx.quadraticCurveTo(0, 0, 0, s * 0.6);
      ctx.quadraticCurveTo(0, 0, -s * 0.6, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s * 0.6);
      ctx.fill();
      break;
  }
  ctx.restore();
}

export function drawBoardBase(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, theme: Theme): void {
  const size = cell * SIZE;
  const pad = cell * 0.18;
  ctx.fillStyle = theme.bg;
  roundRect(ctx, x - pad, y - pad, size + pad * 2, size + pad * 2, cell * 0.3);
  ctx.fill();
  ctx.fillStyle = theme.cell;
  const inset = cell * 0.06;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      roundRect(ctx, x + c * cell + inset, y + r * cell + inset, cell - inset * 2, cell - inset * 2, cell * 0.12);
      ctx.fill();
    }
  }
}
