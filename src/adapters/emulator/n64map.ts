import type { Button } from '../../core/input/pad';

// Índices de input do EmulatorJS para o esquema de controle "n64".
// Confirmados no código do EmulatorJS 4.2.3 (emulator.js, getControlScheme() === "n64").

export const N64_BUTTON_INDEX: Readonly<Record<Button, number>> = {
  A: 0,
  B: 1,
  START: 3,
  DUP: 4,
  DDOWN: 5,
  DLEFT: 6,
  DRIGHT: 7,
  L: 10,
  R: 11,
  Z: 12,
  CRIGHT: 20,
  CLEFT: 21,
  CDOWN: 22,
  CUP: 23,
};

export const N64_STICK_INDEX = { right: 16, left: 17, down: 18, up: 19 } as const;

/** Índices a partir daqui são eixos analógicos no EmulatorJS e recebem 0..AXIS_VALUE_MAX. */
export const FIRST_ANALOG_INDEX = 16;
export const AXIS_VALUE_MAX = 0x7fff;
