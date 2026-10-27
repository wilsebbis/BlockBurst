import { useEffect, useRef, useState } from 'react';

const TICK_MS = 600;

/**
 * Counts up (or down) to a value so rewards are staged rather than dumped ("juice"). Instant with reduced motion.
 *
 * One animation loop chases the latest value; the effect only moves the target and never sets state itself, so
 * a score that changes many times a second (fast play) can't pile up state updates inside effects.
 */
export function TickingNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const motion = useRef({ from: value, to: value, start: 0, frame: 0 });
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const m = motion.current;
    if (reduce || value === m.to) return;
    // Start from the number on screen, even if a tick was still running.
    m.from = Math.round(m.from + (m.to - m.from) * progress(m.start));
    m.to = value;
    m.start = performance.now();
    if (m.frame !== 0) return;
    const step = (now: number) => {
      const k = Math.min(1, (now - m.start) / TICK_MS);
      setShown(Math.round(m.from + (m.to - m.from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) m.frame = requestAnimationFrame(step);
      else {
        m.frame = 0;
        m.from = m.to;
      }
    };
    m.frame = requestAnimationFrame(step);
  }, [value, reduce]);
  useEffect(() => () => cancelAnimationFrame(motion.current.frame), []);
  return <>{(reduce ? value : shown).toLocaleString('en-US')}</>;
}

/** How far a tick that started at `start` has eased (1 when none is running). */
function progress(start: number): number {
  if (start === 0) return 1;
  const k = Math.min(1, (performance.now() - start) / TICK_MS);
  return 1 - Math.pow(1 - k, 3);
}
