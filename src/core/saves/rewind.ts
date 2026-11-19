// Regras do "voltar no tempo": uma fila de fotos (savestates) tiradas em intervalos regulares.

export interface Snapshot<T> {
  readonly time: number;
  readonly data: T;
}

/** Adiciona uma foto no fim e descarta as mais antigas além da capacidade. */
export function pushSnapshot<T>(
  list: readonly Snapshot<T>[],
  snapshot: Snapshot<T>,
  capacity: number,
): Snapshot<T>[] {
  return [...list, snapshot].slice(-capacity);
}

/**
 * Índice da foto mais recente tirada pelo menos `backMs` antes de `now`,
 * ou null se nenhuma foto for tão antiga assim.
 */
export function snapshotIndexFor<T>(
  list: readonly Snapshot<T>[],
  now: number,
  backMs: number,
): number | null {
  const target = now - backMs;
  for (let i = list.length - 1; i >= 0; i--) {
    const snap = list[i];
    if (snap && snap.time <= target) return i;
  }
  return null;
}

/** Até quantos ms atrás dá para voltar (0 se não houver fotos). */
export function rewindReachMs<T>(list: readonly Snapshot<T>[], now: number): number {
  const oldest = list[0];
  return oldest ? Math.max(0, now - oldest.time) : 0;
}
