import { describe, expect, it } from 'vitest';
import { keyOutGreen } from '../src/exhibit/chromaKey';

const ALPHA = 3;

/** One RGBA pixel run through the key. */
function keyed(rgb: readonly [number, number, number]): number[] {
  const pixels = new Uint8ClampedArray([...rgb, 255]);
  keyOutGreen(pixels);
  return [...pixels];
}

describe('the green-screen key on the penguin clips', () => {
  it('makes the bright green backdrop fully transparent', () => {
    expect(keyed([113, 245, 21])[ALPHA]).toBe(0);
  });

  it('keeps the penguin\'s white, black, orange and the ring\'s pink fully opaque and unchanged', () => {
    expect(keyed([250, 250, 250])).toEqual([250, 250, 250, 255]);
    expect(keyed([30, 32, 40])).toEqual([30, 32, 40, 255]);
    expect(keyed([245, 150, 30])).toEqual([245, 150, 30, 255]);
    expect(keyed([240, 90, 160])).toEqual([240, 90, 160, 255]);
  });

  it('turns the green-tinted shadow on the backdrop transparent too', () => {
    expect(keyed([70, 165, 10])[ALPHA]).toBe(0);
  });

  it('half-keeps a greenish edge pixel and takes the green spill out of it', () => {
    const [red, green, blue, alpha] = keyed([150, 215, 120]);

    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
    expect(green).toBeLessThanOrEqual(Math.max(red ?? 0, blue ?? 0));
  });
});
