/** Sharing a finished level's Polaroid: the share sheet where there is one, the clipboard or a download otherwise. */
export const fmt = (n: number) => n.toLocaleString('en-US');

export async function shareOrCopy(text: string, card?: HTMLCanvasElement): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (card && navigator.canShare) {
      const blob = await new Promise<Blob | null>((r) => card.toBlob(r, 'image/png'));
      if (blob) {
        const file = new File([blob], 'block-burst-level.png', { type: 'image/png' });
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
