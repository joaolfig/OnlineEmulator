import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Emulator } from '../../adapters/emulator/types';
import { PeerJsHostTransport } from '../../adapters/net/peerjs';
import type { StateStore } from '../../adapters/storage/stateStore';
import { createEmulator, gameTitle, type GameSource } from '../../app/host/gameSource';
import { HostSession } from '../../app/host/hostSession';
import { SaveKeeper } from '../../app/host/saveKeeper';
import { startInputLoop } from '../../app/inputLoop';
import type { Logger } from '../../app/logger';
import { config } from '../../config';
import { enterFullscreen, exitFullscreen, isTouchDevice } from '../shared/device';
import { createTouchState, readTouch, TouchControls } from '../shared/TouchControls';
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
  readonly keeper: SaveKeeper | null;
}

interface Props {
  readonly source: GameSource;
  readonly stateStore: StateStore;
  readonly logger: Logger;
}

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

export function GameScreen({ source, stateStore, logger }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const isTouch = useMemo(isTouchDevice, []);
  const touch = useMemo(createTouchState, []);
  const [fullscreen, setFullscreen] = useState(false);
  const [running, setRunning] = useState<Running | null>(null);
  const [failed, setFailed] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Liga emulador → (continua o estado salvo) → saves automáticos → captura → sala → controles locais.
  useEffect(() => {
    const emulator = createEmulator(source);
    let session: HostSession | null = null;
    let keeper: SaveKeeper | null = null;
    let stopInput: (() => void) | null = null;
    let disposed = false;

    (async () => {
      if (!container.current) return;
      logger.info(t.host.loading);
      await emulator.start(container.current);
      if (disposed) return;
      logger.success('Jogo iniciado');

      const saves = emulator.saves;
      if (source.kind === 'rom' && saves) {
        if (source.resumeStateId) {
          logger.info(t.host.resuming);
          saves.importState(await stateStore.load(source.resumeStateId));
        }
        keeper = new SaveKeeper({
          saves,
          stateStore,
          romId: source.romId,
          emulatorVersion: config.ejsVersion,
          logger,
          cartridgeFlushIntervalMs: config.saves.cartridgeFlushIntervalMs,
          autoStateIntervalMs: config.saves.autoStateIntervalMs,
        });
        keeper.start();
      }

      const stream = await emulator.captureStream(config.video.captureFps);
      if (stream.getAudioTracks().length === 0) {
        logger.warn('Áudio do jogo não capturado: amigos vão ver sem som');
      }
      const s = new HostSession({
        emulator,
        transport: new PeerJsHostTransport(),
        logger,
        hostName: t.host.hostName,
        randomBytes,
      });
      session = s;
      // No celular, o host joga pelos mesmos controles touch do convidado.
      stopInput = startInputLoop((pad) => s.setLocalPad(pad), isTouch ? [() => readTouch(touch)] : []);
      setRunning({ emulator, session: s, stream, keeper });
      await s.open(stream);
    })().catch((err: unknown) => {
      logger.error('Falha ao iniciar', err);
      setFailed(true);
    });

    return () => {
      disposed = true;
      stopInput?.();
      keeper?.stop();
      session?.close();
      emulator.destroy();
    };
  }, [source, stateStore, logger, isTouch, touch]);

  // Aba em segundo plano: avisa (o jogo pausa para todos) e salva tudo, por garantia.
  // Fechar a aba com amigos conectados: pede confirmação.
  useEffect(() => {
    if (!running) return;
    const abort = new AbortController();
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) return;
        logger.warn(t.host.keepVisible);
        void running.keeper?.saveAll();
      },
      { signal: abort.signal },
    );
    window.addEventListener(
      'beforeunload',
      (e) => {
        if (running.session.guestCount > 0) e.preventDefault();
      },
      { signal: abort.signal },
    );
    return () => abort.abort();
  }, [running, logger]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggleFullscreen = () =>
    fullscreen ? exitFullscreen() : stage.current && enterFullscreen(stage.current);

  // O EmulatorJS não pode ser reiniciado na mesma página: voltar à biblioteca = recarregar.
  const exit = async () => {
    setExiting(true);
    await exitFullscreen();
    await running?.keeper?.saveAll();
    location.reload();
  };

  return (
    <div class="grid">
      <div class="stack">
        <section class="panel stack">
          <div class="row spread">
            <h2>{gameTitle(source)}</h2>
            <button class={running?.keeper ? 'primary' : ''} disabled={exiting} onClick={() => void exit()}>
              {exiting ? t.host.saving : running?.keeper ? t.host.saveAndExit : t.host.backToLibrary}
            </button>
          </div>
          {isTouch && source.kind === 'rom' && <p class="warn small">{t.host.phoneHostWarning}</p>}
          <div ref={stage} class="host-stage">
            <div ref={container} class="screen" />
            {/* Controles na tela só em tela cheia: em pé, o jogo fica pequeno demais para dividir espaço. */}
            {isTouch && fullscreen && <TouchControls state={touch} />}
            <button
              class="stage-fullscreen"
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? t.host.exitFullscreen : t.host.fullscreen}
            >
              {fullscreen ? '✕' : '⛶'}
            </button>
          </div>
          {failed && <p class="err">{t.host.roomError}</p>}
          <p class="muted">{isTouch ? t.host.touchHint : t.host.controlsHint}</p>
        </section>
        {running && <VideoPanel session={running.session} stream={running.stream} />}
      </div>
      <div class="stack">
        {running && <RoomPanel session={running.session} />}
        {running && <PlayersPanel session={running.session} />}
        {running && (
          <SavesPanel
            saves={running.emulator.saves}
            keeper={running.keeper}
            fileBaseName={gameTitle(source)}
            logger={logger}
          />
        )}
        <LogPanel logger={logger} />
      </div>
    </div>
  );
}
