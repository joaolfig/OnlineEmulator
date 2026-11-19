import type { Button } from '../../core/input/pad';
import { N64_BUTTON_INDEX } from './n64map';

/**
 * Como o controle do app (layout de N64) vira os botões do EmulatorJS em cada console.
 * - analog: o analógico vai para o analógico do console (N64).
 * - dpad: o analógico vira direcional (consoles 2D, que não têm analógico).
 */
export interface PadMapping {
  readonly buttons: Readonly<Partial<Record<Button, number>>>;
  readonly stick: 'analog' | 'dpad';
}

// Índices do RetroPad no EmulatorJS: B=0, Y=1, SELECT=2, START=3, ↑4 ↓5 ←6 →7, A=8, X=9, L=10, R=11.
const RETROPAD: PadMapping = {
  buttons: {
    A: 8,
    B: 0,
    CLEFT: 1, // Y
    CUP: 9, // X
    Z: 2, // SELECT
    START: 3,
    DUP: 4,
    DDOWN: 5,
    DLEFT: 6,
    DRIGHT: 7,
    L: 10,
    R: 11,
  },
  stick: 'dpad',
};

export const N64_MAPPING: PadMapping = { buttons: N64_BUTTON_INDEX, stick: 'analog' };

export interface SystemInfo {
  /** Nome do sistema no EmulatorJS (EJS_core). */
  readonly id: string;
  readonly label: string;
  readonly extensions: readonly string[];
  readonly mapping: PadMapping;
}

export const N64_SYSTEM: SystemInfo = {
  id: 'n64',
  label: 'Nintendo 64',
  extensions: ['z64', 'n64', 'v64'],
  mapping: N64_MAPPING,
};

export const SYSTEMS: readonly SystemInfo[] = [
  N64_SYSTEM,
  { id: 'snes', label: 'Super Nintendo', extensions: ['sfc', 'smc'], mapping: RETROPAD },
  { id: 'nes', label: 'NES', extensions: ['nes'], mapping: RETROPAD },
  { id: 'gba', label: 'Game Boy Advance', extensions: ['gba'], mapping: RETROPAD },
  { id: 'gb', label: 'Game Boy / Color', extensions: ['gb', 'gbc'], mapping: RETROPAD },
  { id: 'segaMD', label: 'Mega Drive', extensions: ['md', 'gen', 'smd'], mapping: RETROPAD },
  { id: 'segaMS', label: 'Master System', extensions: ['sms'], mapping: RETROPAD },
  { id: 'segaGG', label: 'Game Gear', extensions: ['gg'], mapping: RETROPAD },
  { id: 'pce', label: 'PC Engine', extensions: ['pce'], mapping: RETROPAD },
];

/** Descobre o console pela extensão do arquivo (ex.: "Zelda.sfc" → SNES). */
export function detectSystem(fileName: string): SystemInfo | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return SYSTEMS.find((s) => s.extensions.includes(extension)) ?? null;
}

export const SUPPORTED_EXTENSIONS = SYSTEMS.flatMap((s) => s.extensions.map((e) => `.${e}`));
