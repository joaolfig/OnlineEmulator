import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  requestPersistence,
  storageInfo,
  type RomLibrary,
  type RomMeta,
  type StorageInfo,
} from '../../adapters/storage/romLibrary';
import type { GameSource } from '../../app/host/gameSource';
import type { Logger } from '../../app/logger';
import { formatBytes, t } from '../strings';

interface Props {
  readonly library: RomLibrary;
  readonly logger: Logger;
  readonly onPlay: (source: GameSource) => void;
}

export function Library({ library, logger, onPlay }: Props) {
  const [roms, setRoms] = useState<RomMeta[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [list, info] = await Promise.all([library.list(), storageInfo()]);
    setRoms(list);
    setStorage(info);
  }, [library]);

  useEffect(() => {
    refresh().catch((err: unknown) => logger.error('Não foi possível ler a biblioteca', err));
  }, [refresh, logger]);

  const run = async (action: () => Promise<void>, errorMessage: string) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      logger.error(errorMessage, err);
    } finally {
      setBusy(false);
    }
  };

  const add = (file: File | undefined) =>
    file &&
    run(async () => {
      const isFirst = roms?.length === 0;
      const meta = await library.add(file);
      logger.success(`"${meta.name}" adicionado à biblioteca`);
      if (isFirst) await requestPersistence();
      await refresh();
    }, 'Não foi possível adicionar a ROM');

  const remove = (rom: RomMeta) =>
    confirm(t.library.confirmRemove(rom.name)) &&
    run(async () => {
      await library.remove(rom.id);
      await refresh();
    }, 'Não foi possível remover a ROM');

  const play = (rom: RomMeta) =>
    run(
      async () => onPlay({ kind: 'rom', file: await library.load(rom.id), name: rom.name }),
      'Não foi possível abrir a ROM',
    );

  const persist = () =>
    run(async () => {
      await requestPersistence();
      await refresh();
    }, 'Não foi possível proteger a biblioteca');

  return (
    <section class="panel stack" aria-busy={busy}>
      <div class="row spread">
        <h2>{t.library.title}</h2>
        <button class="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? t.library.adding : t.library.addRom}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".z64,.n64,.v64,.zip,.7z"
          hidden
          onChange={(e) => {
            void add(e.currentTarget.files?.[0]);
            e.currentTarget.value = '';
          }}
        />
      </div>

      {roms?.length === 0 && <p class="muted">{t.library.empty}</p>}
      {roms && roms.length > 0 && (
        <ul class="rom-list">
          {roms.map((rom) => (
            <li key={rom.id}>
              <span class="name" title={rom.fileName}>
                {rom.name}
              </span>
              <span class="muted">{formatBytes(rom.size)}</span>
              <button class="primary" disabled={busy} onClick={() => void play(rom)}>
                {t.library.play}
              </button>
              <button class="danger" disabled={busy} onClick={() => void remove(rom)}>
                {t.library.remove}
              </button>
            </li>
          ))}
        </ul>
      )}

      {storage && (
        <div class="row spread muted">
          {storage.usedBytes !== null && storage.quotaBytes !== null && (
            <span>
              {t.library.storageUsed(formatBytes(storage.usedBytes), formatBytes(storage.quotaBytes))}
            </span>
          )}
          {!storage.persisted && roms && roms.length > 0 && (
            <span class="row">
              <span class="warn">{t.library.notPersisted}</span>
              <button onClick={() => void persist()}>{t.library.persist}</button>
            </span>
          )}
        </div>
      )}

      <hr style="border:none;border-top:1px solid var(--border);width:100%" />
      <div class="row">
        <button onClick={() => onPlay({ kind: 'test' })}>{t.library.testMode}</button>
        <span class="muted">{t.library.testModeHint}</span>
      </div>
    </section>
  );
}
