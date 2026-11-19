import { buttonMask, clampAxis, AXIS_LIMIT, type Button, type PadState } from './pad';

/** O que importa de um gamepad, sem depender da Gamepad API (facilita testes). */
export interface GamepadSnapshot {
  readonly buttons: readonly boolean[];
  readonly axes: readonly number[];
}

/** Botões do mapeamento "standard" da Gamepad API (layout Xbox/PlayStation) → botões N64. */
const STANDARD_MAPPING: readonly (readonly [index: number, button: Button])[] = [
  [0, 'A'],
  [1, 'B'],
  [2, 'B'],
  [4, 'L'],
  [5, 'R'],
  [6, 'Z'],
  [7, 'Z'],
  [9, 'START'],
  [12, 'DUP'],
  [13, 'DDOWN'],
  [14, 'DLEFT'],
  [15, 'DRIGHT'],
];

export const DEFAULT_DEADZONE = 0.15;
/** Inclinação do analógico direito a partir da qual um C-button conta como apertado. */
const C_BUTTON_THRESHOLD = 0.5;

export function padFromGamepad(gp: GamepadSnapshot, deadzone = DEFAULT_DEADZONE): PadState {
  let buttons = 0;
  for (const [index, button] of STANDARD_MAPPING) {
    if (gp.buttons[index]) buttons |= buttonMask(button);
  }
  const [ax = 0, ay = 0, cx = 0, cy = 0] = gp.axes;
  if (cy < -C_BUTTON_THRESHOLD) buttons |= buttonMask('CUP');
  if (cy > C_BUTTON_THRESHOLD) buttons |= buttonMask('CDOWN');
  if (cx < -C_BUTTON_THRESHOLD) buttons |= buttonMask('CLEFT');
  if (cx > C_BUTTON_THRESHOLD) buttons |= buttonMask('CRIGHT');

  const tilted = Math.hypot(ax, ay) > deadzone;
  return {
    buttons,
    x: tilted ? clampAxis(ax * AXIS_LIMIT) : 0,
    y: tilted ? clampAxis(ay * AXIS_LIMIT) : 0,
  };
}
