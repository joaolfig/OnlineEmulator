import { EmulatorJSAdapter } from '../adapters/emulator/emulatorjs';
import type { SystemInfo } from '../adapters/emulator/systems';
import type { PadState } from '../core/input/pad';
import { DemoScene } from './demoScene';

/** De onde vem a imagem do jogo no laboratório. */
export interface LabSource {
  readonly stream: MediaStream;
  /** Elemento que mostra a imagem original (sem efeito), para comparar. */
  readonly original: HTMLElement;
  setPad(pad: PadState): void;
  dispose(): void;
}

export function createDemoSource(): LabSource {
  const scene = new DemoScene();
  scene.start();
  return {
    stream: scene.canvas.captureStream(60),
    original: scene.canvas,
    setPad: (pad) => scene.setPad(pad),
    dispose: () => scene.stop(),
  };
}

/** ROM rodando no EmulatorJS (o mesmo adapter do host), jogando como P1. */
export async function createRomSource(
  rom: File,
  gameName: string,
  system: SystemInfo,
  container: HTMLElement,
): Promise<LabSource> {
  // No laboratório o app dirige o P1 (e a inclinação lê o mesmo controle).
  const emulator = new EmulatorJSAdapter({ rom, system, gameName, nativeControls: false });
  await emulator.start(container);
  return {
    stream: await emulator.captureStream(60),
    original: container,
    setPad: (pad) => emulator.setInput(0, pad),
    dispose: () => emulator.destroy(),
  };
}
