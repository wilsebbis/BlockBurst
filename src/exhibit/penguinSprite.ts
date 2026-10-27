/**
 * The penguin's picture: the resting image, or the current trick's video with its green screen keyed out on the
 * fly. Clips start and end in the resting pose, so cutting between them is seamless.
 */
import { PENGUIN_IDLE_IMAGE_PATH, PENGUIN_TRICKS, type PenguinTrick } from './tuning';
import { keyOutGreen } from './chromaKey';

/** The size every penguin asset is cut to, in pixels. */
export const SPRITE_SIZE = { width: 432, height: 528 } as const;
/** Where the ring's centre sits in the sprite, and its half-width: what the pond's ring radius maps onto. */
export const SPRITE_RING = { centreX: 214, centreY: 372, halfWidth: 174 } as const;

/** HTMLMediaElement.HAVE_CURRENT_DATA: a frame is ready to draw. */
const HAS_CURRENT_FRAME = 2;

export class PenguinSprite {
  private readonly idle = new Image();
  private readonly clips = new Map<PenguinTrick, HTMLVideoElement>();
  private readonly keyed = document.createElement('canvas');
  private readonly keyedContext: CanvasRenderingContext2D | null;
  private performing: PenguinTrick | 'none' = 'none';
  private lastKeyedTime = -1;

  constructor(private readonly onTrickFinished: () => void) {
    this.idle.src = PENGUIN_IDLE_IMAGE_PATH;
    this.keyed.width = SPRITE_SIZE.width;
    this.keyed.height = SPRITE_SIZE.height;
    this.keyedContext = this.keyed.getContext('2d', { willReadFrequently: true });
    for (const clip of PENGUIN_TRICKS) {
      this.clips.set(clip.trick, this.createClip(clip.videoPath));
    }
  }

  get isPerforming(): boolean {
    return this.performing !== 'none';
  }

  /** Starts a trick. If the browser won't play the clip, the penguin just keeps resting. */
  perform(trick: PenguinTrick): void {
    const video = this.clips.get(trick);
    if (video === undefined) {
      return;
    }
    this.performing = trick;
    this.lastKeyedTime = -1;
    video.currentTime = 0;
    video.play().catch(() => this.finish());
  }

  /** The picture to draw this frame. */
  frame(): CanvasImageSource | 'loading' {
    const video = this.performing === 'none' ? undefined : this.clips.get(this.performing);
    const hasVideoFrame = video !== undefined && video.readyState >= HAS_CURRENT_FRAME && this.keyedContext !== null;
    if (hasVideoFrame) {
      this.keyFrame(video);
      return this.keyed;
    }
    return this.idle.complete && this.idle.naturalWidth > 0 ? this.idle : 'loading';
  }

  dispose(): void {
    for (const video of this.clips.values()) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  private keyFrame(video: HTMLVideoElement): void {
    if (this.keyedContext === null || video.currentTime === this.lastKeyedTime) {
      return;
    }
    this.lastKeyedTime = video.currentTime;
    this.keyedContext.clearRect(0, 0, SPRITE_SIZE.width, SPRITE_SIZE.height);
    this.keyedContext.drawImage(video, 0, 0, SPRITE_SIZE.width, SPRITE_SIZE.height);
    const pixels = this.keyedContext.getImageData(0, 0, SPRITE_SIZE.width, SPRITE_SIZE.height);
    keyOutGreen(pixels.data);
    this.keyedContext.putImageData(pixels, 0, 0);
  }

  private createClip(path: string): HTMLVideoElement {
    const video = document.createElement('video');
    video.src = path;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('ended', () => this.finish());
    return video;
  }

  private finish(): void {
    this.performing = 'none';
    this.onTrickFinished();
  }
}
