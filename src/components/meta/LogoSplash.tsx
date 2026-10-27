/**
 * The opening splash: the game's name bounces in letter by letter over the cream background, a little tagline
 * fades up, and it all fades away (about two seconds, once per visit). A tap skips it; reduced motion skips it.
 */
import { useEffect, useRef, useState } from 'react';
import { clamp01, DISPLAY_FONT, drawLogo } from '../../engine/logo';
import { synth } from '../../engine/WebAudioSynthesizer';

const LENGTH = 2.1;
let shownThisVisit = false;

export function LogoSplash({ skip }: { skip: boolean }) {
  const [on, setOn] = useState(() => !skip && !shownThisVisit);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!on) return;
    shownThisVisit = true;
    const canvas = cv.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= LENGTH) {
        setOn(false);
        return;
      }
      const fade = 1 - clamp01((t - (LENGTH - 0.35)) / 0.35);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#f5ebe3';
      ctx.fillRect(0, 0, box.width, box.height);
      const size = Math.min(box.width * 0.13, 64);
      drawLogo(ctx, box.width / 2, box.height * 0.44, size, t);
      ctx.globalAlpha = fade * clamp01((t - 0.9) / 0.4);
      ctx.font = `800 ${Math.round(size * 0.32)}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9a8a80';
      ctx.fillText('a cozy block puzzle', box.width / 2, box.height * 0.44 + size * 1.1);
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [on]);

  if (!on) return null;
  return (
    <button
      type="button"
      className="fixed inset-0 z-[60] block h-full w-full cursor-default border-0 bg-transparent p-0"
      aria-label="Block Burst. Tap to skip."
      onClick={() => {
        synth.unlock();
        setOn(false);
      }}
    >
      <canvas ref={cv} className="absolute inset-0 h-full w-full" aria-hidden />
    </button>
  );
}
