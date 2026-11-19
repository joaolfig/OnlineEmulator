// Regras de quais savestates automáticos manter.

export interface StateInfo {
  readonly id: string;
  readonly createdAt: number;
}

/** Mantém os `keep` mais recentes e devolve os ids que devem ser apagados. */
export function statesToPrune(states: readonly StateInfo[], keep: number): string[] {
  return [...states]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(keep)
    .map((s) => s.id);
}
