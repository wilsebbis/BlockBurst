/**
 * The one revive a lost game may offer, shown before the results: the creatures are crying, and the player can
 * wipe their tears (clear a few blocks and keep playing) by watching a rewarded break or spending coins. It is
 * offered at most once per game, "No thanks" is always there and costs nothing, and a revived game is treated
 * like an assisted one: it doesn't count for ranks.
 */
import { useState } from 'react';
import { REVIVE_BLOCKS } from '../../engine/rules';
import { watchReviveAd } from '../../lib/adService';
import { useMetaStore } from '../../stores/useMetaStore';
import { Button } from '../shared/ui';
import { ModalShell } from './ModalShell';

export const REVIVE_COINS = 50;

export function RevivePrompt({ onRevive, onDecline }: { onRevive(): void; onDecline(): void }) {
  const coins = useMetaStore((s) => s.coins);
  const addCoins = useMetaStore((s) => s.addCoins);
  const [busy, setBusy] = useState(false);
  const watch = async () => {
    setBusy(true);
    const watched = await watchReviveAd();
    setBusy(false);
    if (watched) onRevive();
  };
  const pay = () => {
    if (coins < REVIVE_COINS) return;
    addCoins(-REVIVE_COINS);
    onRevive();
  };
  return (
    <ModalShell label="Out of room">
      <div className="text-center">
        <div className="text-5xl" aria-hidden="true">
          🧻
        </div>
        <h2 className="mt-1 font-display text-2xl font-extrabold">Out of room! Wipe their tears?</h2>
        <p className="mt-1 text-sm font-bold text-white/70">
          Clear {REVIVE_BLOCKS} or so blocks to make room and keep going. A revived game doesn't count for ranks.
        </p>
      </div>
      <div className="mt-4 grid gap-2">
        <Button tone="go" disabled={busy} onClick={() => void watch()}>
          🎬 Watch a short break
        </Button>
        <Button tone="gold" disabled={busy || coins < REVIVE_COINS} onClick={pay}>
          🪙 {REVIVE_COINS} coins <span className="text-sm opacity-70">(you have {coins})</span>
        </Button>
        <Button tone="ghost" disabled={busy} onClick={onDecline}>
          No thanks
        </Button>
      </div>
    </ModalShell>
  );
}
