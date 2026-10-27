/**
 * Spoiler-free share text (Wordle style) and a 1080x1920 brag card. It never prints the board or the trays, only
 * how the game went, so it can be posted before friends have played.
 */
export interface ShareInfo {
  day: string;
  score: number;
  lines: number;
  maxCombo: number;
  bestMulti: number;
  perfects: number;
  daysPlayed: number;
  best: number;
  assisted: boolean;
}

/** Ten squares of progress towards your best (or a full bar when this game is the best). */
function bar(score: number, best: number): string {
  const n = best > 0 ? Math.min(10, Math.round((score / best) * 10)) : 10;
  return '🟦'.repeat(n) + '⬜'.repeat(10 - n);
}

export const fmt = (n: number) => n.toLocaleString('en-US');

export function shareText(i: ShareInfo): string {
  return [
    `🧱 Block Burst · Daily Board ${i.day}`,
    `🏁 ${fmt(i.score)} · ➖ ${i.lines} lines · 📅 ${i.daysPlayed} days${i.assisted ? ' · 💡 hints' : ''}`,
    `🔥 x${i.maxCombo} combo  ✖️ ${i.bestMulti} at once${i.perfects ? `  ✨ ${i.perfects} perfect` : ''}`,
    bar(i.score, i.best),
    'Same start for everyone today.',
  ].join('\n');
}

export function drawBragCard(i: ShareInfo, palette: string[], avatar: string): HTMLCanvasElement {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3b4fa8');
  g.addColorStop(1, '#141a3d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // A decorative block border in the player's skin. It is not the board.
  const s = 90;
  for (let k = 0; k < 12; k++) {
    ctx.fillStyle = palette[k % palette.length];
    ctx.fillRect(k * s, 0, s - 6, s - 6);
    ctx.fillRect(k * s, H - s, s - 6, s - 6);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(90, 260, W - 180, H - 520, 60);
  ctx.fill();
  ctx.fillStyle = '#1b2350';
  ctx.textAlign = 'center';
  ctx.font = '800 110px system-ui, sans-serif';
  ctx.fillText('Block Burst', W / 2, 420);
  ctx.font = '700 54px system-ui, sans-serif';
  ctx.fillText(`Daily Board · ${i.day}`, W / 2, 510);
  ctx.font = '800 220px system-ui, sans-serif';
  ctx.fillText(fmt(i.score), W / 2, 820);
  ctx.font = '700 60px system-ui, sans-serif';
  ctx.fillText('points', W / 2, 900);
  ctx.font = '80px system-ui, sans-serif';
  ctx.fillText(`➖${i.lines}  🔥x${i.maxCombo}  ✖️${i.bestMulti}`, W / 2, 1100);
  ctx.font = '700 56px system-ui, sans-serif';
  ctx.fillText(`📅 ${i.daysPlayed} days played${i.perfects ? ` · ✨ ${i.perfects} perfect` : ''}`, W / 2, 1240);
  ctx.font = '160px system-ui, sans-serif';
  ctx.fillText(avatar, W / 2, 1460);
  ctx.fillStyle = '#475569';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillText(i.assisted ? 'Played with 💡 hints.' : 'Same start for everyone today. Can you beat it?', W / 2, 1600);
  return c;
}

export async function shareOrCopy(text: string, card?: HTMLCanvasElement): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (card && navigator.canShare) {
      const blob = await new Promise<Blob | null>((r) => card.toBlob(r, 'image/png'));
      if (blob) {
        const file = new File([blob], 'block-burst-daily.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ text, files: [file] });
          return 'shared';
        }
      }
    }
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function downloadCard(card: HTMLCanvasElement, name: string): void {
  const a = document.createElement('a');
  a.href = card.toDataURL('image/png');
  a.download = name;
  a.click();
}
