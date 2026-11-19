import { EmulatorJSAdapter } from '../../adapters/emulator/emulatorjs';
import { FakeEmulator } from '../../adapters/emulator/fake';
import type { Emulator } from '../../adapters/emulator/types';
import { config } from '../../config';

/** O que o host escolheu jogar: uma ROM da biblioteca (do início ou continuando) ou o modo teste. */
export type GameSource =
  | {
      readonly kind: 'rom';
      readonly romId: string;
      readonly file: File;
      /** Nome interno usado pelo EmulatorJS para o save do cartucho. */
      readonly name: string;
      /** Nome bonito para exibir (do catálogo, quando houver). */
      readonly title: string;
      /** Savestate a carregar ao iniciar ("Continuar"). */
      readonly resumeStateId: string | null;
    }
  | { readonly kind: 'test' };

export function createEmulator(source: GameSource): Emulator {
  return source.kind === 'rom'
    ? new EmulatorJSAdapter({ rom: source.file, core: 'n64', gameName: source.name })
    : new FakeEmulator(config.portCount);
}

export const gameTitle = (source: GameSource): string =>
  source.kind === 'rom' ? source.title : 'Modo teste';
