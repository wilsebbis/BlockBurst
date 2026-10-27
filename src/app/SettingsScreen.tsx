import { sceneById, SCENES } from '../engine/scenes';
import { JOURNEY_STEP } from '../lib/scenery';
import type { ReactNode } from 'react';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { useMetaStore, type Settings } from '../stores/useMetaStore';
import { NOTIFY_KINDS } from '../lib/notify';
import { BREAK_OPTIONS } from '../lib/wellbeing';
import { utcDateKey } from '../lib/dates';
import { useNav } from '../stores/useNav';
import { useEconomyStore } from '../stores/useEconomyStore';
import { liveConfig } from '../lib/liveConfig';

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
  const notify = useMetaStore((x) => x.notify.prefs);
  const setNotify = useMetaStore((x) => x.setNotifyPrefs);
  const vacations = useMetaStore((x) => x.vacations);
  const startVacation = useMetaStore((x) => x.startVacation);
  const endVacation = useMetaStore((x) => x.endVacation);
  const go = useNav((x) => x.go);
  const set = (p: Partial<Settings>) => update(p);
  const today = utcDateKey();
  const vacation = vacations.find((v) => today >= v.start && today <= v.end);
  const canNotify = typeof Notification !== 'undefined';
  return (
    <Screen>
      <ScreenHeader title="Settings" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Look</h2>
          <p className="text-xs font-bold text-white/70">Cozy gives every piece a soft pastel body and a pair of googly eyes. Classic is the original glossy blocks on the night sky, with your equipped skin and theme.</p>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Look">
            {(['cozy', 'classic'] as const).map((look) => {
              const chosen = (s.look ?? 'cozy') === look;
              return (
                <Button key={look} role="radio" aria-checked={chosen} tone={chosen ? 'gold' : 'ghost'} onClick={() => set({ look })}>
                  {look === 'cozy' ? '👀 Cozy' : '✨ Classic'}
                </Button>
              );
            })}
          </div>
          {(s.look ?? 'cozy') === 'cozy' && (
            <>
              <h3 className="mt-3 font-display font-extrabold">Scenery</h3>
              <p className="text-xs font-bold text-white/70">On a journey, Classic games wander somewhere new every {JOURNEY_STEP.toLocaleString('en-US')} points, Adventure worlds have their own places and the Daily Board picks one a day. Or stay in the place you love. The creatures dress for wherever they are.</p>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Scenery">
                {(['journey', ...SCENES.map((scene) => scene.id)] as const).map((pick) => {
                  const chosen = (s.scenery ?? 'journey') === pick;
                  const scene = pick === 'journey' ? null : sceneById(pick);
                  return (
                    <Button key={pick} role="radio" aria-checked={chosen} tone={chosen ? 'gold' : 'ghost'} className="!px-2 text-sm" onClick={() => set({ scenery: pick })}>
                      {scene ? `${scene.emoji} ${scene.name}` : '🧭 Journey'}
                    </Button>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Sound</h2>
          <Toggle label="Sound" on={!s.muted} onChange={(v) => set({ muted: !v })} hint="Every sound is synthesised live; there are no audio files." />
          <label className="block py-1 text-sm font-bold">
            Volume
            <input type="range" min={0} max={1} step={0.05} value={s.masterVolume} onChange={(e) => set({ masterVolume: Number(e.target.value) })} className="w-full accent-amber-400" />
          </label>
          <Toggle label="🎵 Music" on={s.music ?? true} onChange={(v) => set({ music: v })} hint="A gentle music-box tune for each place, made up as it plays. It picks up a little when the board gets crowded." />
          {(s.music ?? true) && (
            <label className="block py-1 text-sm font-bold">
              Music volume
              <input type="range" min={0} max={1} step={0.05} value={s.musicVolume ?? 0.5} onChange={(e) => set({ musicVolume: Number(e.target.value) })} className="w-full accent-amber-400" />
            </label>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Assists</h2>
          <p className="text-xs font-bold text-white/60">Assists are labelled wherever they apply and are always your choice.</p>
          <Toggle label="💡 Hint button" on={s.hints} onChange={(v) => set({ hints: v })} hint="Adds a Hint button that shows Burst Bot's move. Games where you use it are marked 💡 and don't count for ranks." />
          <Toggle label="Line-clear preview" on={s.clearPreview} onChange={(v) => set({ clearPreview: v })} hint="While you drag a piece, the lines it would clear light up in its colour." />
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Comfort</h2>
          <Toggle label="Reduce motion" on={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} hint="No screen shake, flying particles or bouncing menus. Follows your system setting too." />
          <Toggle label="Haptics" on={s.haptics} onChange={(v) => set({ haptics: v })} hint="A small buzz when you pick up a piece and when lines clear, on devices that support it. Off until you turn it on." />
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Reminders</h2>
          {!canNotify ? (
            <p className="text-sm font-bold text-white/70">This browser doesn't support notifications.</p>
          ) : (
            <>
              <Toggle
                label="🔔 Reminders"
                on={notify.enabled}
                onChange={async (v) => {
                  if (!v) return setNotify({ enabled: false, asked: true });
                  const p = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
                  setNotify({ enabled: p === 'granted', asked: true });
                }}
                hint="At most one a day, at your usual play time, never between 22:00 and 08:00, never while you're playing. They stop by themselves if three go unopened. Off until you turn them on."
              />
              {notify.enabled &&
                NOTIFY_KINDS.map((k) => <Toggle key={k.kind} label={k.label} on={notify.kinds[k.kind]} onChange={(v) => setNotify({ kinds: { ...notify.kinds, [k.kind]: v } })} />)}
              <p className="text-xs font-bold text-white/60">There are no "your streak is about to end", "your crew needs you" or sale messages, ever.</p>
            </>
          )}
          <Toggle label="App icon badge" on={s.appBadge} onChange={(v) => set({ appBadge: v })} hint="A number on the installed app's icon when something is really waiting to be claimed. Off until you turn it on." />
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Breaks</h2>
          <p className="text-sm font-bold text-white/70">Taking time off never costs you anything: no decay, no lost places, nothing for your crew to make up.</p>
          {vacation ? (
            <div className="mt-2">
              <p className="text-sm font-bold">🏖️ On vacation until {vacation.end}. Your streak is paused; reminders and badges are off.</p>
              <Button tone="ghost" className="mt-2 w-full" onClick={endVacation}>
                End vacation now
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {[3, 7, 14, 30].map((d) => (
                <Button key={d} tone="ghost" className="!px-3 !py-1 text-sm" onClick={() => startVacation(d)}>
                  🏖️ {d} days
                </Button>
              ))}
            </div>
          )}
          <label className="mt-3 block text-sm font-bold">
            Break reminder
            <select value={s.breakMinutes} onChange={(e) => set({ breakMinutes: Number(e.target.value) })} className="mt-1 w-full min-h-tap rounded-xl border-2 border-night-950 bg-night-950 px-2 py-1 text-white">
              {BREAK_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'Off' : `After ${m} minutes of play`}
                </option>
              ))}
            </select>
            <span className="block text-xs text-white/70">A gentle note on the end-of-game screen, which is a natural place to stop. Never in the middle of a game.</span>
          </label>
        </Panel>
        <AdsPanel />
        <Panel>
          <h2 className="font-display text-lg font-extrabold">Fair play</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-bold text-white/80">
            <li>The tray generator reads the seed, the tray number and the board, and nothing else. It never adapts to you, your history or your spending.</li>
            <li>It looks for a tray you can fully place before dealing. In long Classic games it looks less hard, so games end; that ramp is by tray number only.</li>
            <li>Every Adventure level was beaten by Burst Bot before it shipped. Scores are replayable from a hash-chained move log.</li>
            <li>Practice players in leagues, boards and crews are labelled [BOT], and their pace never reacts to you.</li>
            <li>Mystery Crate odds are published on the crate. Coins can't be bought.</li>
            <li>Skins, themes, bursts and avatars are looks only.</li>
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-extrabold">How to play</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-bold text-white/80">
            <li>Drag a piece from the tray onto the board. Pieces don't rotate.</li>
            <li>Fill a whole row or column to clear it. Clear several at once, or keep clearing turn after turn, for big combos.</li>
            <li>When all three pieces are placed you get three more. The game ends when none of your pieces fit.</li>
            <li>Keyboard: 1, 2, 3 pick a piece, arrows move it, Enter places it, Esc or P pauses.</li>
          </ul>
        </Panel>
        <Button tone="ghost" className="w-full" onClick={() => go('store')}>
          💳 Store and spending limit
        </Button>
      </div>
    </Screen>
  );
}

function AdsPanel() {
  const ads = useEconomyStore((x) => x.ads);
  const setConsent = useEconomyStore((x) => x.setConsent);
  const age = useEconomyStore((x) => (x.birthYear === null ? null : new Date().getUTCFullYear() - x.birthYear));
  const cfg = liveConfig();
  return (
    <Panel>
      <h2 className="font-display text-lg font-extrabold">Sponsor breaks</h2>
      <p className="text-sm font-bold text-white/70">
        {ads.removed
          ? 'Off for good: you turned them off in the Store.'
          : `At most one between games every ${cfg.interstitialEveryGames} games and ${Math.round(cfg.interstitialMinGapSec / 60)} minutes, never in your first ${cfg.newPlayerGraceGames} games, never during a game, never on the game-over or pause screens. No banners.`}
      </p>
      <p className="mt-2 text-sm font-bold">Ad choice: {ads.consent === 'unknown' ? 'not asked yet' : ads.consent}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button tone={ads.consent === 'contextual' ? 'go' : 'ghost'} className="text-sm" onClick={() => setConsent('contextual')}>
          Contextual only
        </Button>
        <Button tone={ads.consent === 'personalised' ? 'go' : 'ghost'} className="text-sm" disabled={age === null || age < 16} onClick={() => setConsent('personalised')}>
          Personalised
        </Button>
      </div>
    </Panel>
  );
}
