// Bonecos (avatares) dos jogadores e reações rápidas.

/** Bonecos que cada jogador pode escolher (emojis: nada de personagens de jogos). */
export const AVATARS = [
  '🐸',
  '🐱',
  '🐼',
  '🦊',
  '🐵',
  '🐧',
  '🐙',
  '🦖',
  '🤖',
  '👽',
  '👻',
  '🐲',
  '🦄',
  '🐷',
  '🐻',
  '🐯',
] as const;
export type Avatar = (typeof AVATARS)[number];

export const isAvatar = (value: string | null): value is Avatar =>
  (AVATARS as readonly (string | null)[]).includes(value);

/** Primeiro boneco que ninguém está usando (ou o primeiro da lista, se acabarem). */
export function pickFreeAvatar(used: Iterable<string>): Avatar {
  const taken = new Set(used);
  return AVATARS.find((a) => !taken.has(a)) ?? AVATARS[0];
}

/**
 * Reações rápidas para provocar e comemorar durante a partida. São 8 para caberem nas teclas 1–8.
 * A ordem é a das teclas.
 */
export const REACTIONS = [
  { id: 'lol', emoji: '😂', text: 'Kkkkkk' },
  { id: 'nooo', emoji: '😱', text: 'Nãooo!' },
  { id: 'easy', emoji: '😎', text: 'Fácil demais' },
  { id: 'nice', emoji: '👏', text: 'Boa!' },
  { id: 'traitor', emoji: '😤', text: 'Traidor!' },
  { id: 'hurry', emoji: '🐢', text: 'Anda logo!' },
  { id: 'luck', emoji: '🍀', text: 'Sorte pura!' },
  { id: 'please', emoji: '🙏', text: 'Por favor…' },
] as const;
export type ReactionId = (typeof REACTIONS)[number]['id'];
export const REACTION_IDS = REACTIONS.map((r) => r.id) as unknown as readonly [ReactionId, ...ReactionId[]];

export const findReaction = (id: ReactionId) => REACTIONS.find((r) => r.id === id) ?? REACTIONS[0];

/** Quantas reações ficam empilhadas na tela ao mesmo tempo. */
export const MAX_VISIBLE_REACTIONS = 4;

/** Reação mostrada na tela: quem mandou e qual. */
export interface ReactionEvent {
  readonly key: number;
  readonly reaction: ReactionId;
  readonly name: string;
  readonly avatar: Avatar;
}
