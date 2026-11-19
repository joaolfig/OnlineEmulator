import { useRef } from 'preact/hooks';
import type { EmulatorSaves } from '../../adapters/emulator/types';
import { datedFileName, readFileBytes, saveFile } from '../../adapters/storage/files';
import type { Logger } from '../../app/logger';
import { t } from '../strings';

interface Props {
  readonly saves: EmulatorSaves | null;
  readonly gameName: string;
  readonly logger: Logger;
}

export function SavesPanel({ saves, gameName, logger }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const importAction = useRef<((data: Uint8Array) => void) | null>(null);

  if (!saves) {
    return (
      <section class="panel">
        <h2>{t.host.saves}</h2>
        <p class="muted">{t.host.savesUnavailable}</p>
      </section>
    );
  }

  const attempt = async (action: () => Promise<void> | void, errorMessage: string) => {
    try {
      await action();
    } catch (err) {
      logger.error(errorMessage, err);
    }
  };

  const pickAndImport = (apply: (data: Uint8Array) => void) => {
    importAction.current = apply;
    fileInput.current?.click();
  };

  return (
    <section class="panel stack">
      <h2>{t.host.saves}</h2>
      <div class="row">
        <button
          onClick={() =>
            void attempt(async () => {
              const data = saves.exportSave();
              if (!data) return logger.warn(t.host.noSaveYet);
              await saveFile(data, datedFileName(gameName, saves.saveExtension));
            }, 'Não foi possível baixar o save')
          }
        >
          ⬇ {t.host.exportSave}
        </button>
        <button onClick={() => pickAndImport((data) => saves.importSave(data))}>⬆ {t.host.importSave}</button>
        <button
          onClick={() =>
            void attempt(
              () => saveFile(saves.exportState(), datedFileName(gameName, 'state')),
              'Não foi possível baixar o savestate',
            )
          }
        >
          ⬇ {t.host.exportState}
        </button>
        <button onClick={() => pickAndImport((data) => saves.importState(data))}>
          ⬆ {t.host.importState}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          const apply = importAction.current;
          if (!file || !apply) return;
          void attempt(async () => {
            apply(await readFileBytes(file));
            logger.success(`${file.name} carregado`);
          }, 'Não foi possível importar o arquivo');
        }}
      />
    </section>
  );
}
