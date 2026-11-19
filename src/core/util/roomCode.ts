/** Alfabeto sem caracteres ambíguos (sem 0/O, 1/I). 32 símbolos: o módulo não gera viés. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type RandomBytes = (length: number) => Uint8Array;

export function generateRoomCode(length: number, randomBytes: RandomBytes): string {
  return Array.from(randomBytes(length), (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(code: string, length: number): boolean {
  return code.length === length && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}
