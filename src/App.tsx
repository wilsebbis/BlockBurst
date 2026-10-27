import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { HomeScreen } from './app/HomeScreen';
import { SponsorBreak } from './components/meta/SponsorBreak';
import { TabBar } from './components/meta/TabBar';
import { LogoSplash } from './components/meta/LogoSplash';
import { UnlockCelebration } from './components/meta/UnlockCelebration';
import { synth } from './engine/WebAudioSynthesizer';
import { cosmeticById } from './lib/cosmetics';
import { loadRemoteConfig } from './lib/liveConfig';
import { useNotifications } from './lib/useNotifications';
import { useEconomyStore } from './stores/useEconomyStore';
import { useMetaStore } from './stores/useMetaStore';
import { useNav, type Screen } from './stores/useNav';
import { isCozy } from './lib/look';

// Code-split: Home ships in the first bundle; every other screen loads when it's opened (rule 7).
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) => lazy(() => load().then((m) => ({ default: m[key] })));

const SCREENS: Record<Screen, ComponentType> = {
  home: HomeScreen,
  play: named(() => import('./app/PlayScreen'), 'PlayScreen'),
  daily: named(() => import('./app/DailyScreen'), 'DailyScreen'),
  adventure: named(() => import('./app/AdventureScreen'), 'AdventureScreen'),
  ranks: named(() => import('./app/RanksScreen'), 'RanksScreen'),
  leagues: named(() => import('./app/LeaguesScreen'), 'LeaguesScreen'),
  crew: named(() => import('./app/CrewScreen'), 'CrewScreen'),
  challenges: named(() => import('./app/ChallengesScreen'), 'ChallengesScreen'),
  collection: named(() => import('./app/CollectionScreen'), 'CollectionScreen'),
  shop: named(() => import('./app/ShopScreen'), 'ShopScreen'),
  store: named(() => import('./app/StoreScreen'), 'StoreScreen'),
  pass: named(() => import('./app/PassScreen'), 'PassScreen'),
  events: named(() => import('./app/EventsScreen'), 'EventsScreen'),
  profile: named(() => import('./app/ProfileScreen'), 'ProfileScreen'),
  settings: named(() => import('./app/SettingsScreen'), 'SettingsScreen'),
  sanctuary: named(() => import('./app/SanctuaryScreen'), 'SanctuaryScreen'),
};

const GlancePage = named(() => import('./app/GlancePage'), 'GlancePage');

const stores = [useMetaStore, useEconomyStore];

function useHydrated(): boolean {
  const [ready, setReady] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    if (ready) return;
    const check = () => setReady(stores.every((s) => s.persist.hasHydrated()));
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [ready]);
  return ready;
}

/** Deep links: ?go=daily (manifest shortcuts) and ?crew=CODE (crew invites). */
function useDeepLinks(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(location.search);
    const code = q.get('crew');
    if (code && !useMetaStore.getState().crew.crew) {
      useMetaStore.getState().joinByCode(code);
      useNav.getState().go('crew');
    }
    const go = q.get('go');
    if (go && go in SCREENS && go !== 'play') useNav.getState().go(go as Screen);
    if (code || go) history.replaceState(null, '', location.pathname + (q.get('glance') ? `?glance=${q.get('glance')}` : ''));
  }, [ready]);
}

/** Skeleton while a screen's code loads: the screen's shape, not a spinner (rule 6). */
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
  const isCozyLook = isCozy(settings);
  useEffect(() => {
    // The page behind the app (overscroll, safe areas) and the browser bar follow the look too.
    document.documentElement.classList.toggle('cozy-root', isCozyLook);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isCozyLook ? '#f5ebe3' : '#141a3d');
  }, [isCozyLook]);
  const theme = useMetaStore((s) => s.loadout.theme);
  useDeepLinks(ready);

  useEffect(() => {
    synth.configure({ muted: settings.muted, masterVolume: settings.masterVolume, sfxVolume: settings.sfxVolume, music: settings.music ?? true, musicVolume: settings.musicVolume ?? 0.5 });
  }, [settings.muted, settings.masterVolume, settings.sfxVolume, settings.music, settings.musicVolume]);

  // Away from a game, the music settles into the calm menu tune (the play screen picks its scene's tune).
  useEffect(() => {
    if (screen !== 'play') {
      synth.music.setTheme('menu');
      synth.music.setIntensity(0);
      synth.music.duck(false);
    }
  }, [screen]);

  useEffect(() => {
    if (!ready) return;
    useMetaStore.getState().touch();
    void loadRemoteConfig();
  }, [ready]);

  // Scroll back to the top when the screen changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  if (!ready) return <ScreenSkeleton />;
  const board = cosmeticById(theme)?.board;
  if (new URLSearchParams(location.search).get('glance'))
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <GlancePage />
      </Suspense>
    );
  const Current = SCREENS[screen];
  return (
    <div className={`app-bg h-full font-body text-white ${settings.reducedMotion ? 'reduce-motion' : ''} ${isCozy(settings) ? 'cozy' : ''}`} style={{ ['--top' as string]: board?.top, ['--bottom' as string]: board?.bottom }}>
      <Suspense fallback={<ScreenSkeleton />}>
        <Current />
      </Suspense>
      {screen !== 'play' && <TabBar />}
      <UnlockCelebration />
      <SponsorBreak />
      <NotificationsAgent />
      {isCozy(settings) && <LogoSplash skip={settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches} />}
    </div>
  );
}

/** Mounted only after hydration, so the scheduler reads saved preferences. */
function NotificationsAgent() {
  useNotifications();
  return null;
}
