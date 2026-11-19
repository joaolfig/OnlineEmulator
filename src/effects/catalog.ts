// Efeitos que o jogador pode ligar no jogo (mais de um ao mesmo tempo). Este arquivo não depende
// do three.js, então a interface pode importá-lo direto; o resto do módulo só carrega quando
// algum efeito é ligado.

export const EFFECT_IDS = ['tilt', 'crt', 'relief'] as const;
export type EffectId = (typeof EFFECT_IDS)[number];

/** Conjunto de efeitos ligados, sempre na ordem de EFFECT_IDS e sem repetição. */
export type EffectSet = readonly EffectId[];

export const isEffectId = (value: string): value is EffectId =>
  (EFFECT_IDS as readonly string[]).includes(value);

export function normalizeEffects(effects: Iterable<string>): EffectSet {
  const chosen = new Set([...effects].filter(isEffectId));
  return EFFECT_IDS.filter((id) => chosen.has(id));
}

export function toggleEffect(effects: EffectSet, id: EffectId): EffectSet {
  return normalizeEffects(effects.includes(id) ? effects.filter((e) => e !== id) : [...effects, id]);
}

/** Preferência salva como "tilt,crt". Valores estranhos (versões antigas, edição manual) são ignorados. */
export const parseEffects = (saved: string | null): EffectSet => normalizeEffects((saved ?? '').split(','));
export const serializeEffects = (effects: EffectSet): string => effects.join(',');
