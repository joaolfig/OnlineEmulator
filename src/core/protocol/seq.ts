// Número de sequência dos pacotes de input: u16 que dá a volta depois de 65535.

export const SEQ_MODULO = 0x10000;

export const nextSeq = (seq: number): number => (seq + 1) % SEQ_MODULO;

/** true se `a` é mais novo que `b`, considerando a volta (serial number arithmetic, RFC 1982). */
export function isNewerSeq(a: number, b: number): boolean {
  const diff = (a - b + SEQ_MODULO) % SEQ_MODULO;
  return diff !== 0 && diff < SEQ_MODULO / 2;
}
