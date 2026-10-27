/** Guardrail UI: non-human badges and the spend-limit meter. */
import clsx from 'clsx';
import { formatCents, HARD_CAP_CENTS, spentInMonth } from '../../lib/economy';
import { monthKey } from '../../lib/dates';
import { useEconomyStore } from '../../stores/useEconomyStore';
import { Meter } from './ui';

/** Every bot or scripted player carries one of these. There is no way to hide it. */
export function NonHumanBadge({ kind = 'bot' }: { kind?: 'bot' | 'npc' }) {
  return (
    <span
      title={kind === 'bot' ? 'A computer-controlled practice player, not a person.' : 'A game character, not a person.'}
      className={clsx('ml-1 inline-block rounded-md px-1.5 py-px align-middle font-mono text-[10px] font-bold tracking-wide text-night-950', kind === 'bot' ? 'bg-sky-300' : 'bg-amber-300')}
    >
      [{kind.toUpperCase()}]
    </span>
  );
}

export function SpendMeter() {
  const purchases = useEconomyStore((s) => s.purchases);
  const cap = useEconomyStore((s) => s.currentCap());
  const spent = spentInMonth(purchases, monthKey());
  return (
    <div className="w-full text-sm">
      <div className="flex justify-between font-bold text-white/80">
        <span>Spent this month</span>
        <span>
          {formatCents(spent)} / {formatCents(cap)}
        </span>
      </div>
      <Meter value={cap > 0 ? spent / cap : 1} className="mt-1" label="Spent this month" />
      <p className="mt-1 text-xs text-white/60">Hard ceiling {formatCents(HARD_CAP_CENTS)} a month. You can set a lower limit any time.</p>
    </div>
  );
}
