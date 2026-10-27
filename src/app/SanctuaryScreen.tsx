/**
 * The Sanctuary: the blobs you cleared off the board, living on in a little garden. They wander about and drip
 * droplets into a rain tank; collect them and build the garden up. The Species Log tracks how many of each
 * species you've rescued, with a one-time coin thank-you at each step.
 */
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Button, Meter, Panel, Screen, ScreenHeader, Section } from '../components/shared/ui';
import { COZY_PALETTE, drawBlob, drawEyes, faceAnchor, idleGaze, isBlinking, type CellOffset } from '../engine/cozy';
import { speciesFor } from '../engine/species';
import { synth } from '../engine/WebAudioSynthesizer';
import { useNow } from '../lib/useNow';
import {
  BUILDING_IDS,
  BUILDINGS,
  buildCost,
  dropletsPerHour,
  LOG_STEPS,
  logReady,
  logStep,
  MAX_LEVEL,
  puddles,
  roamers,
  SPECIES_BLURB,
  SPECIES_NAMES,
  speciesMet,
  tankNow,
  tankSize,
  type SanctuaryState,
} from '../lib/sanctuary';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function SanctuaryScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const now = useNow(5_000);
  const [say, setSay] = useState('');
  const sanc = s.sanctuary;
  const tank = tankNow(sanc, now);
  const size = tankSize(sanc);
  const met = speciesMet(sanc);
  const ready = logReady(sanc);

  return (
    <Screen>
      <ScreenHeader title="Sanctuary" onBack={() => go('home')} right={<span className="font-display font-extrabold text-sky-500">💧 {sanc.bank}</span>} />
      <div className="px-4">
        <Garden state={sanc} reducedMotion={s.settings.reducedMotion} />
        {met === 0 ? (
          <p className="mt-3 text-center text-sm font-bold text-white/80">Nobody lives here yet. Every block you clear in a game is rescued and comes to live in the garden.</p>
        ) : (
          <Panel className="mt-3">
            <div className="flex items-center justify-between font-display font-extrabold">
              <span>🌧️ Rain tank</span>
              <span>
                {tank}/{size}
              </span>
            </div>
            <Meter value={tank / size} tone="bg-sky-400" className="mt-2" label="Rain tank" />
            <p className="mt-1 text-xs font-bold text-white/60">
              Fills by {dropletsPerHour(sanc)} droplets an hour{tank >= size ? '. It’s full and spilling into puddles: nothing is lost, it just stops filling.' : '.'}
            </p>
            <Button
              tone="cool"
              className="mt-2 w-full"
              disabled={tank === 0}
              onClick={() => {
                const got = s.collectDroplets();
                synth.playGem();
                setSay(`Collected ${got} droplets.`);
              }}
            >
              Collect 💧 {tank}
            </Button>
          </Panel>
        )}
        <p className="sr-only" aria-live="polite">
          {say}
        </p>
      </div>

      <Section title="Build the garden">
        <div className="space-y-2">
          {BUILDING_IDS.map((id) => {
            const b = BUILDINGS[id];
            const level = sanc.buildings[id];
            const maxed = level >= MAX_LEVEL;
            const cost = buildCost(level);
            return (
              <Panel key={id} className="flex items-center gap-3 !p-3">
                <span className="text-3xl" aria-hidden>
                  {b.emoji}
                </span>
                <div className="flex-1">
                  <div className="font-display font-extrabold">
                    {b.name} <span className="text-xs text-white/60">Lv {level}/{MAX_LEVEL}</span>
                  </div>
                  <div className="text-xs font-bold text-white/60">{b.what}</div>
                </div>
                <Button
                  tone="ghost"
                  className="!px-3 text-sm"
                  disabled={maxed || sanc.bank < cost}
                  onClick={() => {
                    if (s.buildSanctuary(id)) setSay(`${b.name} built up to level ${level + 1}.`);
                  }}
                >
                  {maxed ? 'Done' : `💧 ${cost}`}
                </Button>
              </Panel>
            );
          })}
        </div>
      </Section>

      <Section title={`Species Log · ${met}/7 met`}>
        {ready.length > 0 && (
          <Button
            className="mb-2 w-full"
            onClick={() => {
              const coins = s.claimSpeciesLog();
              synth.playCoin();
              setSay(`The blobs say thank you: ${coins} coins.`);
            }}
          >
            Say hi to new friends · 🪙 {ready.reduce((sum, r) => sum + LOG_STEPS[r.step].coins, 0)}
          </Button>
        )}
        <ul className="grid grid-cols-1 gap-2">
          {SPECIES_NAMES.map((name, i) => {
            const n = sanc.rescued[i];
            const step = logStep(n);
            const next = LOG_STEPS[step + 1];
            return (
              <li key={name} className={clsx('flex items-center gap-3 rounded-blob border-[3px] border-night-950 bg-night-800/90 p-3 shadow-chunky-sm', n === 0 && 'opacity-60')}>
                <Portrait colour={i + 1} hidden={n === 0} />
                <div className="flex-1">
                  <div className="font-display font-extrabold">
                    {n === 0 ? '???' : name} {step >= 0 && <span className="text-xs text-amber-500">· {LOG_STEPS[step].title}</span>}
                  </div>
                  <div className="text-xs font-bold text-white/60">{n === 0 ? 'Not met yet. Clear some to find out.' : SPECIES_BLURB[i]}</div>
                  {next && <Meter value={n / next.at} className="mt-1 !h-2" label={`${name} toward ${next.title}`} />}
                </div>
                <span className="font-display font-extrabold">{n.toLocaleString('en-US')}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    </Screen>
  );
}

/** One species, drawn small for its log entry (a grey silhouette until met). */
function Portrait({ colour, hidden }: { colour: number; hidden: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = 44 * dpr;
    cv.height = 44 * dpr;
    ctx.scale(dpr, dpr);
    const skin = hidden ? '#8a8078' : COZY_PALETTE[colour - 1];
    drawBlob(ctx, [[0, 0]], 6, 6, 32, skin, { species: speciesFor(colour) });
    if (!hidden) drawEyes(ctx, 22, 18, 32, { x: 0, y: 0 }, 'normal', 1, { temperament: speciesFor(colour).temperament, skin });
  }, [colour, hidden]);
  return <canvas ref={ref} className="h-11 w-11 shrink-0" aria-hidden />;
}

const BODIES: CellOffset[][] = [[[0, 0]], [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [0, 1], [1, 0], [1, 1]]];
const W = 340;
const H = 220;
const GROUND = 70;

interface Roamer {
  colour: number;
  cells: CellOffset[];
  seed: number;
  x: number;
  y: number;
  /** When it was last poked: a happy hop. */
  poked: number;
}

/** Where the k-th walker hangs out: a loose five-by-three grid, scrambled so the first few spread out. */
function slot(k: number): { x: number; y: number } {
  const s = (k * 7) % 15;
  const col = s % 5;
  const row = Math.floor(s / 5);
  return { x: 38 + col * 66 + (row % 2) * 12, y: GROUND + 8 + row * 46 };
}

/** Picks who's out today: species in proportion to how many you've rescued, stable across renders. */
function pickRoamers(state: SanctuaryState): Roamer[] {
  const total = state.rescued.reduce((a, b) => a + b, 0);
  const out: Roamer[] = [];
  for (let k = 0; k < roamers(state); k++) {
    let t = ((k * 0.618034 + 0.31) % 1) * total;
    let colour = 1;
    for (let i = 0; i < state.rescued.length; i++) {
      if (t < state.rescued[i]) {
        colour = i + 1;
        break;
      }
      t -= state.rescued[i];
    }
    // Every species you've met gets at least one walker, so the garden shows the whole family.
    const met = state.rescued.map((n, i) => (n > 0 ? i + 1 : 0)).filter(Boolean);
    if (k < met.length) colour = met[k];
    const big = state.rescued[colour - 1] >= 100 ? 1 : 0;
    out.push({ colour, cells: BODIES[(k * 3 + big * 4) % BODIES.length], seed: k * 7.3 + 1, ...slot(k), poked: 0 });
  }
  return out;
}

/** The garden itself: wandering blobs, the buildings you've put up and any puddles from a full tank. Tap a blob to say hi. */
function Garden({ state, reducedMotion }: { state: SanctuaryState; reducedMotion: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const walkers = useRef<Roamer[]>([]);
  const key = `${roamers(state)}|${state.rescued.map((n) => (n > 0 ? 1 : 0)).join('')}`;
  const reduce = reducedMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pools = puddles(state);
  const { hut, barrel, sunflower } = state.buildings;

  useEffect(() => {
    walkers.current = pickRoamers(state);
  }, [key]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    let frame = 0;
    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#fde7d3');
      sky.addColorStop(0.32, '#fbe3cf');
      sky.addColorStop(0.33, '#cfe8b8');
      sky.addColorStop(1, '#b6dba0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.font = '26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < hut; i++) ctx.fillText('🍄', 30 + i * 30, GROUND + 4);
      if (barrel > 0) ctx.fillText('🛢️', W - 30, GROUND + 4);
      for (let i = 0; i < sunflower; i++) ctx.fillText('🌻', W - 70 - i * 24, GROUND + 2);
      // Puddles on the path from a full tank.
      ctx.fillStyle = 'rgba(127,188,242,0.55)';
      for (let i = 0; i < pools; i++) {
        ctx.beginPath();
        ctx.ellipse(70 + i * 90, H - 22 - (i % 2) * 18, 26, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const t = reduce ? 0 : now;
      for (const r of walkers.current) {
        const cell = 22;
        const span = Math.max(...r.cells.map(([, c]) => c)) + 1;
        const rows = Math.max(...r.cells.map(([rr]) => rr)) + 1;
        // A slow amble back and forth, with a little bounce in each step.
        const wx = r.x + Math.sin(t / 2600 + r.seed) * 16;
        const hop = reduce ? 0 : Math.abs(Math.sin(t / 260 + r.seed)) * 2 + (now - r.poked < 600 ? Math.sin(((now - r.poked) / 600) * Math.PI) * 14 : 0);
        const ox = Math.min(W - span * cell - 4, Math.max(4, wx - (span * cell) / 2));
        const oy = r.y - hop;
        ctx.fillStyle = 'rgba(60,90,40,0.18)';
        ctx.beginPath();
        ctx.ellipse(ox + (span * cell) / 2, r.y + rows * cell, (span * cell) / 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        const skin = COZY_PALETTE[r.colour - 1];
        const species = speciesFor(r.colour);
        drawBlob(ctx, r.cells, ox, oy, cell, skin, { species });
        const happy = now - r.poked < 900;
        const mood = happy ? 'happy' : !reduce && isBlinking(r.seed, now) ? 'blink' : 'normal';
        const face = faceAnchor(r.cells);
        drawEyes(ctx, ox + face.x * cell, oy + face.y * cell, cell, reduce ? { x: 0, y: 0 } : idleGaze(r.seed, now), mood, face.scale, { temperament: species.temperament, skin, now: t });
      }
      if (!reduce || walkers.current.some((r) => now - r.poked < 900)) frame = requestAnimationFrame(draw);
      else frame = 0;
    };
    frame = requestAnimationFrame(draw);
    const poke = (e: PointerEvent) => {
      const box = cv.getBoundingClientRect();
      const px = ((e.clientX - box.left) / box.width) * W;
      const py = ((e.clientY - box.top) / box.height) * H;
      const hit = walkers.current.find((r) => Math.abs(px - (r.x + Math.sin((reduce ? 0 : performance.now()) / 2600 + r.seed) * 16)) < 28 && py > r.y - 16 && py < r.y + 50);
      if (!hit) return;
      hit.poked = performance.now();
      synth.unlock();
      synth.playChirps(1, 1);
      if (frame === 0) frame = requestAnimationFrame(draw);
    };
    cv.addEventListener('pointerdown', poke);
    return () => {
      cancelAnimationFrame(frame);
      cv.removeEventListener('pointerdown', poke);
    };
  }, [key, reduce, hut, barrel, sunflower, pools]);

  return <canvas ref={ref} className="block w-full rounded-blob border-[3px] border-night-950 shadow-chunky" style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={`The Sanctuary garden with ${roamers(state)} blobs out playing${pools ? ` and ${pools} puddles` : ''}.`} />;
}
