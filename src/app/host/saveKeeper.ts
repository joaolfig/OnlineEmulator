import { signal } from '@preact/signals-core';
import type { EmulatorSaves } from '../../adapters/emulator/types';
import type { StateMeta } from '../../adapters/storage/stateStore';
import type { Logger } from '../logger';

export interface SaveKeeperDeps {
  readonly saves: EmulatorSaves;
  readonly stateStore: { save(romId: string, data: Uint8Array, emulatorVersion: string): Promise<StateMeta> };
  readonly romId: string;
  readonly emulatorVersion: string;
  readonly logger: Logger;
  readonly cartridgeFlushIntervalMs: number;
  readonly autoStateIntervalMs: number;
  readonly now?: () => number;
}

/**
 * Mantém o progresso seguro enquanto o jogo roda:
 * - grava o save do cartucho periodicamente;
 * - tira savestates automáticos para "continuar de onde parou".
 * As operações são enfileiradas para nunca rodarem ao mesmo tempo.
 */
export class SaveKeeper {
  readonly lastCartridgeSave = signal<number | null>(null);
  readonly lastStateSave = signal<number | null>(null);

  private queue: Promise<void> = Promise.resolve();
  private timers: ReturnType<typeof setInterval>[] = [];
  private readonly now: () => number;

  constructor(private readonly deps: SaveKeeperDeps) {
    this.now = deps.now ?? Date.now;
  }

  start(): void {
    this.stop();
    this.timers = [
      setInterval(() => void this.flushCartridge(), this.deps.cartridgeFlushIntervalMs),
      setInterval(() => void this.saveState(), this.deps.autoStateIntervalMs),
    ];
  }

  stop(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  flushCartridge(): Promise<void> {
    return this.enqueue('Falha ao gravar o save do cartucho', async () => {
      await this.deps.saves.flushSave();
      this.lastCartridgeSave.value = this.now();
    });
  }

  saveState(): Promise<void> {
    return this.enqueue('Falha ao salvar o estado do jogo', async () => {
      const data = this.deps.saves.exportState();
      await this.deps.stateStore.save(this.deps.romId, data, this.deps.emulatorVersion);
      this.lastStateSave.value = this.now();
    });
  }

  /** Cartucho + savestate, ex.: antes de sair ou quando a aba vai para segundo plano. */
  async saveAll(): Promise<void> {
    await Promise.all([this.flushCartridge(), this.saveState()]);
  }

  private enqueue(errorMessage: string, task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task).catch((err: unknown) => this.deps.logger.error(errorMessage, err));
    this.queue = run;
    return run;
  }
}
