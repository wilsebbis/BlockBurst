import type { ReactNode } from 'react';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { sceneById, SCENES } from '../engine/scenes';
import { useMetaStore, type Settings } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

function Toggle({ label, hint, on, onChange }: { label: string; hint?: ReactNode; on: boolean; onChange(v: boolean): void | Promise<void> }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <span className="flex-1">
        <span className="block font-display font-extrabold">{label}</span>
        {hint && <span className="block text-xs font-bold text-white/70">{hint}</span>}
      </span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-6 w-6 accent-amber-400" />
    </label>
  );
}

export function SettingsScreen() {
  const s = useMetaStore((x) => x.settings);
  const update = useMetaStore((x) => x.updateSettings);
  const go = useNav((x) => x.go);
  const set = (p: Partial<Settings>) => update(p);
  return (
    <Screen>
      <ScreenHeader title="Settings" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Theme</h2>
          <p className="text-xs font-bold text-white/70">Follow the worlds to visit a new place every ten levels, or stay in the place you love. The creatures dress for wherever they are.</p>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Theme">
            {(['journey', ...SCENES.map((scene) => scene.id)] as const).map((pick) => {
              const chosen = s.scenery === pick;
              const scene = pick === 'journey' ? null : sceneById(pick);
              return (
                <Button key={pick} role="radio" aria-checked={chosen} tone={chosen ? 'gold' : 'ghost'} className="!px-2 text-sm" onClick={() => set({ scenery: pick })}>
                  {scene ? `${scene.emoji} ${scene.name}` : '🧭 Follow the worlds'}
                </Button>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Sound</h2>
          <Toggle label="Sound" on={!s.muted} onChange={(v) => set({ muted: !v })} hint="Every sound is synthesised live; there are no audio files." />
          <label className="block py-1 text-sm font-bold">
            Volume
            <input type="range" min={0} max={1} step={0.05} value={s.masterVolume} onChange={(e) => set({ masterVolume: Number(e.target.value) })} className="w-full accent-amber-400" />
          </label>
          <Toggle label="🎵 Music" on={s.music} onChange={(v) => set({ music: v })} hint="A gentle music-box tune for each place, made up as it plays. It picks up a little when the board gets crowded." />
          {s.music && (
            <label className="block py-1 text-sm font-bold">
              Music volume
              <input type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => set({ musicVolume: Number(e.target.value) })} className="w-full accent-amber-400" />
            </label>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Assists</h2>
          <p className="text-xs font-bold text-white/60">Assists are labelled wherever they apply and are always your choice.</p>
          <Toggle label="💡 Hint button" on={s.hints} onChange={(v) => set({ hints: v })} hint="Adds a Hint button that shows Burst Bot's move." />
          <Toggle label="Line-clear preview" on={s.clearPreview} onChange={(v) => set({ clearPreview: v })} hint="While you drag a piece, the lines it would clear light up in its colour." />
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Comfort</h2>
          <Toggle label="Reduce motion" on={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} hint="No screen shake, flying particles or bouncing menus. Follows your system setting too." />
          <Toggle label="Haptics" on={s.haptics} onChange={(v) => set({ haptics: v })} hint="A small buzz when you pick up a piece and when lines clear, on devices that support it. Off until you turn it on." />
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Fair play</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-bold text-white/80">
            <li>The tray generator reads the seed, the tray number and the board, and nothing else. It never adapts to you or your history.</li>
            <li>It looks for a tray you can fully place before dealing.</li>
            <li>Every level was beaten by Burst Bot before it shipped, in the move count that earns ⭐⭐⭐.</li>
            <li>There is nothing to buy and there are no ads. Coins are earned by playing.</li>
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">How to play</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-bold text-white/80">
            <li>Drag a piece from the tray onto the board. Pieces don't rotate.</li>
            <li>Fill a whole row or column to clear it. Clear several at once, or keep clearing turn after turn, for big combos.</li>
            <li>Clear the lines holding 💎 gems to collect them, or reach the 🎯 score on every fifth level. When all three pieces are placed you get three more; the level ends when none of your pieces fit.</li>
            <li>Keyboard: 1, 2, 3 pick a piece, arrows move it, Enter places it, Esc or P pauses.</li>
          </ul>
        </Panel>
      </div>
    </Screen>
  );
}
