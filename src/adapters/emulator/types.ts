import type { PadState } from '../../core/input/pad';

/**
 * O que o resto do app sabe sobre um emulador. Tudo que é específico do EmulatorJS
 * (globais EJS_*, gameManager, Emscripten FS) fica escondido atrás desta interface.
 */
export interface Emulator {
  /** Monta o emulador dentro do elemento e resolve quando o jogo começa a rodar. */
  start(container: HTMLElement): Promise<void>;
  /** Aplica o estado do controle numa porta (só envia ao emulador o que mudou). */
  setInput(port: number, pad: PadState): void;
  releaseAll(port: number): void;
  /** Vídeo + áudio do jogo, para transmitir aos convidados. */
  captureStream(fps: number): Promise<MediaStream>;
  readonly saves: EmulatorSaves | null;
  destroy(): void;
}

export interface EmulatorSaves {
  /** Grava a memória do cartucho no armazenamento do navegador e espera terminar. */
  flushSave(): Promise<void>;
  /** Save do cartucho (ex.: EEPROM). null se o jogo ainda não gravou nada. */
  exportSave(): Uint8Array | null;
  /** Extensão do arquivo de save usada pelo core (ex.: "eep", "srm"). */
  readonly saveExtension: string;
  importSave(data: Uint8Array): void;
  exportState(): Uint8Array;
  importState(data: Uint8Array): void;
}

export class EmulatorLoadError extends Error {
  override readonly name = 'EmulatorLoadError';
}
