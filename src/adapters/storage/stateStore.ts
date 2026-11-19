import { statesToPrune } from '../../core/saves/retention';
import { openLibraryDb, type LibraryDb, type StateMeta } from './libraryDb';

export type { StateMeta } from './libraryDb';

/** Savestates automáticos ("continuar de onde parou"), guardados por jogo no IndexedDB. */
export class StateStore {
  constructor(
    private readonly keep: number,
    private readonly db: () => Promise<LibraryDb> = openLibraryDb,
  ) {}

  /** Mais recentes primeiro. */
  async list(romId: string): Promise<StateMeta[]> {
    const states = await (await this.db()).getAllFromIndex('stateMeta', 'byRom', romId);
    return states.sort((a, b) => b.createdAt - a.createdAt);
  }

  async save(romId: string, data: Uint8Array, emulatorVersion: string): Promise<StateMeta> {
    const db = await this.db();
    const meta: StateMeta = {
      id: `${romId}:${Date.now()}`,
      romId,
      createdAt: Date.now(),
      size: data.byteLength,
      emulatorVersion,
    };
    const existing = await db.getAllFromIndex('stateMeta', 'byRom', romId);
    const prune = statesToPrune([...existing, meta], this.keep);
    const tx = db.transaction(['stateMeta', 'stateData'], 'readwrite');
    await Promise.all([
      tx.objectStore('stateData').put(new Blob([data as Uint8Array<ArrayBuffer>]), meta.id),
      tx.objectStore('stateMeta').put(meta),
      ...prune.flatMap((id) => [
        tx.objectStore('stateMeta').delete(id),
        tx.objectStore('stateData').delete(id),
      ]),
      tx.done,
    ]);
    return meta;
  }

  async load(stateId: string): Promise<Uint8Array> {
    const blob = await (await this.db()).get('stateData', stateId);
    if (!blob) throw new Error('Savestate não encontrado');
    return new Uint8Array(await blob.arrayBuffer());
  }
}
