import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Biblioteca de ROMs do host no IndexedDB (armazenamento em disco, não ocupa RAM).
// Metadados e dados ficam em stores separados para listar a biblioteca sem carregar os arquivos.

export interface RomMeta {
  /** SHA-1 do arquivo: identifica o jogo e evita duplicatas. */
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
  readonly size: number;
  readonly addedAt: number;
  readonly lastPlayedAt: number | null;
}

interface LibrarySchema extends DBSchema {
  meta: { key: string; value: RomMeta };
  data: { key: string; value: Blob };
}

const DB_NAME = 'onlemu-library';
const DB_VERSION = 1;

export class RomLibrary {
  private dbPromise: Promise<IDBPDatabase<LibrarySchema>> | null = null;

  private db(): Promise<IDBPDatabase<LibrarySchema>> {
    this.dbPromise ??= openDB<LibrarySchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('meta', { keyPath: 'id' });
        db.createObjectStore('data');
      },
    });
    return this.dbPromise;
  }

  async list(): Promise<RomMeta[]> {
    const all = await (await this.db()).getAll('meta');
    return all.sort((a, b) => (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt));
  }

  async add(file: File): Promise<RomMeta> {
    const id = await sha1(file);
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

  async remove(id: string): Promise<void> {
    const tx = (await this.db()).transaction(['meta', 'data'], 'readwrite');
    await Promise.all([tx.objectStore('meta').delete(id), tx.objectStore('data').delete(id), tx.done]);
  }
}

async function sha1(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
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
