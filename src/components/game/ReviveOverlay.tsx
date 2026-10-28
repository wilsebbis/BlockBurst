/**
 * Out of room, with the one free revive still unused: the board dims, a ring counts down from 5 over it, and
 * "Wipe their tears" waits underneath. Tap it in time to play on; let it run out and the fail card takes over.
 */
import { useEffect, useRef, useState } from 'react';
import { synth } from '../../engine/WebAudioSynthesizer';
import { buzz } from '../../lib/haptics';
import { Button } from '../shared/ui';

export const REVIVE_SECONDS = 5;

export function ReviveOverlay({ still, onRevive, onExpire }: { still: boolean; onRevive(): void; onExpire(): void }) {
  const [left, setLeft] = useState(REVIVE_SECONDS);
  // How much of the ring is left, from 1 to 0, stepped on the same clock as the number.
  const [ring, setRing] = useState(1);
  const used = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    const end = performance.now() + REVIVE_SECONDS * 1000;
    let shown = REVIVE_SECONDS;
    const timer = window.setInterval(() => {
      const remaining = (end - performance.now()) / 1000;
      setRing(Math.max(0, remaining / REVIVE_SECONDS));
      if (remaining > 0) {
        const next = Math.ceil(remaining);
        if (next !== shown) {
          shown = next;
          setLeft(next);
          synth.playHeartbeat();
          buzz(10);
        }
        return;
      }
      window.clearInterval(timer);
      if (!used.current) {
        used.current = true;
        expire.current();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, []);

  const r = 44;
  const len = 2 * Math.PI * r;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-[rgba(60,44,36,0.45)]" role="dialog" aria-modal="true" aria-label="Out of room! Wipe their tears?">
      <div className="flex flex-1 items-center">
        <div className={`relative h-[min(42vw,170px)] w-[min(42vw,170px)] ${still ? '' : 'pop-in'}`} aria-hidden>
          <svg className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_5px_0_rgba(60,44,36,0.35)]" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="49" fill="rgba(255,251,247,0.92)" stroke="rgba(107,84,72,0.85)" strokeWidth="1.6" />
            <circle cx="50" cy="50" r={r} fill="none" stroke="#f3e2d0" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#86cf72"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - (still ? left / REVIVE_SECONDS : ring))}
              style={{ transition: still ? undefined : 'stroke-dashoffset 60ms linear' }}
            />
          </svg>
          <span key={left} className={`absolute inset-0 grid place-items-center font-display text-[min(21vw,85px)] font-black leading-none text-[#6b5448] ${still ? '' : 'pop-in'}`}>
            {left}
          </span>
        </div>
      </div>
      <Button
        tone="go"
        className={`mb-[14vh] !px-9 !py-3 text-xl ${still ? '' : 'pop-in'}`}
        autoFocus
        aria-label={`Wipe their tears, ${left} seconds left`}
        onClick={() => {
          if (used.current) return;
          used.current = true;
          onRevive();
        }}
      >
        🎬 Wipe their tears
      </Button>
    </div>
  );
}
