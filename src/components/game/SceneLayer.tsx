/**
 * The scenery behind a Cozy game: the scene's backdrop, painted once per size and cached, with its weather
 * drifting over it. A new scene cross-fades in. `gust` bumps on big clears to blow the weather about for a moment.
 * With reduced motion it paints once and stays still.
 */
import { useEffect, useRef } from 'react';
import { paintBackdrop, sceneById, Weather, type SceneId } from '../../engine/scenes';

const FADE_MS = 1200;

export function SceneLayer({ scene, gust, still }: { scene: SceneId; gust: number; still: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ backdrop: HTMLCanvasElement | null; previous: HTMLCanvasElement | null; fadeFrom: number; weather: Weather | null; w: number; h: number; dpr: number }>({ backdrop: null, previous: null, fadeFrom: 0, weather: null, w: 0, h: 0, dpr: 1 });

  // Paint (or repaint) the backdrop for this scene at the current size.
  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;
    const s = state.current;
    const paint = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(box.width));
      const h = Math.max(1, Math.round(box.height));
      const sized = w !== s.w || h !== s.h;
      s.w = w;
      s.h = h;
      s.dpr = dpr;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const off = document.createElement('canvas');
      off.width = w * dpr;
      off.height = h * dpr;
      const octx = off.getContext('2d')!;
      octx.scale(dpr, dpr);
      paintBackdrop(octx, w, h, scene);
      // A resize swaps instantly; a new scene fades in over the old one.
      s.previous = sized ? null : s.backdrop;
      s.fadeFrom = performance.now();
      s.backdrop = off;
      const kind = sceneById(scene).weather;
      if (!s.weather || s.weather.kind !== kind) s.weather = new Weather(kind, w, h);
      else s.weather.resize(w, h);
    };
    paint();
    const ro = new ResizeObserver(() => {
      const box = canvas.getBoundingClientRect();
      if (Math.round(box.width) !== s.w || Math.round(box.height) !== s.h) paint();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [scene]);

  useEffect(() => {
    if (gust > 0) state.current.weather?.gust(performance.now());
  }, [gust]);

  useEffect(() => {
    const canvas = cv.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = (now: number) => {
      const s = state.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (s.backdrop) {
        const k = still ? 1 : Math.min(1, (now - s.fadeFrom) / FADE_MS);
        if (s.previous && k < 1) ctx.drawImage(s.previous, 0, 0);
        ctx.globalAlpha = s.previous ? k : 1;
        ctx.drawImage(s.backdrop, 0, 0);
        ctx.globalAlpha = 1;
        if (k >= 1) s.previous = null;
      }
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      if (s.weather) {
        if (!still) s.weather.step(now);
        s.weather.draw(ctx, still ? 0 : now);
      }
      frame = still ? 0 : requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    // With reduced motion, repaint only when the scene or size changes.
    const ro = still ? new ResizeObserver(() => requestAnimationFrame(draw)) : null;
    ro?.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [still, scene]);

  return <canvas ref={cv} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
