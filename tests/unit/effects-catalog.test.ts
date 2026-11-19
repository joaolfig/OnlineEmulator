import { describe, expect, it } from 'vitest';
import { parseEffects, serializeEffects, toggleEffect } from '../../src/effects/catalog';

describe('efeitos ligados (vários ao mesmo tempo)', () => {
  it('liga e desliga mantendo uma ordem fixa', () => {
    let effects = toggleEffect([], 'relief');
    effects = toggleEffect(effects, 'tilt');
    expect(effects).toEqual(['tilt', 'relief']);
    expect(toggleEffect(effects, 'tilt')).toEqual(['relief']);
  });

  it('salva e lê a preferência, ignorando valores estranhos', () => {
    expect(parseEffects(serializeEffects(['tilt', 'crt']))).toEqual(['tilt', 'crt']);
    expect(parseEffects('crt,bloom,crt,,tilt')).toEqual(['tilt', 'crt']);
    expect(parseEffects(null)).toEqual([]);
    expect(parseEffects('none')).toEqual([]);
  });
});
