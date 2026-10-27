/**
 * The demo ad placeholder and the consent card. No ad network is connected: the placeholder says so, and closes
 * immediately. On Poki or CrazyGames their SDK shows the real break instead and this never appears.
 */
import { effectiveConsent } from '../../lib/ads';
import { playerAge, useAdUi } from '../../lib/adService';
import { useEconomyStore } from '../../stores/useEconomyStore';
import { ModalShell } from '../game/ModalShell';
import { Button } from '../shared/ui';

export function SponsorBreak() {
  const showing = useAdUi((s) => s.showing);
  const consent = useAdUi((s) => s.consent);
  const setConsent = useEconomyStore((s) => s.setConsent);
  const ledger = useEconomyStore((s) => s.ads);

  if (consent) {
    const answer = (c: 'personalised' | 'contextual') => {
      setConsent(c);
      useAdUi.setState({ consent: null });
      consent.resolve();
    };
    const age = playerAge();
    return (
      <ModalShell label="Ad choices">
        <h2 className="font-display text-2xl font-extrabold">Your ad choices</h2>
        <p className="mt-2 text-sm font-bold text-white/80">Sponsor breaks help keep Block Burst free. You choose what they can use. You can change this any time in Settings.</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-white/80">
          <li>
            <b>Contextual:</b> ads based on the game only. Nothing about you.
          </li>
          <li>
            <b>Personalised:</b> ad partners may use an ad ID. {age === null || age < 16 ? 'Only available once you have told us you are 16 or older (Store).' : ''}
          </li>
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button tone="ghost" onClick={() => answer('personalised')} disabled={age === null || age < 16}>
            Personalised
          </Button>
          <Button tone="go" onClick={() => answer('contextual')} autoFocus>
            Contextual only
          </Button>
        </div>
      </ModalShell>
    );
  }

  if (!showing) return null;
  const close = (watched: boolean) => {
    useAdUi.setState({ showing: null });
    showing.resolve(watched);
  };
  return (
    <ModalShell label="Sponsor break">
      <p className="text-center text-5xl" aria-hidden>
        📺
      </p>
      <h2 className="text-center font-display text-2xl font-extrabold">Sponsor break</h2>
      <p className="mt-2 text-center text-sm font-bold text-white/80">
        Demo placeholder: no ad network is connected in this build. ({effectiveConsent(ledger, playerAge())} ads)
      </p>
      {showing.kind === 'rewarded' ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button tone="ghost" onClick={() => close(false)}>
            Skip (no reward)
          </Button>
          <Button tone="go" onClick={() => close(true)} autoFocus>
            Finish break
          </Button>
        </div>
      ) : (
        <Button tone="go" className="mt-4 w-full" onClick={() => close(true)} autoFocus>
          Close
        </Button>
      )}
    </ModalShell>
  );
}
