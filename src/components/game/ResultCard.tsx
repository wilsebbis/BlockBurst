/**
 * The end-of-round card (see `engine/celebration.ts`), in two kinds:
 *
 *   - success (1–3 stars, or a crown for a new best): the game's name bounces in, a banner pops, the stars land
 *     on a cushion, then a treasure chest waits to be tapped and bursts into coins;
 *   - fail (0 stars): the stars stay empty and a red FAIL stamp slams down where the coins would be.
 *
 * Once it settles, the round's prompt and buttons appear under the card (Next level / Replay / Home, or the one
 * revive offer with Start Over / Home / Clip this fail). The chest is a real button, so it works from the
 * keyboard too. With reduced motion the finished card shows straight away.
 */
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Celebration, type CelebrationSpec } from '../../engine/celebration';
import { synth } from '../../engine/WebAudioSynthesizer';
import { Button } from '../shared/ui';

export interface ResultAction {
  label: string;
  tone: ComponentProps<typeof Button>['tone'];
  onClick(): void;
  disabled?: boolean;
}

export function ResultCard({
  spec,
  coins,
  still,
  prompt,
  actions,
  onContinue,
  onShare,
}: {
  spec: Omit<CelebrationSpec, 'coins'>;
  coins: number | null;
  still: boolean;
  /** A line (and an optional smaller line) above the buttons. */
  prompt?: { title: string; text?: string };
  actions: ResultAction[];
  /** When set, "Tap to continue" shows on the card and a tap anywhere calls this. */
  onContinue?(): void;
  /** Shares the round's Polaroid, from a round share button in the card's corner. */
  onShare?(): void;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  const show = useRef<Celebration | null>(null);
  const [chestBox, setChestBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [finished, setFinished] = useState(still);
  const [card, setCard] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (coins !== null) show.current?.setCoins(coins);
  }, [coins]);

  useEffect(() => {
    const canvas = cv.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    let lastClink = 0;
    let lastPing = 0;
    let pings = 0;
    // How tall the prompt and buttons under the card will be, so the whole stack can be centred.
    const rows = actions.length === 0 ? 0 : actions.length === 3 ? 1 : Math.ceil(actions.length / 2);
    const below = rows === 0 && !prompt ? 0 : 14 + (prompt ? (prompt.text ? 50 : 32) : 0) + rows * 50 + Math.max(0, rows - 1) * 8;
    const c = new Celebration(box.width, box.height, { ...spec, coins: coins ?? 0, below, hint: onContinue ? 'Tap to continue' : undefined }, (e, i) => {
      const now = performance.now();
      if (e === 'letter') synth.playBubble(2 + (i % 4));
      if (e === 'banner') synth.playChime();
      if (e === 'star') synth.playCoinArrive(4 + i * 3);
      if (e === 'stamp') synth.playStamp();
      if (e === 'chest') synth.playDeal();
      if (e === 'rattle') synth.playChestRattle();
      if (e === 'pop') synth.playChestOpen();
      if (e === 'burst') synth.playCoinBurst();
      if (e === 'land' && now - lastClink > 70) {
        lastClink = now;
        synth.playCoinClink();
      }
      if (e === 'arrive' && now - lastPing > 55) {
        lastPing = now;
        synth.playCoinArrive(pings++);
      }
      if (e === 'finale') synth.playChime();
    }, Math.floor(Math.random() * 1e9));
    show.current = c;
    setCard(c.card);
    if (still) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.draw(ctx, true);
      return;
    }
    let frame = 0;
    let last = performance.now();
    let chestShown = false;
    let finishedOnce = false;
    const draw = (now: number) => {
      c.step((now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);
      c.draw(ctx);
      if (!spec.fail && !chestShown && c.chestReady) {
        chestShown = true;
        setChestBox(c.chest.hitBox);
      }
      // Keeps drawing after it settles, so the name above keeps waving until a button is pressed.
      if (c.done && !finishedOnce) {
        finishedOnce = true;
        setFinished(true);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // The card is built once; the coins are pushed in separately when they're known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${spec.title} ${spec.ribbon}`}>
      <canvas ref={cv} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      <p className="sr-only" aria-live="polite">
        {spec.title} {spec.fail ? 'Failed.' : spec.crown ? 'New best.' : `${spec.stars} of 3 stars.`} {finished && !spec.fail && coins !== null ? `${coins} coins collected.` : ''}
      </p>
      {chestBox && !finished && (
        <button
          type="button"
          className="absolute rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
          style={chestBox}
          aria-label="Open the treasure chest"
          autoFocus
          onClick={() => {
            synth.unlock();
            show.current?.chest.open();
            setChestBox(null);
          }}
        />
      )}
      {finished && onContinue && (
        // A tap anywhere carries on (the share button sits on top of it).
        <button type="button" autoFocus onClick={onContinue} className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0 outline-none" aria-label="Tap to continue" />
      )}
      {finished && card && (actions.length > 0 || prompt) && (
        <div className="pop-in absolute flex flex-col items-center gap-2" style={{ left: card.x, top: card.y + card.h + 14, width: card.w }}>
          {prompt && (
            <div className="text-center">
              <p className="font-display text-lg font-extrabold text-[#6b5448]">{prompt.title}</p>
              {prompt.text && <p className="text-xs font-bold text-[#8a7a70]">{prompt.text}</p>}
            </div>
          )}
          <div className={`grid w-full gap-2 ${actions.length === 1 ? 'grid-cols-1' : actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {actions.map((a, i) => (
              <Button key={a.label} tone={a.tone} className="!px-2 text-sm" disabled={a.disabled} onClick={a.onClick} autoFocus={i === 0}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {finished && card && onShare && (
        <button
          type="button"
          onClick={onShare}
          aria-label="Share the Polaroid"
          className="pop-in absolute grid h-11 w-11 place-items-center rounded-full border-0 bg-[#f3e2d0] text-[#6b5448] shadow-chunky-sm outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
          style={{ left: card.x + card.w - 58, top: card.y + card.h - 58 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="M7.5 7.5 12 3l4.5 4.5" />
            <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
          </svg>
        </button>
      )}
    </div>
  );
}
