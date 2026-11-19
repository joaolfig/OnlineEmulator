// Tipos mínimos das partes do EmulatorJS 4.2.3 que o adapter usa.
// Mantidos aqui para que nenhum outro arquivo precise de `any`.

interface EjsFileSystem {
  analyzePath(path: string): { exists: boolean };
  mkdir(path: string): void;
  unlink(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  /** Sincroniza o sistema de arquivos com o IndexedDB (populate=false: memória → disco). */
  syncfs(populate: boolean, callback: (err: unknown) => void): void;
}

interface EjsGameManager {
  simulateInput(player: number, index: number, value: number): void;
  /** Pede ao core para escrever a memória do cartucho nos arquivos de save. */
  saveSaveFiles(): void;
  getSaveFile(save?: boolean): Uint8Array | null;
  getSaveFilePath(): string;
  loadSaveFiles(): void;
  getState(): Uint8Array;
  loadState(state: Uint8Array): void;
  readonly FS: EjsFileSystem;
}

interface EjsEmulator {
  readonly canvas: HTMLCanvasElement;
  readonly gameManager: EjsGameManager;
  collectScreenRecordingMediaTracks?(canvas: HTMLCanvasElement, fps: number): MediaStream | null;
}

type EjsControls = Record<number, Record<number, { value?: string; value2?: string }>>;

interface Window {
  EJS_player?: string;
  EJS_core?: string;
  EJS_gameUrl?: File | string;
  EJS_gameName?: string;
  EJS_pathtodata?: string;
  EJS_startOnLoaded?: boolean;
  EJS_defaultControls?: EjsControls;
  EJS_disableLocalStorage?: boolean;
  EJS_onGameStart?: () => void;
  EJS_emulator?: EjsEmulator;
}
