import { describe, expect, it } from 'vitest';
import { praiseFor } from '../src/engine/praise';

describe('praise', () => {
  it('an ordinary move earns none; a double starts at Sweet!', () => {
    expect(praiseFor(0, 0, false)).toBeNull();
    expect(praiseFor(1, 1, false)).toBeNull();
    expect(praiseFor(2, 1, false)).toEqual({ word: 'Sweet!', tier: 1 });
  });

  it('more lines and longer combos climb the words, topping out at Legendary!', () => {
    expect(praiseFor(3, 1, false)?.word).toBe('Lovely!');
    expect(praiseFor(1, 3, false)?.word).toBe('Sweet!');
    expect(praiseFor(3, 3, false)?.word).toBe('Dreamy!');
    expect(praiseFor(4, 5, false)?.word).toBe('Legendary!');
    expect(praiseFor(8, 9, false)?.tier).toBe(5);
  });

  it('an empty board is an All Clear, whatever else happened', () => {
    expect(praiseFor(1, 1, true)).toEqual({ word: 'All Clear!', tier: 6 });
  });
});
