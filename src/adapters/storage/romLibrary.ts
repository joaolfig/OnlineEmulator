import { identifyN64Rom } from '../catalog/n64Catalog';
import { detectSystem, N64_SYSTEM, systemById, type SystemInfo } from '../emulator/systems';
import { sha1Hex } from './hash';
import { openLibraryDb, type LibraryDb, type RomMeta } from './libraryDb';

export type { RomMeta } from './libraryDb';

/** Console da ROM (entradas antigas, sem o campo, eram de N64). */
export const romSystem = (meta: RomMeta): SystemInfo => systemById(meta.system) ?? N64_SYSTEM;

export class UnsupportedRomError extends Error {
  override readonly name = 'UnsupportedRomError';
  constructor(readonly fileName: string) {
    super(`Formato de ROM não suportado: ${fileName}`);
  }
}

/** Biblioteca de ROMs do host: arquivos e identificação pelo catálogo. */
export class RomLibrary {
  constructor(private readonly db: () => Promise<LibraryDb> = openLibraryDb) {}

  async list(): Promise<RomMeta[]> {
    const db = await this.db();
    const all = await db.getAll('meta');
    // Entradas criadas antes do catálogo existir são identificadas agora, uma vez só.
    const identified = await Promise.all(
      all.map(async (meta) => {
        if (meta.catalogName !== undefined || romSystem(meta).id !== N64_SYSTEM.id) return meta;
        const blob = await db.get('data', meta.id);
        const updated: RomMeta = { ...meta, catalogName: blob ? await identifyN64Rom(blob) : null };
        await db.put('meta', updated);
        return updated;
      }),
    );
    return identified.sort((a, b) => (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt));
  }

  async add(file: File): Promise<RomMeta> {
    const system = detectSystem(file.name);
    if (!system) throw new UnsupportedRomError(file.name);
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
      system: system.id,
      // Só o N64 tem catálogo; nos outros consoles o nome do arquivo já costuma ser o oficial.
      catalogName: system.id === N64_SYSTEM.id ? await identifyN64Rom(file) : null,
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

  /** Remove o jogo e os savestates dele. O save do cartucho fica com o EmulatorJS. */
  async remove(id: string): Promise<void> {
    const db = await this.db();
    const stateIds = await db.getAllKeysFromIndex('stateMeta', 'byRom', id);
    const tx = db.transaction(['meta', 'data', 'stateMeta', 'stateData'], 'readwrite');
    await Promise.all([
      tx.objectStore('meta').delete(id),
      tx.objectStore('data').delete(id),
      ...stateIds.flatMap((s) => [
        tx.objectStore('stateMeta').delete(s),
        tx.objectStore('stateData').delete(s),
      ]),
      tx.done,
    ]);
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
