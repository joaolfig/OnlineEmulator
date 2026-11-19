import { useMemo, useState } from 'preact/hooks';
import { RomLibrary } from '../../adapters/storage/romLibrary';
import { StateStore } from '../../adapters/storage/stateStore';
import type { GameSource } from '../../app/host/gameSource';
import { isDebugEnabled, Logger } from '../../app/logger';
import { config } from '../../config';
import { t } from '../strings';
import { GameScreen } from './GameScreen';
import { Library } from './Library';
import { LogPanel } from './LogPanel';

export function HostApp() {
  const logger = useMemo(() => new Logger(isDebugEnabled()), []);
  const library = useMemo(() => new RomLibrary(), []);
  const stateStore = useMemo(() => new StateStore(config.saves.autoStatesKept), []);
  const [source, setSource] = useState<GameSource | null>(null);

  return (
    <main class="page">
      <header class="row spread">
        <h1>
          <a href="./" class="plain-link">
            {t.appName}
          </a>
        </h1>
      </header>
      {source ? (
        <GameScreen source={source} stateStore={stateStore} logger={logger} />
      ) : (
        <div class="stack library-column">
          <Library library={library} stateStore={stateStore} logger={logger} onPlay={setSource} />
          <LogPanel logger={logger} />
        </div>
      )}
    </main>
  );
}
