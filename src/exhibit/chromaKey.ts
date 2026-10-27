/**
 * Keys the green backdrop out of the penguin clips, frame by frame. Greenness is how far green rises above the
 * brighter of red and blue: the backdrop and its shadow are far above, the penguin and its ring are at or below.
 * Pixels in between (soft edges, the tanning tray's glow) become partly transparent and lose their green spill.
 */
const RGBA = 4;
const OPAQUE = 255;
/** Greenness at or below this stays fully opaque. */
const KEEP_GREENNESS = 40;
/** Greenness at or above this becomes fully transparent. */
const DROP_GREENNESS = 90;

export function keyOutGreen(pixels: Uint8ClampedArray): void {
  for (let offset = 0; offset < pixels.length; offset += RGBA) {
    keyPixel(pixels, offset);
  }
}

function keyPixel(pixels: Uint8ClampedArray, offset: number): void {
  const red = pixels[offset] ?? 0;
  const green = pixels[offset + 1] ?? 0;
  const blue = pixels[offset + 2] ?? 0;
  const brighterOther = Math.max(red, blue);
  const greenness = green - brighterOther;
  if (greenness <= KEEP_GREENNESS) {
    pixels[offset + 1] = Math.min(green, brighterOther + KEEP_GREENNESS);
    return;
  }
  const transparency = Math.min(1, (greenness - KEEP_GREENNESS) / (DROP_GREENNESS - KEEP_GREENNESS));
  pixels[offset + 1] = brighterOther;
  pixels[offset + 3] = Math.round(OPAQUE * (1 - transparency));
}
