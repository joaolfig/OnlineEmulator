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
  /** Nome oficial no catálogo; null = não encontrado; undefined = ainda não verificado (entradas antigas). */
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
  covers: { key: string; value: Blob };
  stateMeta: { key: string; value: StateMeta; indexes: { byRom: string } };
  stateData: { key: string; value: Blob };
}

export type LibraryDb = IDBPDatabase<LibrarySchema>;

const DB_NAME = 'onlemu-library';
const DB_VERSION = 2;

let dbPromise: Promise<LibraryDb> | null = null;

export function openLibraryDb(): Promise<LibraryDb> {
  dbPromise ??= openDB<LibrarySchema>(DB_NAME, DB_VERSION, {
    // Migrações incrementais: quem já tinha a versão 1 ganha só os stores novos.
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta', { keyPath: 'id' });
        db.createObjectStore('data');
      }
      if (oldVersion < 2) {
        db.createObjectStore('covers');
        db.createObjectStore('stateMeta', { keyPath: 'id' }).createIndex('byRom', 'romId');
        db.createObjectStore('stateData');
      }
    },
  });
  return dbPromise;
}
