import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { HomeScreen } from './app/HomeScreen';
import { LogoSplash } from './components/meta/LogoSplash';
import { synth } from './engine/WebAudioSynthesizer';
import { useMetaStore } from './stores/useMetaStore';
import { useNav, type Screen } from './stores/useNav';

// Code-split: Home ships in the first bundle; every other screen loads when it's opened.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) => lazy(() => load().then((m) => ({ default: m[key] })));

const SCREENS: Record<Screen, ComponentType> = {
  home: HomeScreen,
  play: named(() => import('./app/PlayScreen'), 'PlayScreen'),
  settings: named(() => import('./app/SettingsScreen'), 'SettingsScreen'),
  sanctuary: named(() => import('./app/SanctuaryScreen'), 'SanctuaryScreen'),
  exhibit: named(() => import('./app/ExhibitScreen'), 'ExhibitScreen'),
};

/** Screens a deep link (the installed app's shortcuts) may open directly. */
const LINKABLE: ReadonlySet<Screen> = new Set<Screen>(['sanctuary', 'exhibit', 'settings']);

function useHydrated(): boolean {
  const [ready, setReady] = useState(() => useMetaStore.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    const unsubscribe = useMetaStore.persist.onFinishHydration(() => setReady(true));
    setReady(useMetaStore.persist.hasHydrated());
    return unsubscribe;
  }, [ready]);
  return ready;
}

/** Deep links: ?go=sanctuary and ?go=exhibit (the manifest shortcuts). */
function useDeepLinks(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const go = new URLSearchParams(location.search).get('go');
    if (go === null) return;
    if (LINKABLE.has(go as Screen)) useNav.getState().go(go as Screen);
    history.replaceState(null, '', location.pathname);
  }, [ready]);
}

/** Skeleton while a screen's code loads: the screen's shape, not a spinner. */
function ScreenSkeleton() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-12 rounded-2xl" />
      <div className="skeleton h-40 rounded-blob" />
      <div className="skeleton h-24 rounded-blob" />
      <div className="skeleton h-24 rounded-blob" />
    </div>
  );
}

export default function App() {
  const ready = useHydrated();
  const screen = useNav((s) => s.screen);
  const settings = useMetaStore((s) => s.settings);
  useDeepLinks(ready);

  useEffect(() => {
    synth.configure({ muted: settings.muted, masterVolume: settings.masterVolume, sfxVolume: settings.sfxVolume, music: settings.music, musicVolume: settings.musicVolume });
  }, [settings.muted, settings.masterVolume, settings.sfxVolume, settings.music, settings.musicVolume]);

  // Away from a game, the music settles into the calm menu tune (the play screen picks its scene's tune).
  useEffect(() => {
    if (screen !== 'play') {
      synth.music.setTheme('menu');
      synth.music.setIntensity(0);
      synth.music.duck(false);
    }
  }, [screen]);

  // Scroll back to the top when the screen changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  if (!ready) return <ScreenSkeleton />;
  const Current = SCREENS[screen];
  return (
    <div className={`app-bg cozy h-full font-body text-white ${settings.reducedMotion ? 'reduce-motion' : ''}`}>
      <Suspense fallback={<ScreenSkeleton />}>
        <Current />
      </Suspense>
      <LogoSplash skip={settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches} />
    </div>
  );
}
