import { useEffect, useRef, useState } from 'preact/hooks';
import type { Emulator } from '../../adapters/emulator/types';
import { PeerJsHostTransport } from '../../adapters/net/peerjs';
import { createEmulator, gameName, type GameSource } from '../../app/host/gameSource';
import { HostSession } from '../../app/host/hostSession';
import { startInputLoop } from '../../app/inputLoop';
import type { Logger } from '../../app/logger';
import { config } from '../../config';
import { t } from '../strings';
import { LogPanel } from './LogPanel';
import { PlayersPanel } from './PlayersPanel';
import { RoomPanel } from './RoomPanel';
import { SavesPanel } from './SavesPanel';
import { VideoPanel } from './VideoPanel';

interface Running {
  readonly emulator: Emulator;
  readonly session: HostSession;
  readonly stream: MediaStream;
}

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

export function GameScreen({ source, logger }: { source: GameSource; logger: Logger }) {
  const container = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const [failed, setFailed] = useState(false);

  // Liga emulador → captura → sala → controles locais, e desliga tudo ao sair.
  useEffect(() => {
    const emulator = createEmulator(source);
    let session: HostSession | null = null;
    let stopInput: (() => void) | null = null;
    let disposed = false;

    (async () => {
      if (!container.current) return;
      logger.info(t.host.loading);
      await emulator.start(container.current);
      if (disposed) return;
      logger.success('Jogo iniciado');
      const stream = await emulator.captureStream(config.video.captureFps);
      if (stream.getAudioTracks().length === 0)
        logger.warn('Áudio do jogo não capturado: amigos vão ver sem som');
      const s = new HostSession({
        emulator,
        transport: new PeerJsHostTransport(),
        logger,
        hostName: t.host.hostName,
        randomBytes,
      });
      session = s;
      stopInput = startInputLoop((pad) => s.setLocalPad(pad));
      setRunning({ emulator, session: s, stream });
      await s.open(stream);
    })().catch((err: unknown) => {
      logger.error('Falha ao iniciar', err);
      setFailed(true);
    });

    return () => {
      disposed = true;
      stopInput?.();
      session?.close();
      emulator.destroy();
    };
  }, [source, logger]);

  // Avisos: aba em segundo plano pausa o jogo; fechar a aba derruba os amigos.
  useEffect(() => {
    if (!running) return;
    const abort = new AbortController();
    document.addEventListener('visibilitychange', () => document.hidden && logger.warn(t.host.keepVisible), {
      signal: abort.signal,
    });
    window.addEventListener(
      'beforeunload',
      (e) => {
        if (running.session.guestCount > 0) e.preventDefault();
      },
      { signal: abort.signal },
    );
    return () => abort.abort();
  }, [running, logger]);

  return (
    <div class="grid">
      <div class="stack">
        <section class="panel stack">
          <div class="row spread">
            <h2>{gameName(source)}</h2>
            {/* O EmulatorJS não pode ser reiniciado na mesma página: voltar = recarregar. */}
            <button onClick={() => location.reload()}>{t.host.backToLibrary}</button>
          </div>
          <div ref={container} class="screen" />
          {failed && <p class="err">{t.host.roomError}</p>}
          <p class="muted">{t.host.controlsHint}</p>
        </section>
        {running && <VideoPanel session={running.session} stream={running.stream} />}
      </div>
      <div class="stack">
        {running && <RoomPanel session={running.session} />}
        {running && <PlayersPanel session={running.session} />}
        {running && <SavesPanel saves={running.emulator.saves} gameName={gameName(source)} logger={logger} />}
        <LogPanel logger={logger} />
      </div>
    </div>
  );
}
