import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  requestPersistence,
  storageInfo,
  type RomLibrary,
  type RomMeta,
  type StorageInfo,
} from '../../adapters/storage/romLibrary';
import type { StateMeta, StateStore } from '../../adapters/storage/stateStore';
import type { GameSource } from '../../app/host/gameSource';
import type { Logger } from '../../app/logger';
import { config } from '../../config';
import { splitGameName } from '../../core/catalog/thumbnails';
import { formatBytes, formatDateTime, t } from '../strings';
import { Cover } from './Cover';

interface Props {
  readonly library: RomLibrary;
  readonly stateStore: StateStore;
  readonly logger: Logger;
  readonly onPlay: (source: GameSource) => void;
}

interface Entry {
  readonly rom: RomMeta;
  readonly states: StateMeta[];
  readonly cover: Blob | undefined;
}

const displayName = (rom: RomMeta) => splitGameName(rom.catalogName ?? rom.name);

export function Library({ library, stateStore, logger, onPlay }: Props) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const romInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [roms, info] = await Promise.all([library.list(), storageInfo()]);
    const loaded = await Promise.all(
      roms.map(async (rom) => ({
        rom,
        states: await stateStore.list(rom.id),
        cover: await library.getCover(rom.id),
      })),
    );
    setEntries(loaded);
    setStorage(info);
  }, [library, stateStore]);

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
      const isFirst = entries?.length === 0;
      const meta = await library.add(file);
      logger.success(`"${displayName(meta).title}" adicionado à biblioteca`);
      if (meta.catalogName === null) logger.info(`${t.library.notInCatalog}: ${meta.fileName}`);
      if (isFirst) await requestPersistence();
      await refresh();
    }, 'Não foi possível adicionar a ROM');

  const play = (rom: RomMeta, resumeStateId: string | null) =>
    run(async () => {
      const file = await library.load(rom.id);
      onPlay({
        kind: 'rom',
        romId: rom.id,
        file,
        name: rom.name,
        title: displayName(rom).title,
        resumeStateId,
      });
    }, 'Não foi possível abrir a ROM');

  const persist = () =>
    run(async () => {
      await requestPersistence();
      await refresh();
    }, 'Não foi possível proteger a biblioteca');

  return (
    <section class="panel stack" aria-busy={busy}>
      <div class="row spread">
        <h2>{t.library.title}</h2>
        <button class="primary" disabled={busy} onClick={() => romInput.current?.click()}>
          {busy ? t.library.adding : t.library.addRom}
        </button>
        <input
          ref={romInput}
          type="file"
          accept=".z64,.n64,.v64,.zip,.7z"
          hidden
          onChange={(e) => {
            void add(e.currentTarget.files?.[0]);
            e.currentTarget.value = '';
          }}
        />
      </div>

      {entries?.length === 0 && <p class="muted">{t.library.empty}</p>}
      {entries && entries.length > 0 && (
        <ul class="rom-grid">
          {entries.map((entry) => (
            <GameCard
              key={entry.rom.id}
              entry={entry}
              busy={busy}
              onPlay={(stateId) => void play(entry.rom, stateId)}
              onSetCover={(image) =>
                void run(async () => {
                  await library.setCover(entry.rom.id, image);
                  await refresh();
                }, 'Não foi possível trocar a capa')
              }
              onResetCover={() =>
                void run(async () => {
                  await library.removeCover(entry.rom.id);
                  await refresh();
                }, 'Não foi possível restaurar a capa')
              }
              onRemove={() =>
                confirm(t.library.confirmRemove(displayName(entry.rom).title)) &&
                void run(async () => {
                  await library.remove(entry.rom.id);
                  await refresh();
                }, 'Não foi possível remover a ROM')
              }
            />
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
          {!storage.persisted && entries && entries.length > 0 && (
            <span class="row">
              <span class="warn">{t.library.notPersisted}</span>
              <button onClick={() => void persist()}>{t.library.persist}</button>
            </span>
          )}
        </div>
      )}

      <hr class="divider" />
      <div class="row">
        <button onClick={() => onPlay({ kind: 'test' })}>{t.library.testMode}</button>
        <span class="muted">{t.library.testModeHint}</span>
      </div>
      <p class="muted small">{t.library.credits}</p>
    </section>
  );
}

interface GameCardProps {
  readonly entry: Entry;
  readonly busy: boolean;
  readonly onPlay: (resumeStateId: string | null) => void;
  readonly onSetCover: (image: File) => void;
  readonly onResetCover: () => void;
  readonly onRemove: () => void;
}

function GameCard({ entry, busy, onPlay, onSetCover, onResetCover, onRemove }: GameCardProps) {
  const { rom, states, cover } = entry;
  const { title, tags } = displayName(rom);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const state = states.find((s) => s.id === selectedState) ?? states[0];

  return (
    <li class="game-card">
      <Cover title={title} catalogName={rom.catalogName} custom={cover} />
      <div class="game-info stack">
        <div>
          <div class="game-title" title={rom.fileName}>
            {title}
          </div>
          <div class="muted small">
            {[tags, formatBytes(rom.size)].filter(Boolean).join(' · ')}
            {rom.catalogName === null && ` · ${t.library.notInCatalog}`}
          </div>
        </div>

        {state ? (
          <div class="stack tight">
            <button class="primary" disabled={busy} onClick={() => onPlay(state.id)}>
              ▶ {t.library.resume}
            </button>
            {states.length > 1 ? (
              <select
                aria-label={t.library.olderStates}
                value={state.id}
                onChange={(e) => setSelectedState(e.currentTarget.value)}
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t.library.savedAt(formatDateTime(s.createdAt))}
                  </option>
                ))}
              </select>
            ) : (
              <span class="muted small">{t.library.savedAt(formatDateTime(state.createdAt))}</span>
            )}
            {state.emulatorVersion !== config.ejsVersion && (
              <span class="warn small">{t.library.stateFromOtherVersion}</span>
            )}
            <button disabled={busy} onClick={() => onPlay(null)}>
              {t.library.playFromStart}
            </button>
          </div>
        ) : (
          <button class="primary" disabled={busy} onClick={() => onPlay(null)}>
            ▶ {t.library.play}
          </button>
        )}

        <div class="row small-buttons">
          <button disabled={busy} onClick={() => coverInput.current?.click()}>
            {t.library.changeCover}
          </button>
          {cover && (
            <button disabled={busy} onClick={onResetCover}>
              {t.library.defaultCover}
            </button>
          )}
          <button class="danger" disabled={busy} onClick={onRemove}>
            {t.library.remove}
          </button>
        </div>
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) onSetCover(file);
          }}
        />
      </div>
    </li>
  );
}
