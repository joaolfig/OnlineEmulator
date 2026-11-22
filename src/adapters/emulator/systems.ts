import type { Button } from '../../core/input/pad';
import type { ControllerLayout } from '../../core/input/layout';
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
  /** Botões que o convidado vê na tela. */
  readonly layout: ControllerLayout;
  /** Quantas pessoas jogam ao mesmo tempo (portas do console, sem adaptadores). */
  readonly ports: number;
  /** Pasta do sistema no servidor de capas do libretro (por extensão, quando muda: GB × GBC). */
  readonly thumbnails: string | Readonly<Record<string, string>>;
}

export const N64_SYSTEM: SystemInfo = {
  id: 'n64',
  label: 'Nintendo 64',
  extensions: ['z64', 'n64', 'v64'],
  mapping: N64_MAPPING,
  layout: 'n64',
  ports: 4,
  thumbnails: 'Nintendo - Nintendo 64',
};

const retro = (
  id: string,
  label: string,
  layout: ControllerLayout,
  extensions: readonly string[],
  ports: number,
  thumbnails: SystemInfo['thumbnails'],
): SystemInfo => ({ id, label, extensions, mapping: RETROPAD, layout, ports, thumbnails });

export const SYSTEMS: readonly SystemInfo[] = [
  N64_SYSTEM,
  retro(
    'snes',
    'Super Nintendo',
    'snes',
    ['sfc', 'smc'],
    2,
    'Nintendo - Super Nintendo Entertainment System',
  ),
  retro('nes', 'NES', 'nes', ['nes'], 2, 'Nintendo - Nintendo Entertainment System'),
  retro('gba', 'Game Boy Advance', 'gba', ['gba'], 1, 'Nintendo - Game Boy Advance'),
  retro('gb', 'Game Boy / Color', 'nes', ['gb', 'gbc'], 1, {
    gb: 'Nintendo - Game Boy',
    gbc: 'Nintendo - Game Boy Color',
  }),
  retro('segaMD', 'Mega Drive', 'md', ['md', 'gen', 'smd'], 2, 'Sega - Mega Drive - Genesis'),
  retro('segaMS', 'Master System', 'sms', ['sms'], 2, 'Sega - Master System - Mark III'),
  retro('segaGG', 'Game Gear', 'gg', ['gg'], 1, 'Sega - Game Gear'),
  retro('pce', 'PC Engine', 'pce', ['pce'], 1, 'NEC - PC Engine - TurboGrafx 16'),
];

export const systemById = (id: string | undefined): SystemInfo | null =>
  SYSTEMS.find((s) => s.id === id) ?? null;

/** Pasta de capas do libretro para este arquivo. */
export function thumbnailSystem(system: SystemInfo, fileName: string): string {
  if (typeof system.thumbnails === 'string') return system.thumbnails;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return system.thumbnails[extension] ?? Object.values(system.thumbnails)[0] ?? '';
}

/** Descobre o console pela extensão do arquivo (ex.: "Zelda.sfc" → SNES). */
export function detectSystem(fileName: string): SystemInfo | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return SYSTEMS.find((s) => s.extensions.includes(extension)) ?? null;
}

export const SUPPORTED_EXTENSIONS = SYSTEMS.flatMap((s) => s.extensions.map((e) => `.${e}`));
