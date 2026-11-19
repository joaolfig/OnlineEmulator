import { signal } from '@preact/signals-core';
import type { EmulatorSaves } from '../../adapters/emulator/types';
import { pushSnapshot, snapshotIndexFor, type Snapshot } from '../../core/saves/rewind';
import type { Logger } from '../logger';

export interface RewindBufferDeps {
  readonly saves: EmulatorSaves;
  readonly logger: Logger;
  readonly intervalMs: number;
  readonly capacity: number;
  /** Compressão das fotos (gzip no navegador; identidade nos testes). */
  readonly compress: (data: Uint8Array) => Promise<Uint8Array>;
  readonly decompress: (data: Uint8Array) => Promise<Uint8Array>;
  readonly now?: () => number;
}

/**
 * "Voltar no tempo": tira um savestate comprimido a cada intervalo, guardando os mais recentes
 * na memória. Voltar descarta as fotos posteriores (a partida segue a partir dali) e guarda
 * o momento anterior para poder desfazer.
 */
export class RewindBuffer {
  /** Fotos disponíveis (sem os dados), para a UI saber até onde dá para voltar. */
  readonly times = signal<readonly number[]>([]);
  readonly canUndo = signal(false);
  readonly memoryBytes = signal(0);

  private snapshots: Snapshot<Uint8Array>[] = [];
  private undo: Uint8Array | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy: Promise<unknown> = Promise.resolve();
  private readonly now: () => number;

  constructor(private readonly deps: RewindBufferDeps) {
    this.now = deps.now ?? Date.now;
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => void this.capture(), this.deps.intervalMs);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Tira uma foto agora. */
  capture(): Promise<void> {
    return this.serialize('Falha ao guardar o ponto de volta', async () => {
      const data = await this.deps.compress(this.deps.saves.exportState());
      this.setSnapshots(pushSnapshot(this.snapshots, { time: this.now(), data }, this.deps.capacity));
    });
  }

  /** Volta para a foto mais recente com pelo menos `seconds` de idade. false se não houver. */
  rewind(seconds: number): Promise<boolean> {
    return this.serialize('Falha ao voltar no tempo', async () => {
      const index = snapshotIndexFor(this.snapshots, this.now(), seconds * 1000);
      if (index === null) return false;
      const target = this.snapshots[index];
      if (!target) return false;
      this.undo = await this.deps.compress(this.deps.saves.exportState());
      this.deps.saves.importState(await this.deps.decompress(target.data));
      // A foto escolhida continua valendo; as posteriores viraram um "futuro" que não aconteceu.
      this.setSnapshots(this.snapshots.slice(0, index + 1));
      this.canUndo.value = true;
      return true;
    }).then((ok) => ok ?? false);
  }

  /** Desfaz o último "voltar", retornando ao momento em que o botão foi apertado. */
  undoRewind(): Promise<void> {
    return this.serialize('Falha ao desfazer', async () => {
      if (!this.undo) return;
      this.deps.saves.importState(await this.deps.decompress(this.undo));
      this.undo = null;
      this.canUndo.value = false;
    });
  }

  private setSnapshots(list: Snapshot<Uint8Array>[]): void {
    this.snapshots = list;
    this.times.value = list.map((s) => s.time);
    this.memoryBytes.value = list.reduce((sum, s) => sum + s.data.byteLength, 0);
  }

  /** Uma operação por vez: exportar e importar estado ao mesmo tempo corromperia o resultado. */
  private serialize<T>(errorMessage: string, task: () => Promise<T>): Promise<T | undefined> {
    const run = this.busy.then(task).catch((err: unknown) => {
      this.deps.logger.error(errorMessage, err);
      return undefined;
    });
    this.busy = run;
    return run;
  }
}
