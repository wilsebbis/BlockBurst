/**
 * Runs the Penguin Exhibit on a canvas: steps the pure pond simulation every animation frame, turns its events
 * into ripples and splashes, schedules the penguin's tricks, and reads the finger that drags the penguin.
 */
import { EXHIBIT_TUNING } from './tuning';
import { createPond, stepPond, windAt, type PondEvent, type PondState, type Vector } from './pond';
import { planTrick, type TrickPlan } from './tricks';
import { PenguinSprite } from './penguinSprite';
import { paintPond } from './pondPainter';
import { PondScene, RIPPLE_LIFE_MS } from './pondScene';

const MS_PER_SECOND = 1000;
/** A finger this many ring radii from the penguin's centre still grabs it. */
const GRAB_REACH = 1.3;
/** A moving ring leaves a ripple in its wake this often, once it is going faster than this. */
const WAKE = { everyMs: 240, minSpeed: 0.12, radius: 0.22, strength: 0.45 } as const;
/** Even at rest the ring bobs, sending out a faint ring this often. */
const BOB_RIPPLE = { everyMs: 2_600, radius: 0.26, strength: 0.3 } as const;
const TAP_SPLASH_STRENGTH = 0.25;
const NO_TILT: Vector = { x: 0, y: 0 };

export class ExhibitController {
  private readonly context: CanvasRenderingContext2D | null;
  private readonly sprite: PenguinSprite;
  private size: Vector = { x: 1, y: 1 };
  private scale = 1;
  private pond: PondState;
  private readonly scene: PondScene;
  private finger: Vector | 'none' = 'none';
  private tilt: Vector = NO_TILT;
  private nextTrick: TrickPlan | 'performing';
  private lastTrick: TrickPlan | 'none' = 'none';
  private lastFrameMs: number | 'none' = 'none';
  private lastWakeMs = 0;
  private lastBobMs = 0;
  private frameRequest = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: { readonly seed: string; readonly isCalm: boolean }) {
    this.context = canvas.getContext('2d');
    this.measure();
    this.pond = createPond({ seed: options.seed, size: { width: this.size.x, height: this.size.y } });
    this.scene = new PondScene({ seed: options.seed, size: this.size, isCalm: options.isCalm });
    this.sprite = new PenguinSprite(() => this.finishTrick());
    this.nextTrick = planTrick({ seed: options.seed, after: 'none', nowMs: 0 });
    this.resizeObserver = new ResizeObserver(() => this.measure());
  }

  start(): void {
    this.resizeObserver.observe(this.canvas);
    this.canvas.addEventListener('pointerdown', this.pressed);
    this.canvas.addEventListener('pointermove', this.moved);
    this.canvas.addEventListener('pointerup', this.released);
    this.canvas.addEventListener('pointercancel', this.released);
    this.frameRequest = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frameRequest);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pressed);
    this.canvas.removeEventListener('pointermove', this.moved);
    this.canvas.removeEventListener('pointerup', this.released);
    this.canvas.removeEventListener('pointercancel', this.released);
    this.sprite.dispose();
  }

  /** The phone's tilt, -1..1 on each axis; NO_TILT when tilt steering is off. */
  setTilt(tilt: Vector): void {
    this.tilt = tilt;
  }

  private readonly tick = (frameMs: number): void => {
    const dtMs = this.lastFrameMs === 'none' ? 0 : frameMs - this.lastFrameMs;
    this.lastFrameMs = frameMs;
    const result = stepPond(this.pond, { dtMs, size: { width: this.size.x, height: this.size.y }, tilt: this.tilt, finger: this.finger });
    const seconds = (result.nextState.elapsedMs - this.pond.elapsedMs) / MS_PER_SECOND;
    this.pond = result.nextState;
    this.react(result.domainEvents);
    this.leaveRipples();
    this.scene.advance({ nowMs: this.pond.elapsedMs, seconds, wind: windAt(this.pond), size: this.size });
    this.startDueTrick();
    this.paint();
    this.frameRequest = requestAnimationFrame(this.tick);
  };

  private react(events: readonly PondEvent[]): void {
    for (const event of events) {
      if (event.kind === 'penguin.bumped') {
        const strength = Math.min(1, event.speed / EXHIBIT_TUNING.penguin.maxSpeed);
        this.scene.splash({ at: event.at, nowMs: this.pond.elapsedMs, strength });
      } else {
        this.scene.gust({ force: event.force, nowMs: this.pond.elapsedMs });
      }
    }
  }

  /** A wake behind a moving ring, and a faint ring now and then from the bobbing. */
  private leaveRipples(): void {
    const nowMs = this.pond.elapsedMs;
    const speed = Math.hypot(this.pond.velocity.x, this.pond.velocity.y);
    const isMakingWake = speed > WAKE.minSpeed && nowMs - this.lastWakeMs > WAKE.everyMs;
    if (isMakingWake) {
      this.lastWakeMs = nowMs;
      this.scene.addRipple({ at: this.pond.position, bornMs: nowMs, lifeMs: RIPPLE_LIFE_MS, maxRadius: WAKE.radius, strength: WAKE.strength });
    }
    if (nowMs - this.lastBobMs > BOB_RIPPLE.everyMs) {
      this.lastBobMs = nowMs;
      this.scene.addRipple({ at: this.pond.position, bornMs: nowMs, lifeMs: RIPPLE_LIFE_MS, maxRadius: BOB_RIPPLE.radius, strength: BOB_RIPPLE.strength });
    }
  }

  private startDueTrick(): void {
    if (this.nextTrick === 'performing' || this.pond.elapsedMs < this.nextTrick.startsAtMs) {
      return;
    }
    this.lastTrick = this.nextTrick;
    this.nextTrick = 'performing';
    this.sprite.perform(this.lastTrick.trick);
  }

  private finishTrick(): void {
    this.nextTrick = planTrick({ seed: this.options.seed, after: this.lastTrick, nowMs: this.pond.elapsedMs });
  }

  private paint(): void {
    if (this.context === null) {
      return;
    }
    const pixelRatio = window.devicePixelRatio;
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const view = { context: this.context, scale: this.scale, widthPx: this.size.x * this.scale, heightPx: this.size.y * this.scale };
    paintPond(view, { pond: this.pond, wind: windAt(this.pond), scene: this.scene, penguin: this.sprite.frame(), isCalm: this.options.isCalm });
  }

  /** Sizes the canvas to its box at the screen's pixel ratio; the pond is 1 wide and as tall as the box's aspect. */
  private measure(): void {
    const box = this.canvas.getBoundingClientRect();
    const width = Math.max(1, box.width);
    const pixelRatio = window.devicePixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(Math.max(1, box.height) * pixelRatio);
    this.scale = width;
    this.size = { x: 1, y: Math.max(1, box.height) / width };
  }

  private toPond(event: PointerEvent): Vector {
    const box = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) / this.scale, y: (event.clientY - box.top) / this.scale };
  }

  private readonly pressed = (event: PointerEvent): void => {
    const touch = this.toPond(event);
    const reach = EXHIBIT_TUNING.penguin.radius * GRAB_REACH;
    const isOnPenguin = Math.hypot(touch.x - this.pond.position.x, touch.y - this.pond.position.y) <= reach;
    if (!isOnPenguin) {
      this.scene.splash({ at: touch, nowMs: this.pond.elapsedMs, strength: TAP_SPLASH_STRENGTH });
      return;
    }
    this.canvas.setPointerCapture(event.pointerId);
    this.finger = touch;
  };

  private readonly moved = (event: PointerEvent): void => {
    if (this.finger !== 'none') {
      this.finger = this.toPond(event);
    }
  };

  private readonly released = (): void => {
    this.finger = 'none';
  };
}
