import { EmulatorJSAdapter } from '../../adapters/emulator/emulatorjs';
import { FakeEmulator } from '../../adapters/emulator/fake';
import type { SystemInfo } from '../../adapters/emulator/systems';
import type { Emulator } from '../../adapters/emulator/types';
import { config } from '../../config';

/** O que o host escolheu jogar: uma ROM da biblioteca (do início ou continuando) ou o modo teste. */
export type GameSource =
  | {
      readonly kind: 'rom';
      readonly romId: string;
      readonly file: File;
      readonly system: SystemInfo;
      /** Nome interno usado pelo EmulatorJS para o save do cartucho. */
      readonly name: string;
      /** Nome bonito para exibir (do catálogo, quando houver). */
      readonly title: string;
      /** Savestate a carregar ao iniciar ("Continuar"). */
      readonly resumeStateId: string | null;
    }
  | { readonly kind: 'test' };

/**
 * @param nativeControls true no PC: o teclado/controles do host ficam com o EmulatorJS (e o menu
 *   dele de configurar comandos); false no celular: o host joga pelos botões touch do app.
 */
export function createEmulator(source: GameSource, nativeControls: boolean): Emulator {
  return source.kind === 'rom'
    ? new EmulatorJSAdapter({
        rom: source.file,
        system: source.system,
        gameName: source.name,
        nativeControls,
      })
    : new FakeEmulator(config.portCount);
}

/** Portas do console deste jogo (o modo teste simula um N64). */
export const portCountOf = (source: GameSource): number =>
  source.kind === 'rom' ? source.system.ports : config.portCount;

export const gameTitle = (source: GameSource): string =>
  source.kind === 'rom' ? source.title : 'Modo teste';
