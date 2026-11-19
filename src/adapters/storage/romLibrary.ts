import { identifyN64Rom } from '../catalog/n64Catalog';
import { sha1Hex } from './hash';
import { openLibraryDb, type LibraryDb, type RomMeta } from './libraryDb';

export type { RomMeta } from './libraryDb';

/** Biblioteca de ROMs do host: arquivos, identificação pelo catálogo e capas personalizadas. */
export class RomLibrary {
  constructor(private readonly db: () => Promise<LibraryDb> = openLibraryDb) {}

  async list(): Promise<RomMeta[]> {
    const db = await this.db();
    const all = await db.getAll('meta');
    // Entradas criadas antes do catálogo existir são identificadas agora, uma vez só.
    const identified = await Promise.all(
      all.map(async (meta) => {
        if (meta.catalogName !== undefined) return meta;
        const blob = await db.get('data', meta.id);
        const updated: RomMeta = { ...meta, catalogName: blob ? await identifyN64Rom(blob) : null };
        await db.put('meta', updated);
        return updated;
      }),
    );
    return identified.sort((a, b) => (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt));
  }

  async add(file: File): Promise<RomMeta> {
    const id = await sha1Hex(file);
    const db = await this.db();
    const existing = await db.get('meta', id);
    if (existing) return existing;
    const meta: RomMeta = {
      id,
      name: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      size: file.size,
      addedAt: Date.now(),
      lastPlayedAt: null,
      catalogName: await identifyN64Rom(file),
    };
    const tx = db.transaction(['meta', 'data'], 'readwrite');
    await Promise.all([tx.objectStore('data').put(file, id), tx.objectStore('meta').put(meta), tx.done]);
    return meta;
  }

  /** Carrega o arquivo da ROM e marca como jogado agora. */
  async load(id: string): Promise<File> {
    const db = await this.db();
    const [meta, blob] = await Promise.all([db.get('meta', id), db.get('data', id)]);
    if (!meta || !blob) throw new Error('ROM não encontrada na biblioteca');
    await db.put('meta', { ...meta, lastPlayedAt: Date.now() });
    return new File([blob], meta.fileName);
  }

  /** Remove o jogo e tudo que é dele (capa e savestates). O save do cartucho fica com o EmulatorJS. */
  async remove(id: string): Promise<void> {
    const db = await this.db();
    const stateIds = await db.getAllKeysFromIndex('stateMeta', 'byRom', id);
    const tx = db.transaction(['meta', 'data', 'covers', 'stateMeta', 'stateData'], 'readwrite');
    await Promise.all([
      tx.objectStore('meta').delete(id),
      tx.objectStore('data').delete(id),
      tx.objectStore('covers').delete(id),
      ...stateIds.flatMap((s) => [
        tx.objectStore('stateMeta').delete(s),
        tx.objectStore('stateData').delete(s),
      ]),
      tx.done,
    ]);
  }

  async getCover(id: string): Promise<Blob | undefined> {
    return (await this.db()).get('covers', id);
  }

  async setCover(id: string, image: Blob): Promise<void> {
    await (await this.db()).put('covers', image, id);
  }

  async removeCover(id: string): Promise<void> {
    await (await this.db()).delete('covers', id);
  }
}

export interface StorageInfo {
  readonly usedBytes: number | null;
  readonly quotaBytes: number | null;
  readonly persisted: boolean;
}

export async function storageInfo(): Promise<StorageInfo> {
  const [estimate, persisted] = await Promise.all([
    navigator.storage?.estimate?.() ?? Promise.resolve(undefined),
    navigator.storage?.persisted?.() ?? Promise.resolve(false),
  ]);
  return { usedBytes: estimate?.usage ?? null, quotaBytes: estimate?.quota ?? null, persisted };
}

/** Pede ao navegador para não apagar os dados quando o disco encher. */
export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
