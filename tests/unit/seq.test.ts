import { describe, expect, it } from 'vitest';
import { isNewerSeq, nextSeq } from '../../src/core/protocol/seq';

describe('seq', () => {
  it('avança e dá a volta depois de 65535', () => {
    expect(nextSeq(0)).toBe(1);
    expect(nextSeq(65535)).toBe(0);
  });

  it('compara considerando a volta', () => {
    expect(isNewerSeq(2, 1)).toBe(true);
    expect(isNewerSeq(1, 2)).toBe(false);
    expect(isNewerSeq(5, 5)).toBe(false);
    expect(isNewerSeq(0, 65535)).toBe(true);
    expect(isNewerSeq(10, 65530)).toBe(true);
    expect(isNewerSeq(65530, 10)).toBe(false);
  });
});
