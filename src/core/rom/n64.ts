// ROMs de N64 circulam em três ordens de bytes. O catálogo (No-Intro) usa a ordem .z64 (big-endian),
// então normalizamos antes de calcular o hash para identificar o jogo.

export type N64ByteOrder = 'z64' | 'v64' | 'n64';

/** Primeiros 4 bytes de uma ROM de N64 em cada ordem. */
const MAGIC: Readonly<Record<N64ByteOrder, readonly number[]>> = {
  z64: [0x80, 0x37, 0x12, 0x40], // big-endian (nativo)
  v64: [0x37, 0x80, 0x40, 0x12], // pares de bytes trocados
  n64: [0x40, 0x12, 0x37, 0x80], // little-endian (palavras de 32 bits invertidas)
};

export function detectN64ByteOrder(bytes: Uint8Array): N64ByteOrder | null {
  for (const [order, magic] of Object.entries(MAGIC) as [N64ByteOrder, readonly number[]][]) {
    if (magic.every((b, i) => bytes[i] === b)) return order;
  }
  return null;
}

/** Devolve uma cópia em ordem .z64 (ou o próprio array, se já estiver). null se não for ROM de N64. */
export function toZ64(bytes: Uint8Array): Uint8Array | null {
  const order = detectN64ByteOrder(bytes);
  if (order === null) return null;
  if (order === 'z64') return bytes;
  const out = new Uint8Array(bytes.length);
  const step = order === 'v64' ? 2 : 4;
  for (let i = 0; i + step <= bytes.length; i += step) {
    for (let j = 0; j < step; j++) out[i + j] = bytes[i + step - 1 - j] ?? 0;
  }
  return out;
}
