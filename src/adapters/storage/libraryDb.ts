import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Banco do host no IndexedDB (armazenamento em disco, não ocupa RAM).
// Metadados e dados grandes ficam em stores separados, para listar sem carregar arquivos de MB.

export interface RomMeta {
  /** SHA-1 do arquivo como foi adicionado: identifica a entrada e evita duplicatas. */
  readonly id: string;
  /** Nome usado pelo EmulatorJS para o save do cartucho. Não pode mudar, senão o save "some". */
  readonly name: string;
  readonly fileName: string;
  readonly size: number;
  readonly addedAt: number;
  readonly lastPlayedAt: number | null;
  /** Console (id do EmulatorJS). Ausente nas entradas antigas, que eram todas de N64. */
  readonly system?: string;
  /** Nome oficial no catálogo (só N64); null = não encontrado; undefined = ainda não verificado. */
  readonly catalogName?: string | null;
}

export interface StateMeta {
  readonly id: string;
  readonly romId: string;
  readonly createdAt: number;
  readonly size: number;
  /** Savestates só abrem na mesma versão do emulador que os criou. */
  readonly emulatorVersion: string;
}

export interface LibrarySchema extends DBSchema {
  meta: { key: string; value: RomMeta };
  data: { key: string; value: Blob };
  stateMeta: { key: string; value: StateMeta; indexes: { byRom: string } };
  stateData: { key: string; value: Blob };
}

export type LibraryDb = IDBPDatabase<LibrarySchema>;

const DB_NAME = 'onlemu-library';
const DB_VERSION = 3;
/** Store de capas personalizadas, que existiu na versão 2 e foi removido na 3. */
const REMOVED_COVERS_STORE = 'covers';

let dbPromise: Promise<LibraryDb> | null = null;

export function openLibraryDb(): Promise<LibraryDb> {
  dbPromise ??= openDB<LibrarySchema>(DB_NAME, DB_VERSION, {
    // Migrações incrementais: cada versão só aplica o que mudou desde a anterior.
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta', { keyPath: 'id' });
        db.createObjectStore('data');
      }
      if (oldVersion < 2) {
        db.createObjectStore('stateMeta', { keyPath: 'id' }).createIndex('byRom', 'romId');
        db.createObjectStore('stateData');
      }
      // v3: a troca de capa saiu do app; apaga as capas guardadas por quem usou a v2.
      const raw = db as unknown as IDBDatabase;
      if (raw.objectStoreNames.contains(REMOVED_COVERS_STORE)) raw.deleteObjectStore(REMOVED_COVERS_STORE);
    },
  });
  return dbPromise;
}
