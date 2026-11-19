import { useMemo, useState } from 'preact/hooks';
import { RomLibrary } from '../../adapters/storage/romLibrary';
import type { GameSource } from '../../app/host/gameSource';
import { isDebugEnabled, Logger } from '../../app/logger';
import { t } from '../strings';
import { GameScreen } from './GameScreen';
import { Library } from './Library';
import { LogPanel } from './LogPanel';

export function HostApp() {
  const logger = useMemo(() => new Logger(isDebugEnabled()), []);
  const library = useMemo(() => new RomLibrary(), []);
  const [source, setSource] = useState<GameSource | null>(null);

  return (
    <main class="page">
      <header class="row spread">
        <h1>
          <a href="./" style="color:inherit;text-decoration:none">
            {t.appName}
          </a>
        </h1>
      </header>
      {source ? (
        <GameScreen source={source} logger={logger} />
      ) : (
        <div class="stack narrow" style="width:100%;max-width:720px">
          <Library library={library} logger={logger} onPlay={setSource} />
          <LogPanel logger={logger} />
        </div>
      )}
    </main>
  );
}
