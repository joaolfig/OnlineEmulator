// Fase 0 (spike): código descartável para validar os riscos técnicos do PLANO.md.

export const PROTOCOL_VERSION = 1;
export const PEER_PREFIX = 'onlemu-spike-v1-';
export const EJS_VERSION = '4.2.3';
export const EJS_DATA = `https://cdn.emulatorjs.org/${EJS_VERSION}/data/`;
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
export const MAX_GUEST_PORTS = 3; // P2..P4 (P1 é o host)
export const HEARTBEAT_MS = 50;

// Botões N64 → índice do EmulatorJS.
// Confirmado no código do EmulatorJS 4.2.3 (esquema de controle "n64").
export const N64 = {
  A: 0, B: 1, START: 3,
  DUP: 4, DDOWN: 5, DLEFT: 6, DRIGHT: 7,
  L: 10, R: 11, Z: 12,
  CRIGHT: 20, CLEFT: 21, CDOWN: 22, CUP: 23,
};
// Índices >= 16 são eixos analógicos no EmulatorJS e recebem 0..0x7fff.
export const STICK = { RIGHT: 16, LEFT: 17, DOWN: 18, UP: 19 };
export const AXIS_MAX = 0x7fff;

// Posição de cada botão no bitmask enviado pela rede.
export const BUTTON_BITS = ['A', 'B', 'START', 'DUP', 'DDOWN', 'DLEFT', 'DRIGHT', 'L', 'R', 'Z', 'CUP', 'CDOWN', 'CLEFT', 'CRIGHT'];

// Estado completo do controle: bitmask de botões + analógico em -127..127 (y positivo = baixo).
export const emptyPad = () => ({ buttons: 0, x: 0, y: 0 });
export const samePad = (a, b) => a.buttons === b.buttons && a.x === b.x && a.y === b.y;

export function isValidPad(m) {
  return Number.isInteger(m.b) && m.b >= 0 && m.b < 1 << BUTTON_BITS.length &&
    Number.isInteger(m.x) && Math.abs(m.x) <= 127 &&
    Number.isInteger(m.y) && Math.abs(m.y) <= 127 &&
    Number.isInteger(m.seq) && m.seq >= 0 && m.seq <= 0xffff;
}

// seq é u16 e dá a volta depois de 65535.
export const isNewerSeq = (a, b) => a !== b && ((a - b) & 0xffff) < 0x8000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
export function randomCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function log(...args) {
  console.log('[onlemu]', ...args);
}
