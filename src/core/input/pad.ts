// Estado de um controle N64, independente da origem (teclado, gamepad, touch, rede).

export const BUTTONS = [
  'A',
  'B',
  'START',
  'DUP',
  'DDOWN',
  'DLEFT',
  'DRIGHT',
  'L',
  'R',
  'Z',
  'CUP',
  'CDOWN',
  'CLEFT',
  'CRIGHT',
] as const;

export type Button = (typeof BUTTONS)[number];

/** Limite do analógico: x e y vão de -AXIS_LIMIT a AXIS_LIMIT (y positivo = para baixo). */
export const AXIS_LIMIT = 127;
export const ALL_BUTTONS_MASK = (1 << BUTTONS.length) - 1;

export interface PadState {
  /** Bitmask: o bit i corresponde a BUTTONS[i]. */
  readonly buttons: number;
  readonly x: number;
  readonly y: number;
}

export const EMPTY_PAD: PadState = Object.freeze({ buttons: 0, x: 0, y: 0 });

export const buttonMask = (button: Button): number => 1 << BUTTONS.indexOf(button);

export const isPressed = (pad: PadState, button: Button): boolean => (pad.buttons & buttonMask(button)) !== 0;

export const samePad = (a: PadState, b: PadState): boolean =>
  a.buttons === b.buttons && a.x === b.x && a.y === b.y;

export const clampAxis = (value: number): number =>
  Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, Math.round(value)));

/**
 * Junta vários controles num só (ex.: teclado + gamepad do mesmo jogador).
 * Botões somam; o analógico vem da primeira fonte que estiver inclinada.
 */
export function mergePads(pads: readonly PadState[]): PadState {
  let buttons = 0;
  let x = 0;
  let y = 0;
  for (const pad of pads) {
    buttons |= pad.buttons;
    if (x === 0 && y === 0 && (pad.x !== 0 || pad.y !== 0)) {
      x = pad.x;
      y = pad.y;
    }
  }
  return { buttons, x, y };
}

export const DPAD_MASK = buttonMask('DUP') | buttonMask('DDOWN') | buttonMask('DLEFT') | buttonMask('DRIGHT');

/** Centro do direcional na tela que não aperta nada (fração do raio). */
const DPAD_DEAD_ZONE = 0.18;
/** tan(22,5°): divide o círculo em 8 fatias iguais (4 direções e 4 diagonais). */
const DPAD_DIAGONAL_RATIO = 0.414;

/** Direções apertadas para um toque em (dx, dy), relativo ao centro do direcional (raio = 1). */
export function dpadMask(dx: number, dy: number): number {
  if (Math.hypot(dx, dy) < DPAD_DEAD_ZONE) return 0;
  let mask = 0;
  if (Math.abs(dx) > Math.abs(dy) * DPAD_DIAGONAL_RATIO) {
    mask |= buttonMask(dx < 0 ? 'DLEFT' : 'DRIGHT');
  }
  if (Math.abs(dy) > Math.abs(dx) * DPAD_DIAGONAL_RATIO) {
    mask |= buttonMask(dy < 0 ? 'DUP' : 'DDOWN');
  }
  return mask;
}

/** A partir de quanto o analógico conta como direcional apertado (metade do curso). */
export const STICK_TO_DPAD_THRESHOLD = AXIS_LIMIT / 2;

/**
 * Para consoles sem analógico: transforma a inclinação do analógico em direcional
 * (somando com o direcional que já estiver apertado) e zera o analógico.
 */
export function foldStickIntoDpad(pad: PadState, threshold = STICK_TO_DPAD_THRESHOLD): PadState {
  let buttons = pad.buttons;
  if (pad.y <= -threshold) buttons |= buttonMask('DUP');
  if (pad.y >= threshold) buttons |= buttonMask('DDOWN');
  if (pad.x <= -threshold) buttons |= buttonMask('DLEFT');
  if (pad.x >= threshold) buttons |= buttonMask('DRIGHT');
  return { buttons, x: 0, y: 0 };
}
