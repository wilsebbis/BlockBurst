/**
 * The unlock moment as a celebration ("Notifications, widgets, interface and unlocks": the unlock should be a
 * celebration with a short guided first use, not a silent menu change). It uses the one pop-up a visit is
 * allowed (popupGate), and shows one unlock at a time.
 */
import { useEffect, useState } from 'react';
import { synth } from '../../engine/WebAudioSynthesizer';
import { claimPopup } from '../../lib/popupGate';
import { FEATURE_BLURB, FEATURE_NAMES, type Feature } from '../../lib/progression';
import { pendingUnlocks, useMetaStore } from '../../stores/useMetaStore';
import { useNav, type Screen } from '../../stores/useNav';
import { ModalShell } from '../game/ModalShell';
import { Button } from '../shared/ui';

const WHERE: Record<Feature, Screen> = { daily: 'daily', challenges: 'challenges', gifts: 'home', shop: 'shop', crate: 'collection', ranks: 'ranks', leagues: 'leagues', pass: 'pass', events: 'events', crews: 'crew' };

export function UnlockCelebration() {
  const xp = useMetaStore((s) => s.xp);
  const seen = useMetaStore((s) => s.unlockSeen);
  const seeUnlock = useMetaStore((s) => s.seeUnlock);
  const screen = useNav((s) => s.screen);
  const go = useNav((s) => s.go);
  const [show, setShow] = useState<Feature | null>(null);
  const pending = pendingUnlocks(xp, seen);

  useEffect(() => {
    if (show || screen === 'play' || !pending.length) return;
    if (claimPopup()) {
      setShow(pending[0]);
      synth.playChime();
    }
  }, [pending.length, screen, show]);

  if (!show) return null;
  const close = (open: boolean) => {
    seeUnlock(show);
    // Anything else that unlocked at the same time is noted quietly, not stacked as more pop-ups.
    for (const f of pending) seeUnlock(f);
    setShow(null);
    if (open) go(WHERE[show]);
  };
  return (
    <ModalShell label="New feature unlocked">
      <p className="text-center text-5xl">🎉</p>
      <h2 className="text-center font-display text-3xl font-extrabold">{FEATURE_NAMES[show]} unlocked!</h2>
      <p className="mt-2 text-center text-sm font-bold text-white/70">{FEATURE_BLURB[show]}</p>
      {pending.length > 1 && <p className="mt-1 text-center text-xs font-bold text-white/60">Also new: {pending.slice(1).map((f) => FEATURE_NAMES[f]).join(', ')}.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button tone="ghost" onClick={() => close(false)}>
          Later
        </Button>
        <Button tone="go" onClick={() => close(true)} autoFocus>
          Show me
        </Button>
      </div>
    </ModalShell>
  );
}
