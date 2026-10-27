/** Value checks for the Penguin Exhibit tuning that types can't make. */
import { EXHIBIT_TUNING, PENGUIN_TRICKS, type MsRange } from './tuning';

function checkRange(range: MsRange, name: string): string[] {
  const isOrdered = range.min > 0 && range.min <= range.max;
  return isOrdered ? [] : [`exhibit: ${name} must be positive with min <= max (got ${range.min}–${range.max})`];
}

function checkRanges(): string[] {
  return [
    ...checkRange(EXHIBIT_TUNING.tricks.firstAfterMs, 'tricks.firstAfterMs'),
    ...checkRange(EXHIBIT_TUNING.tricks.betweenMs, 'tricks.betweenMs'),
    ...checkRange(EXHIBIT_TUNING.wind.gustEveryMs, 'wind.gustEveryMs'),
    ...checkRange(EXHIBIT_TUNING.wind.gustDurationMs, 'wind.gustDurationMs'),
    ...checkRange(EXHIBIT_TUNING.wind.gustStrength, 'wind.gustStrength'),
  ];
}

function checkGustsDoNotOverlap(): string[] {
  const { gustEveryMs, gustDurationMs } = EXHIBIT_TUNING.wind;
  return gustDurationMs.max < gustEveryMs.min ? [] : ['exhibit: a gust must end before the next one can start (wind.gustDurationMs.max < wind.gustEveryMs.min)'];
}

function checkPenguin(): string[] {
  const { radius, wallBounce } = EXHIBIT_TUNING.penguin;
  const problems: string[] = [];
  if (radius <= 0 || radius >= 0.5) {
    problems.push(`exhibit: penguin.radius must be between 0 and half the pond's width (got ${radius})`);
  }
  if (wallBounce < 0 || wallBounce > 1) {
    problems.push(`exhibit: penguin.wallBounce must be between 0 and 1 (got ${wallBounce})`);
  }
  return problems;
}

function checkTricks(): string[] {
  const tricks = PENGUIN_TRICKS.map((clip) => clip.trick);
  const problems = new Set(tricks).size === tricks.length ? [] : ['exhibit: every penguin trick must be listed once'];
  return tricks.length > 0 ? problems : [...problems, 'exhibit: the penguin needs at least one trick'];
}

export const EXHIBIT_CHECKS: readonly (() => string[])[] = [checkRanges, checkGustsDoNotOverlap, checkPenguin, checkTricks];
