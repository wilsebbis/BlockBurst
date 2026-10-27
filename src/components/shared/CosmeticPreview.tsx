/** A small, DOM-only preview of any cosmetic: four blocks of a skin, a mini board, a burst or an avatar. */
import clsx from 'clsx';
import { RARITY_COLOR, type Cosmetic } from '../../lib/cosmetics';

export function CosmeticPreview({ item, size = 64, dim = false }: { item: Cosmetic; size?: number; dim?: boolean }) {
  const s = size;
  let inner;
  if (item.slot === 'skin' && item.palette) {
    const b = s / 2 - 4;
    inner = (
      <div className="grid grid-cols-2 gap-1">
        {[0, 2, 4, 6].map((i) => (
          <span key={i} style={{ width: b, height: b, background: item.palette![i], borderRadius: item.style === 'pixel' ? 0 : b * 0.2, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.25), inset 0 3px 0 rgba(255,255,255,.35)' }} />
        ))}
      </div>
    );
  } else if (item.slot === 'theme' && item.board) {
    inner = (
      <div className="grid grid-cols-3 gap-0.5 rounded-md p-1" style={{ background: item.board.bg }}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ width: s / 4.2, height: s / 4.2, background: i === 4 ? item.board!.top : item.board!.cell, borderRadius: 3 }} />
        ))}
      </div>
    );
  } else {
    inner = (
      <span style={{ fontSize: s * 0.6 }} aria-hidden>
        {item.emoji}
      </span>
    );
  }
  return (
    <div className={clsx('grid place-items-center rounded-xl border-[3px] bg-night-950/60', dim && 'opacity-50 grayscale')} style={{ width: s + 12, height: s + 12, borderColor: RARITY_COLOR[item.rarity] }} title={`${item.name} (${item.rarity})`}>
      {inner}
    </div>
  );
}
