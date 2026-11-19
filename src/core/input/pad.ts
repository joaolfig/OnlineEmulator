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
