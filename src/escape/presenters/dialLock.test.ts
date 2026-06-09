import { describe, it, expect } from 'vitest';
import { dialsMatch, normalizeDials } from './DialLockPresenter';

describe('dial lock', () => {
  it('matches when dials equal the target code', () => {
    expect(dialsMatch([4, 7, 3], '473')).toBe(true);
  });
  it('does not match a wrong combination', () => {
    expect(dialsMatch([4, 7, 2], '473')).toBe(false);
  });
  it('normalizes dial wrap-around (0-9)', () => {
    expect(normalizeDials([10, -1, 13])).toEqual([0, 9, 3]);
  });
});
