import { EmulatorJSAdapter } from '../../adapters/emulator/emulatorjs';
import { FakeEmulator } from '../../adapters/emulator/fake';
import type { Emulator } from '../../adapters/emulator/types';
import { config } from '../../config';

/** O que o host escolheu jogar: uma ROM da biblioteca ou o modo teste. */
export type GameSource =
  { readonly kind: 'rom'; readonly file: File; readonly name: string } | { readonly kind: 'test' };

export function createEmulator(source: GameSource): Emulator {
  return source.kind === 'rom'
    ? new EmulatorJSAdapter({ rom: source.file, core: 'n64', gameName: source.name })
    : new FakeEmulator(config.portCount);
}

export const gameName = (source: GameSource): string => (source.kind === 'rom' ? source.name : 'Modo teste');
