import { config } from '../../config';
import type { PadState } from '../../core/input/pad';
import { installAudioTap, tappedAudio } from '../media/audioTap';
import { PadApplier } from './padApplier';
import { EmulatorLoadError, type Emulator, type EmulatorSaves } from './types';

const AUDIO_TAP_TIMEOUT_MS = 3000;
/** Remove todos os mapeamentos de teclado/controle do próprio EmulatorJS: todo input passa pelo nosso app. */
const NO_CONTROLS = { 0: {}, 1: {}, 2: {}, 3: {} };

/**
 * Esconde os botões do EmulatorJS que o app já oferece (saves, tela cheia) ou que conflitam com ele
 * (netplay próprio, gamepad virtual, cheats). Ficam: pausar, volume e configurações de vídeo.
 */
const HIDDEN_BUTTONS = {
  restart: false,
  fullscreen: false,
  saveState: false,
  loadState: false,
  quickSave: false,
  quickLoad: false,
  saveSavFiles: false,
  loadSavFiles: false,
  screenRecord: false,
  screenshot: false,
  gamepad: false,
  cheat: false,
  cacheManager: false,
  exitEmulation: false,
  netplay: false,
  diskButton: false,
  contextMenu: false,
};

const DEFAULT_OPTIONS = {
  // O gamepad virtual do EmulatorJS controla sempre o P1 direto, ignorando a troca de portas.
  // O app usa os próprios controles touch no lugar dele.
  'virtual-gamepad': 'disabled',
};

export interface EmulatorJSOptions {
  readonly rom: File;
  readonly core: 'n64';
  readonly gameName: string;
}

/**
 * Adapter do EmulatorJS. Só pode haver uma instância por página: o EmulatorJS
 * é configurado por variáveis globais e não tem como ser descarregado.
 */
export class EmulatorJSAdapter implements Emulator {
  private ejs: EjsEmulator | null = null;
  private padApplier: PadApplier | null = null;
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly options: EmulatorJSOptions) {}

  start(container: HTMLElement): Promise<void> {
    if (window.EJS_emulator)
      return Promise.reject(new EmulatorLoadError('EmulatorJS já foi iniciado nesta página'));
    this.cleanup.push(installAudioTap());
    container.id ||= 'emulator';

    return new Promise((resolve, reject) => {
      Object.assign(window, {
        EJS_player: `#${container.id}`,
        EJS_core: this.options.core,
        EJS_gameUrl: this.options.rom,
        EJS_gameName: this.options.gameName,
        EJS_pathtodata: config.ejsDataUrl,
        EJS_startOnLoaded: true,
        EJS_defaultControls: NO_CONTROLS,
        // Sem isso, controles salvos pelo EmulatorJS sobrescreveriam NO_CONTROLS.
        EJS_disableLocalStorage: true,
        EJS_Buttons: HIDDEN_BUTTONS,
        EJS_defaultOptions: DEFAULT_OPTIONS,
        EJS_onGameStart: () => {
          const ejs = window.EJS_emulator;
          if (!ejs) return reject(new EmulatorLoadError('EmulatorJS iniciou sem expor a instância'));
          this.ejs = ejs;
          this.padApplier = new PadApplier((port, index, value) =>
            ejs.gameManager.simulateInput(port, index, value),
          );
          resolve();
        },
      } satisfies Partial<Window>);

      const script = document.createElement('script');
      script.src = `${config.ejsDataUrl}loader.js`;
      script.onerror = () => reject(new EmulatorLoadError('Não foi possível baixar o EmulatorJS'));
      document.body.append(script);
    });
  }

  setInput(port: number, pad: PadState): void {
    this.padApplier?.apply(port, pad);
  }

  releaseAll(port: number): void {
    this.padApplier?.release(port);
  }

  setSpeed(multiplier: number): void {
    const gm = this.ejs?.gameManager;
    if (!gm) return;
    if (multiplier <= 1) {
      gm.toggleFastForward(0);
      return;
    }
    gm.setFastForwardRatio(multiplier);
    gm.toggleFastForward(1);
  }

  async captureStream(fps: number): Promise<MediaStream> {
    const ejs = this.requireStarted();
    // Plano A: função do próprio EmulatorJS (usada na gravação de tela), já traz o áudio do OpenAL.
    const native = ejs.collectScreenRecordingMediaTracks?.(ejs.canvas, fps);
    if (native && native.getAudioTracks().length > 0) return native;

    // Plano B: vídeo do canvas + áudio interceptado.
    const stream = new MediaStream(ejs.canvas.captureStream(fps).getVideoTracks());
    const audio = await tappedAudio(AUDIO_TAP_TIMEOUT_MS);
    audio?.getAudioTracks().forEach((track) => stream.addTrack(track));
    return stream;
  }

  get saves(): EmulatorSaves | null {
    const gm = this.ejs?.gameManager;
    if (!gm) return null;
    return {
      get saveExtension() {
        return gm.getSaveFilePath().split('.').pop() ?? 'sav';
      },
      flushSave: () =>
        new Promise<void>((resolve, reject) => {
          gm.saveSaveFiles();
          // A pasta de saves é IDBFS: syncfs(false) só resolve quando o IndexedDB terminou de gravar.
          gm.FS.syncfs(false, (err) => (err ? reject(new Error(String(err))) : resolve()));
        }),
      exportSave: () => gm.getSaveFile(),
      importSave: (data) => {
        const path = gm.getSaveFilePath();
        let dir = '';
        for (const part of path.split('/').slice(0, -1)) {
          if (!part) continue;
          dir += `/${part}`;
          if (!gm.FS.analyzePath(dir).exists) gm.FS.mkdir(dir);
        }
        if (gm.FS.analyzePath(path).exists) gm.FS.unlink(path);
        gm.FS.writeFile(path, data);
        gm.loadSaveFiles();
      },
      exportState: () => gm.getState(),
      importState: (data) => gm.loadState(data),
    };
  }

  destroy(): void {
    this.cleanup.splice(0).forEach((fn) => fn());
  }

  private requireStarted(): EjsEmulator {
    if (!this.ejs) throw new EmulatorLoadError('Emulador ainda não iniciou');
    return this.ejs;
  }
}
