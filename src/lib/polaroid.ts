/**
 * Polaroids: a screenshot of the finished game, scenery, creatures and all, printed on a little instant-photo
 * card with sticker badges. A keepsake to save or share instead of a generic "game over" popup.
 */
import { drawLogo } from '../engine/logo';

const W = 600;
const H = 1080;
const PHOTO = { x: 40, y: 40, w: 520, h: 700 };

/** Width over height of the photo window, for cropping the screenshot to fit. */
export const PHOTO_ASPECT = PHOTO.w / PHOTO.h;

export interface PolaroidGame {
  score: number;
  lines: number;
  maxCombo: number;
  bestMulti: number;
  perfects: number;
  newBest: boolean;
  rescued: number;
  /** Adventure level cleared, if any. */
  level: number | null;
}

/**
 * A playful title for the print and up to three sticker badges, from what happened in the game, so a stack of
 * Polaroids reads like a photo album rather than a list of scores.
 */
export function polaroidStamps(g: PolaroidGame): { title: string; badges: string[] } {
  const title =
    g.perfects > 0 ? 'Spotless'
    : g.bestMulti >= 4 ? 'The Great Flood'
    : g.maxCombo >= 8 ? 'Chain Reaction'
    : g.level !== null ? `Level ${g.level}, Cleared`
    : g.newBest ? 'Personal Best'
    : g.lines >= 60 ? 'The Long Haul'
    : g.lines >= 20 ? 'A Cozy Afternoon'
    : 'A Quick Hello';
  const badges: string[] = [];
  if (g.newBest) badges.push('👑 New best');
  if (g.maxCombo >= 5) badges.push(`🔥 ${g.maxCombo}-Combo Master`);
  if (g.bestMulti >= 3) badges.push(`➖ ${g.bestMulti} lines at once`);
  if (g.perfects > 0) badges.push('✨ Perfect clear');
  if (g.rescued >= 100) badges.push(`🌷 ${g.rescued} rescued`);
  return { title, badges: badges.slice(0, 3) };
}

/** An old-film date imprint: '26 10 27. */
export function dateStamp(at: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `'${two(at.getFullYear() % 100)} ${two(at.getMonth() + 1)} ${two(at.getDate())}`;
}

/**
 * The card: a white instant-photo frame around a screenshot of the game (scenery, creatures and all), with
 * sticker badges, a date stamp, a title and the print number and stars (or score) along the bottom strip.
 */
export function drawPolaroid(photo: HTMLCanvasElement, info: { number: number; stars: number; score: number; game: PolaroidGame; at?: Date; fail?: boolean; site?: string }): HTMLCanvasElement {
  const card = document.createElement('canvas');
  card.width = W;
  card.height = H;
  const ctx = card.getContext('2d')!;
  ctx.fillStyle = '#f6ece3';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(120,80,50,0.18)';
  ctx.shadowBlur = 18;
  ctx.fillRect(12, 12, W - 24, H - 24);
  ctx.shadowColor = 'transparent';
  ctx.save();
  ctx.beginPath();
  ctx.rect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
  ctx.clip();
  // Cover-fit the screenshot into the photo window.
  const k = Math.max(PHOTO.w / photo.width, PHOTO.h / photo.height);
  const pw = photo.width * k;
  const ph = photo.height * k;
  ctx.drawImage(photo, PHOTO.x + (PHOTO.w - pw) / 2, PHOTO.y + (PHOTO.h - ph) / 2, pw, ph);
  // A clipped fail gets a big red FAIL stamped across the photo and its own title.
  const stamps = polaroidStamps(info.game);
  const title = info.fail ? 'So Close!' : stamps.title;
  const badges = info.fail ? [] : stamps.badges;
  if (info.fail) {
    ctx.save();
    ctx.translate(PHOTO.x + PHOTO.w / 2, PHOTO.y + PHOTO.h * 0.5);
    ctx.rotate(-0.2);
    ctx.globalAlpha = 0.88;
    ctx.strokeStyle = '#e0565b';
    ctx.fillStyle = '#e0565b';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(-190, -80, 380, 160, 28);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-170, -60, 340, 120, 18);
    ctx.stroke();
    ctx.font = '900 120px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FAIL', 0, 6);
    ctx.restore();
  }
  // Sticker badges along the top of the photo, each set at a slight tilt.
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  let sx = PHOTO.x + 14;
  let sy = PHOTO.y + 34;
  badges.forEach((badge, i) => {
    const w = ctx.measureText(badge).width + 28;
    if (sx + w > PHOTO.x + PHOTO.w - 14) {
      sx = PHOTO.x + 14;
      sy += 46;
    }
    ctx.save();
    ctx.translate(sx + w / 2, sy);
    ctx.rotate((i % 2 ? 3 : -3) * (Math.PI / 180));
    ctx.shadowColor = 'rgba(80,60,40,0.2)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -19, w, 38, 19);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#6b5448';
    ctx.textAlign = 'center';
    ctx.fillText(badge, 0, 1);
    ctx.restore();
    sx += w + 8;
  });
  // The date, burnt into the corner of the photo in orange like an old film camera.
  ctx.font = '700 26px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff9a3c';
  ctx.shadowColor = 'rgba(255,140,40,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillText(dateStamp(info.at ?? new Date()), PHOTO.x + PHOTO.w - 16, PHOTO.y + PHOTO.h - 22);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6b5448';
  ctx.font = 'italic 700 34px Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, PHOTO.x + 4, PHOTO.y + PHOTO.h + 44);
  const stripY = PHOTO.y + PHOTO.h + 110;
  ctx.fillStyle = '#f1ece7';
  ctx.beginPath();
  ctx.roundRect(PHOTO.x, stripY - 30, 130, 56, 10);
  ctx.fill();
  ctx.fillStyle = '#9a8a80';
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`# ${String(info.number).padStart(3, '0')}`, PHOTO.x + 16, stripY);
  ctx.textAlign = 'right';
  if (info.stars > 0) {
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText('⭐'.repeat(info.stars), PHOTO.x + PHOTO.w, stripY);
  } else {
    ctx.fillStyle = '#6b5448';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText(info.score.toLocaleString('en-US'), PHOTO.x + PHOTO.w, stripY);
  }
  // The footer: the game's name and where to play it, so a shared Polaroid brings people to the game.
  const footY = stripY + 52;
  ctx.fillStyle = '#fbf3ea';
  ctx.beginPath();
  ctx.roundRect(PHOTO.x, footY, PHOTO.w, 150, 22);
  ctx.fill();
  drawLogo(ctx, W / 2, footY + 44, 46, 0, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a7a70';
  ctx.font = '700 22px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  ctx.fillText('Play free in your browser · no download needed', W / 2, footY + 94, PHOTO.w - 24);
  if (info.site) {
    ctx.fillStyle = '#e08a3c';
    ctx.font = '800 24px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
    ctx.fillText(info.site, W / 2, footY + 126, PHOTO.w - 24);
  }
  return card;
}
