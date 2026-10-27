/**
 * The board. HUD at the top, the board in the middle, the tray in the thumb zone at the bottom. Sells nothing
 * (tests/playbook.test.ts): pausing and losing never show an offer.
 */
import { clearRateSoon, difficultyLine } from '../lib/difficulty';
import { ResultCard } from '../components/game/ResultCard';
import type { CelebrationSpec } from '../engine/celebration';
import { SceneLayer } from '../components/game/SceneLayer';
import { paintBackdrop, sceneById, Weather, type SceneId } from '../engine/scenes';
import { sceneFor } from '../lib/scenery';
import { drawPolaroid, PHOTO_ASPECT } from '../lib/polaroid';
import { countRescues } from '../lib/sanctuary';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameOverModal } from '../components/game/GameOverModal';
import { RevivePrompt } from '../components/game/RevivePrompt';
import { PauseModal } from '../components/game/PauseModal';
import { TickingNumber } from '../components/shared/TickingNumber';
import { Button } from '../components/shared/ui';
import { GameController, type Look } from '../engine/GameController';
import { COZY_PALETTE } from '../engine/cozy';
import { isCozy } from '../lib/look';
import { levelFor, starsFor, worldOf } from '../engine/levels';
import { synth } from '../engine/WebAudioSynthesizer';
import { maybeInterstitial, watchReviveAd } from '../lib/adService';
import { cosmeticById, mustCosmetic } from '../lib/cosmetics';
import { dailyTheme } from '../lib/events';
import { buzz } from '../lib/haptics';
import { adventureRequest, classicRequest } from '../lib/requests';
import { clearGame, loadGame, saveGame } from '../lib/resume';
import { downloadCard, fmt, shareOrCopy } from '../lib/share';
import { useMetaStore, type RunOutcome } from '../stores/useMetaStore';
import { useNav, type PlayRequest } from '../stores/useNav';
import type { GameState } from '../types/game';

const sessionStart = Date.now();

function useLook(req: PlayRequest | null): Look {
  const loadout = useMetaStore((s) => s.loadout);
  const settings = useMetaStore((s) => s.settings);
  const skin = mustCosmetic(loadout.skin);
  // Event weeks dress the Daily Board; it's cosmetic only.
  const themeId = (req?.mode === 'daily' && req.day && dailyTheme(req.day)) || loadout.theme;
  const theme = cosmeticById(themeId) ?? mustCosmetic('midnight');
  const reduce = settings.reducedMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cozy = isCozy(settings);
  const burst = mustCosmetic(loadout.burst).burst!;
  // One Look object per real change, not per render: the game re-renders on every move, and handing the
  // controller a fresh Look each time rebuilt its sprites and re-ran this effect after every placement.
  return useMemo(
    () => ({ cozy, skin: cozy ? { style: 'cozy' as const, palette: COZY_PALETTE } : { style: skin.style!, palette: skin.palette! }, theme: { bg: theme.board!.bg, cell: theme.board!.cell }, burst, reducedMotion: reduce, clearPreview: settings.clearPreview }),
    [cozy, skin, theme, burst, reduce, settings.clearPreview],
  );
}

