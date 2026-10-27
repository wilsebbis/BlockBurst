/**
 * The Block Burst logo on Home: the splash's chunky pastel letters with googly eyes in the "o". The letters drop
 * in once, then a gentle wave rolls through them and the eyes look about. Reduced motion shows it settled.
 */
import { useEffect, useRef } from 'react';
import { drawLogo } from '../../engine/logo';

/** The letters' size as a share of the logo's width, capped so it never dwarfs a wide screen. */
const SIZE_PER_WIDTH = 0.15;
const MAX_LETTER_PX = 64;
const MAX_PIXEL_RATIO = 2;

export function HomeLogo({ still }: { still: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const startedAt = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const box = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
      const widthPx = Math.round(box.width * pixelRatio);
      const heightPx = Math.round(box.height * pixelRatio);
      if (canvas.width !== widthPx || canvas.height !== heightPx) {
        canvas.width = widthPx;
        canvas.height = heightPx;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, box.width, box.height);
      const letterPx = Math.min(box.width * SIZE_PER_WIDTH, MAX_LETTER_PX);
      drawLogo(context, box.width / 2, box.height / 2, letterPx, (now - startedAt) / 1000, still);
      if (!still) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    // A still logo is drawn once, so it needs redrawing when the screen changes size.
    const resizeObserver = new ResizeObserver(() => {
      if (still) frame = requestAnimationFrame(draw);
    });
    resizeObserver.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [still]);

  return <canvas ref={canvasRef} className="block h-28 w-full" role="img" aria-label="Block Burst" />;
}