export function PlayScreen() {
  const navReq = useNav((s) => s.play);
  const returnTo = useNav((s) => s.returnTo);
  const go = useNav((s) => s.go);
  const start = useNav((s) => s.start);
  const settings = useMetaStore((s) => s.settings);
  const recordRun = useMetaStore((s) => s.recordRun);
  const best = useMetaStore((s) => s.best);
  const dailyBest = useMetaStore((s) => (navReq?.day ? (s.daily[navReq.day]?.score ?? 0) : 0));
  const [req, setReq] = useState<PlayRequest | null>(navReq);
  const [round, setRound] = useState(0);
  const look = useLook(req);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<GameController | null>(null);
  const started = useRef(Date.now());
  const passedBest = useRef(false);
  const [hud, setHud] = useState<GameState | null>(null);
  const [hinted, setHinted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<GameState | null>(null);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  /** A lost game waiting on the one revive offer; null when there is none. */
  const [offer, setOffer] = useState<GameState | null>(null);
  const revived = useRef(false);
  /** Colours of every cell cleared this game: the blobs rescued to the Sanctuary. */
  const rescuedColours = useRef<number[]>([]);
  const [wasRevived, setWasRevived] = useState(false);
  const finishRef = useRef<((st: GameState) => void) | null>(null);
  const [say, setSay] = useState('');
  const [gust, setGust] = useState(0);
  /** A short message under the score: a new place, a milestone, how hard a level is. */
  const [arrival, setArrival] = useState<string | null>(null);
  const toastTimer = useRef(0);
  /** The highest milestone (0.25, 0.5, 0.75) reached this game. */
  const milestone = useRef(0);
  /** The end-of-round card (success: stars, chest and coins; fail: empty stars and a FAIL stamp), while it's showing. */
  const [result, setResult] = useState<Omit<CelebrationSpec, 'coins'> | null>(null);
  const [reviveBusy, setReviveBusy] = useState(false);
  /** The sponsor break (and its ad choices) shows in its own window: the star card steps aside while it runs. */
  const [onBreak, setOnBreak] = useState(false);
  /** The card came back after a skipped break: show it settled, without replaying its animation. */
  const [cardBack, setCardBack] = useState(false);
  const lookRef = useRef(look);
  lookRef.current = look;

  const prevBest = req?.mode === 'classic' ? best : req?.mode === 'daily' || req?.mode === 'archive' ? dailyBest : 0;

  useEffect(() => {
    if (!req || !canvas.current) return;
    const saved = round === 0 ? loadGame() : null;
    const resume = saved && JSON.stringify(saved.req) === JSON.stringify(req) ? saved : null;
    started.current = Date.now() - (resume?.elapsedMs ?? 0);
    passedBest.current = false;
    milestone.current = 0;
    // A new Adventure level: say how forgiving it is (measured by Burst Bot, worked out in the background).
    if (req?.mode === 'adventure' && req.cfg.level && !resume) {
      const n = req.cfg.level;
      void clearRateSoon(n).then((rate) => {
        if (ctl.current && ctl.current.state.placed < 3) showToast(difficultyLine(rate), 4000);
      });
    }
    setOver(null);
    setOutcome(null);
    setOffer(null);
    revived.current = false;
    rescuedColours.current = [];
    setCardBack(false);
    setOnBreak(false);
    setResult(null);
    setWasRevived(false);
    // The request this game was started from, narrowed for the helpers below.
    const run = req;
    const c = new GameController(
      canvas.current,
      req.cfg,
      lookRef.current,
      {
        onPick: () => {
          synth.unlock();
          synth.playPick();
          buzz(8);
        },
        onReturn: () => synth.playReturn(),
        onMove: (e, st) => {
          const isCozyLook = lookRef.current.cozy;
          if (isCozyLook) synth.playBubble(e.placePoints);
          else synth.playPlace(e.placePoints);
          for (const x of e.cleared) rescuedColours.current.push(x.colour);
          const lines = e.rows.length + e.cols.length;
          if (lines) {
            if (isCozyLook) synth.playChirps(lines, e.combo);
            else synth.playClear(lines, e.combo);
            if (e.combo >= 3) synth.playCombo(e.combo);
            buzz(lines >= 3 ? [20, 40, 30] : [14, 30, 14]);
            setSay(`Cleared ${lines} line${lines > 1 ? 's' : ''}${e.combo > 1 ? `, combo ${e.combo}` : ''}. Score ${st.score}.`);
          } else {
            // A crisp little tap as the piece lands (haptics stay opt-in).
            buzz(6);
            setSay(`Placed. Score ${st.score}.`);
          }
          if (e.gems) synth.playGem();
          if (e.perfect) synth.playPerfect();
          if (e.dealt) synth.playDeal();
          // Milestones on the way to the goal (or to your best): a little toast and chime at 25, 50 and 75%.
          const progress = req.mode === 'adventure' ? (st.goal?.kind === 'gems' ? st.gemsCollected / st.goal.count : st.goal?.kind === 'score' ? st.score / st.goal.target : 0) : prevBest > 0 ? st.score / prevBest : 0;
          const reached = [0.75, 0.5, 0.25].find((m) => progress >= m && progress < 1 && milestone.current < m);
          if (reached && !st.over) {
            milestone.current = reached;
            const pct = Math.round(reached * 100);
            showToast(req.mode === 'adventure' ? `🎯 ${reached === 0.5 ? 'Halfway there!' : `${pct}% of the way there!`}` : `👑 ${reached === 0.5 ? 'Halfway to your best!' : `${pct}% of your best!`}`);
            synth.playCoinArrive(3 + Math.round(reached * 8));
          }
          if (!passedBest.current && prevBest > 0 && st.score > prevBest && req.mode !== 'adventure') {
            showToast('👑 New best territory!');
            passedBest.current = true;
            synth.playPassBest();
          }
          // A revived game can't be rebuilt from its moves, so it isn't saved for resuming.
          if (!st.over && !revived.current) saveGame({ req, log: ctl.current?.log ?? [], hinted: ctl.current?.hinted ?? false, elapsedMs: Date.now() - started.current });
        },
        onChange: (st) => {
          setHud(st);
          setHinted(ctl.current?.hinted ?? false);
          // The music picks up as the board fills (from about half full).
          const filled = st.grid.filter((v) => v !== 0).length / st.grid.length;
          synth.music.setIntensity((filled - 0.45) / 0.35);
        },
        onHeartbeat: () => synth.playHeartbeat(),
        onRelief: () => synth.playSigh(),
        onRain: () => synth.playRain(),
        onGust: () => setGust((n) => n + 1),
        onPraise: (tier) => {
          synth.playPraise(tier);
          buzz(tier >= 4 ? [20, 30, 20, 30, 40] : [16, 30, 24]);
        },
        onOver: (st) => {
          clearGame();
          const won = st.won;
          const isCozyLook = lookRef.current.cozy;
          if (!won && isCozyLook) synth.playWhimper();
          // One chance per game to wipe the tears and play on, before anything is recorded. A new best is a happy
          // ending, though: in the Cozy look it goes straight to its celebration.
          if (!won && !revived.current && !(isCozyLook && beatsBest(st))) {
            setOffer(st);
            // Cozy: the offer is the fail card itself (empty stars, a FAIL stamp, then the choices).
            if (isCozyLook) setResult({ title: 'So close!', ribbon: ribbonFor(), stars: 0, fail: true });
            return;
          }
          finish(st);
        },
      },
      resume ? { log: resume.log, hinted: resume.hinted } : undefined,
    );
    function beatsBest(st: GameState): boolean {
      return run.mode !== 'adventure' && st.score > 0 && st.score > prevBest;
    }
    function ribbonFor(): string {
      return run.mode === 'adventure' ? `Level ${run.cfg.level}` : run.mode === 'classic' ? 'Classic' : 'Daily Board';
    }
    function finish(st: GameState) {
      const won = st.won;
      // A new best is a happy ending too: the tears dry up and the creatures throw a party.
      const isNewBest = beatsBest(st);
      if (isNewBest && lookRef.current.cozy) {
        ctl.current?.setCelebrate(true);
        synth.playCheer();
      }
      // A won round (or a new best) gets the full celebration: name, banner, stars, then a chest of coins. In the
      // Cozy look anything else gets the fail card.
      if (won && run.mode === 'adventure' && run.cfg.level) {
        const stars = starsFor(levelFor(run.cfg.level), st.placed);
        setResult({ title: stars === 3 ? 'Perfect!' : 'Well done!', ribbon: ribbonFor(), stars });
      } else if (won || isNewBest) setResult({ title: 'New best!', ribbon: ribbonFor(), stars: 0, crown: true });
      else if (lookRef.current.cozy) setResult({ title: 'So close!', ribbon: ribbonFor(), stars: 0, fail: true });
      else setResult(null);
      if (won && lookRef.current.cozy) {
        synth.playCheer();
        window.setTimeout(() => synth.playWin(), 350);
      } else if (won) synth.playWin();
      else if (passedBest.current) synth.playNewBest();
      else synth.playCalmEnd();
      setOver(st);
      const log = ctl.current!.log.slice();
      void recordRun({ cfg: run.cfg, mode: run.mode, day: run.day, state: st, log, hinted: ctl.current!.hinted, timeMs: Date.now() - started.current, rescued: countRescues(rescuedColours.current) }).then((o) => {
        setOutcome(o);
        if (o.rank && o.rank.counted && o.rank.after > o.rank.before && Math.floor(o.rank.after / 100) > Math.floor(o.rank.before / 100)) synth.playRankUp();
      });
    }
    finishRef.current = finish;
    ctl.current = c;
    if (import.meta.env.DEV) Object.assign(window, { __burstBot: () => c.botMove() });
    setHud(c.state);
    setHinted(c.hinted);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(wrap.current!);
    return () => {
      ro.disconnect();
      c.destroy();
      ctl.current = null;
    };
    // The controller is rebuilt only for a new request or a restart; look changes are pushed separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req, round]);

  // Cozy scenery: where the creatures are right now. Classic games wander somewhere new every few thousand points.
  const scene: SceneId | null = look.cozy && req ? sceneFor({ pick: settings.scenery ?? 'journey', mode: req.mode, day: req.day, level: req.cfg.level, score: hud?.score ?? 0 }) : null;
  useEffect(() => {
    ctl.current?.setScene(scene);
    // Each place has its own tune (the Classic look plays the meadow's).
    synth.music.setTheme(scene ?? 'meadow');
  }, [scene, req, round]);
  // The music steps back under the results and the pause menu.
  useEffect(() => {
    synth.music.duck(paused || !!over || !!offer);
    if (!over && !offer) return;
    synth.music.setIntensity(0);
  }, [paused, over, offer]);
  const lastScene = useRef<SceneId | null>(null);
  useEffect(() => {
    const previous = lastScene.current;
    lastScene.current = scene;
    if (!scene || !previous || previous === scene || (hud?.score ?? 0) === 0) return;
    const place = sceneById(scene);
    showToast(`${place.emoji} ${place.name}`);
    setSay(`The creatures wander into the ${place.name}.`);
    // Only a change of place is news; the score moving within one place isn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  /**
   * The Polaroid's photo: the scene the game ended in, painted at photo size with its weather, and the finished
   * board (creatures, moods and outfits as they are right now) set into it.
   */
  function screenshot(): HTMLCanvasElement | null {
    const board = ctl.current?.snapshot();
    if (!board) return null;
    const w = 520;
    const h = Math.round(w / PHOTO_ASPECT);
    const scale = 2;
    const out = document.createElement('canvas');
    out.width = w * scale;
    out.height = h * scale;
    const ctx = out.getContext('2d')!;
    ctx.scale(scale, scale);
    if (scene) {
      paintBackdrop(ctx, w, h, scene);
      new Weather(sceneById(scene).weather, w, h).draw(ctx, performance.now());
    } else {
      ctx.fillStyle = '#f5ebe3';
      ctx.fillRect(0, 0, w, h);
    }
    const side = w * 0.86;
    ctx.shadowColor = 'rgba(80,60,40,0.25)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(board, (w - side) / 2, h * 0.56 - side / 2, side, side);
    return out;
  }

  useEffect(() => {
    ctl.current?.setLook(look);
  }, [look]);

  useEffect(() => {
    ctl.current?.setPaused(paused);
  }, [paused]);

  // Hiding the tab pauses the game.
  useEffect(() => {
    const onVis = () => document.visibilityState === 'hidden' && !over && setPaused(true);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [over]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (over) return;
      if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !ctl.current?.key('Escape')) {
        setPaused((p) => !p);
        e.preventDefault();
        return;
      }
      if (!paused && ctl.current?.key(e.key)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [over, paused]);

  const leave = useCallback(
    async (then: () => void) => {
      // The natural break between games: the only place a sponsor break can appear, after the results are closed.
      setOver(null);
      await maybeInterstitial();
      then();
    },
    [],
  );

  function showToast(text: string, ms = 2600) {
    setArrival(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setArrival(null), ms);
  }

  /** Wipe their tears: clear a few blocks and play on (the one revive this game gets). */
  function reviveNow() {
    revived.current = true;
    setWasRevived(true);
    setOffer(null);
    setResult(null);
    setCardBack(false);
    if (ctl.current?.revive() === true && lookRef.current.cozy) synth.playTissue();
    setHinted(true);
  }

  /** The fail card's revive: a short sponsored break, then play on. Nothing happens if it isn't watched. */
  async function reviveWithBreak() {
    setReviveBusy(true);
    setOnBreak(true);
    const watched = await watchReviveAd();
    setOnBreak(false);
    setReviveBusy(false);
    if (watched) reviveNow();
    else setCardBack(true);
  }

  /** Leaving from the fail card: the declined offer still records the game first. */
  function endThen(then: () => void) {
    if (offer) {
      const st = offer;
      setOffer(null);
      finishRef.current?.(st);
    }
    void leave(then);
  }

  /**
   * The share button (and "Clip this fail"): the round's Polaroid, with its stars, badges and date (or the FAIL
   * stamp on a lost round), shared, copied or saved, whichever the device can do.
   */
  async function sharePolaroid() {
    const st = offer ?? over;
    const photo = screenshot();
    if (!st || !photo || !result) return;
    const won = !result.fail;
    const level = req?.mode === 'adventure' && st.won ? (req.cfg.level ?? null) : null;
    const card = drawPolaroid(photo, {
      number: useMetaStore.getState().totals.games + (offer ? 1 : 0),
      stars: won ? result.stars : 0,
      score: st.score,
      game: { score: st.score, lines: st.lines, maxCombo: st.maxCombo, bestMulti: st.bestMulti, perfects: st.perfects, newBest: outcome?.newBest ?? false, rescued: outcome?.rescued ?? 0, level },
      fail: result.fail,
      site: location.host,
    });
    // The words that go with it end with a link to play, so the Polaroid brings friends to the game.
    const brag = result.fail ? `So close! ${fmt(st.score)} in Block Burst` : level ? `Level ${level} cleared ${'⭐'.repeat(result.stars)} in Block Burst` : `New best: ${fmt(st.score)} in Block Burst`;
    const text = `${brag} 🧩 Play free: ${location.origin}`;
    const r = await shareOrCopy(text, card);
    if (r === 'failed') downloadCard(card, `block-burst-${String(useMetaStore.getState().totals.games).padStart(3, '0')}.png`);
  }

  if (!req) {
    go('home');
    return null;
  }

  const restart = () => {
    clearGame();
    setPaused(false);
    // Classic gets a fresh seed; the Daily Board and Adventure levels replay the same start.
    if (req.mode === 'classic') {
      const next = classicRequest();
      setReq(next);
      start(next, returnTo);
    }
    setRound((r) => r + 1);
  };
  const home = () => {
    setPaused(false);
    go(returnTo === 'play' ? 'home' : returnTo);
  };
  const nextLevel = () => {
    const next = adventureRequest((req.cfg.level ?? 1) + 1);
    setReq(next);
    setRound((r) => r + 1);
    start(next, returnTo);
  };

  const g = hud;
  const goal = g?.goal;
  const theme = cosmeticById((req.mode === 'daily' && req.day && dailyTheme(req.day)) || useMetaStore.getState().loadout.theme)?.board;

  return (
    <div className="app-bg relative flex h-full flex-col" style={{ ['--top' as string]: theme?.top, ['--bottom' as string]: theme?.bottom }}>
      {scene && <SceneLayer scene={scene} gust={gust} still={look.reducedMotion} />}
      <header className="relative mx-auto flex w-full max-w-lg items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button tone="ghost" className="w-12 !px-0 text-lg" onClick={() => setPaused(true)} aria-label="Pause">
          ❚❚
        </Button>
        <div className="flex-1 text-center">
          <p className="font-display text-xs font-extrabold uppercase tracking-wide text-white/70">
            {req.mode === 'adventure' ? `${worldOf(req.cfg.level ?? 1).emoji} Level ${req.cfg.level}` : req.mode === 'classic' ? `👑 ${fmt(Math.max(prevBest, g?.score ?? 0))}` : `📅 ${req.day}${req.mode === 'archive' ? ' (practice)' : ''}`}
          </p>
          <p className="font-display text-4xl font-extrabold leading-none text-white text-outline" aria-label={`Score ${g?.score ?? 0}`}>
            <TickingNumber value={g?.score ?? 0} />
          </p>
        </div>
        <div className="grid min-w-tap place-items-center text-center font-display text-xs font-extrabold" aria-label={`Combo ${g?.combo ?? 0}`}>
          {g && g.combo >= 2 ? (
            <span className="pop-in rounded-xl border-2 border-night-950 bg-amber-400 px-2 py-1 text-night-950">🔥x{g.combo}</span>
          ) : (
            <span className="text-white/50">combo</span>
          )}
        </div>
      </header>

      {arrival && (
        <div className="pointer-events-none relative z-10 h-0">
          <p className="pop-in mx-auto mt-1 w-fit max-w-[92%] rounded-2xl bg-[rgba(255,251,247,0.94)] px-3 py-1 text-center font-display text-sm font-extrabold text-[#6b5448] shadow-chunky-sm">
            {/* "Label · detail" reads as a bold label over a smaller line. */}
            {arrival.split(' · ')[0]}
            {arrival.includes(' · ') && <span className="block text-xs font-bold text-[#8a7a70]">{arrival.split(' · ').slice(1).join(' · ')}</span>}
          </p>
        </div>
      )}
      {goal && (
        <div className="relative mx-auto mt-2 w-full max-w-sm px-6">
          {goal.kind === 'gems' ? (
            <p className="text-center font-display font-extrabold" aria-label={`${g!.gemsCollected} of ${goal.count} gems`}>
              💎 {g!.gemsCollected} / {goal.count} gems
            </p>
          ) : (
            <p className="text-center font-display font-extrabold">🎯 Reach {fmt(goal.target)}</p>
          )}
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-night-950/60">
            <div className="h-full w-full origin-left bg-sky-400 transition-transform duration-300 ease-out" style={{ transform: `scaleX(${Math.min(1, goal.kind === 'gems' ? g!.gemsCollected / goal.count : g!.score / goal.target)})` }} />
          </div>
        </div>
      )}

      <div ref={wrap} className="relative mx-auto mt-2 flex min-h-0 w-full max-w-lg flex-1 items-center">
        <canvas ref={canvas} className="mx-auto block touch-none select-none" role="img" aria-label="Game board. Drag pieces from the tray, or press 1, 2 or 3 to pick a piece, the arrow keys to move it, and Enter to place it." />
      </div>

      <footer className="relative mx-auto flex w-full max-w-lg items-center justify-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {settings.hints && (
          <Button tone="ghost" onClick={() => ctl.current?.showHint()} disabled={!!over} aria-label="Hint (assist): show Burst Bot's move">
            💡 Hint
          </Button>
        )}
        {hinted && !wasRevived && <span className="text-xs font-bold text-white/70">💡 Hints on: this game won't count for ranks.</span>}
        {wasRevived && <span className="text-xs font-bold text-white/70">🧻 Revived: this game won't count for ranks.</span>}
      </footer>

      <p className="sr-only" aria-live="polite">
        {say}
      </p>
      {result && (over || offer) && !onBreak && (
        <ResultCard
          key={`${round}-${offer ? 'offer' : 'done'}-${result.fail ? 'fail' : 'win'}`}
          spec={result}
          coins={outcome ? outcome.coinsEarned + (outcome.adventure?.coins ?? 0) : null}
          still={look.reducedMotion || cardBack}
          prompt={result.fail ? (offer ? { title: '😢 Out of room! Wipe their tears?', text: 'Clear a few blocks and keep going.' } : { title: '😢 Out of room!' }) : undefined}
          actions={
            result.fail
              ? [
                  ...(offer ? [{ label: '🎬 Short break', tone: 'go' as const, disabled: reviveBusy, onClick: () => void reviveWithBreak() }] : []),
                  { label: '💔 Start Over', tone: 'gold' as const, disabled: reviveBusy, onClick: () => endThen(restart) },
                ]
              : []
          }
          // A success carries on with a tap anywhere: the next level, or a fresh game after a new best. Home is
          // in the pause menu.
          onContinue={result.fail ? undefined : () => void leave(req.mode === 'adventure' && over?.won ? nextLevel : restart)}
          onShare={() => void sharePolaroid()}
        />
      )}

      {paused && !over && <PauseModal onResume={() => setPaused(false)} onRestart={restart} onQuit={home} canSave={(ctl.current?.log.length ?? 0) > 0} />}
      {offer && !over && !look.cozy && (
        <RevivePrompt
          onRevive={reviveNow}
          onDecline={() => {
            setOffer(null);
            finishRef.current?.(offer);
          }}
        />
      )}
      {/* The Classic look's results screen; the Cozy look only ever shows the star card. */}
      {over && !result && !look.cozy && (
        <GameOverModal
          state={over}
          mode={req.mode}
          day={req.day}
          level={req.cfg.level}
          hinted={hinted}
          outcome={outcome}
          sessionMs={Date.now() - sessionStart}
          onAgain={() => void leave(restart)}
          onNext={() => void leave(nextLevel)}
          onHome={() => void leave(home)}
        />
      )}
    </div>
  );
}
