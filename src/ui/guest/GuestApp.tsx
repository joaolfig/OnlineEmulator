import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PeerJsGuestTransport } from '../../adapters/net/peerjs';
import { readPreference, writePreference } from '../../adapters/storage/preferences';
import { GuestSession } from '../../app/guest/guestSession';
import { startInputLoop } from '../../app/inputLoop';
import { isDebugEnabled, Logger } from '../../app/logger';
import { config } from '../../config';
import { isValidRoomCode, normalizeRoomCode } from '../../core/util/roomCode';
import { t } from '../strings';
import { createTouchState, readTouch, TouchControls } from './TouchControls';

const NAME_KEY = 'name';
const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

export function GuestApp() {
  const logger = useMemo(() => new Logger(isDebugEnabled()), []);
  const [session, setSession] = useState<GuestSession | null>(null);

  // Sai da sala ao fechar a página ou trocar de sessão.
  useEffect(() => () => session?.leave(), [session]);

  const join = (code: string, name: string) => {
    session?.leave();
    const s = new GuestSession({ transport: new PeerJsGuestTransport(), logger });
    setSession(s);
    void s.join(code, name);
  };

  const status = session?.status.value ?? 'idle';
  const inRoom = status === 'connected' || status === 'disconnected';
  return inRoom && session ? (
    <Stage session={session} onRejoin={() => location.reload()} />
  ) : (
    <JoinForm
      busy={status === 'connecting'}
      error={session?.error.value ? t.guest.errors[session.error.value] : null}
      onJoin={join}
    />
  );
}

interface JoinFormProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onJoin: (code: string, name: string) => void;
}

function JoinForm({ busy, error, onJoin }: JoinFormProps) {
  const [code, setCode] = useState(() =>
    normalizeRoomCode(new URLSearchParams(location.search).get('r') ?? ''),
  );
  const [name, setName] = useState(() => readPreference(NAME_KEY) ?? '');
  const [touched, setTouched] = useState(false);
  const valid = isValidRoomCode(normalizeRoomCode(code), config.roomCodeLength);

  const submit = (e: Event) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const finalName = name.trim().slice(0, config.maxNameLength) || 'Jogador';
    writePreference(NAME_KEY, finalName);
    onJoin(normalizeRoomCode(code), finalName);
  };

  return (
    <main class="page narrow">
      <form class="panel stack" onSubmit={submit}>
        <h1>{t.guest.title}</h1>
        <label class="field">
          {t.guest.roomCode}
          <input
            class="mono"
            value={code}
            maxLength={config.roomCodeLength}
            autocapitalize="characters"
            onInput={(e) => setCode(e.currentTarget.value)}
          />
        </label>
        <label class="field">
          {t.guest.name}
          <input
            value={name}
            maxLength={config.maxNameLength}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <button class="primary" type="submit" disabled={busy}>
          {busy ? t.guest.connecting : t.guest.join}
        </button>
        {touched && !valid && <p class="err">{t.guest.invalidCode}</p>}
        {error && <p class="err">{error}</p>}
        <p class="muted">{t.guest.controlsHint}</p>
      </form>
    </main>
  );
}

function Stage({ session, onRejoin }: { session: GuestSession; onRejoin: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const touch = useMemo(createTouchState, []);
  const stream = session.stream.value;
  const port = session.port.value;
  const showTouch = useMemo(isTouchDevice, []);

  useEffect(() => {
    const el = video.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    // O toque em "Entrar" libera o áudio; se o navegador bloquear mesmo assim, toca sem som.
    el.play().catch(() => {
      el.muted = true;
      void el.play();
    });
  }, [stream]);

  useEffect(
    () => startInputLoop((pad) => session.tick(pad), showTouch ? [() => readTouch(touch)] : []),
    [session, touch, showTouch],
  );

  const fullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.(
        'landscape',
      );
    } catch {
      // iOS não suporta tela cheia/travar orientação: segue sem.
    }
  };

  return (
    <div class="stage">
      <video ref={video} playsInline autoplay />
      {showTouch && <TouchControls state={touch} />}
      <div class="hud">
        <span class="pill" data-testid="who">
          {port === undefined ? t.guest.connecting : t.guest.you(port)}
        </span>
        <span class="pill mono">
          ping {session.rttMs.value ?? '?'} ms · {session.fps.value ?? '?'} fps
        </span>
        <span class="grow" />
        <button onClick={() => void fullscreen()} aria-label={t.guest.fullscreen}>
          ⛶
        </button>
      </div>
      {session.status.value === 'disconnected' && (
        <div class="overlay-message">
          <span>{t.guest.disconnected}</span>
          <button class="primary" onClick={onRejoin}>
            {t.guest.rejoin}
          </button>
        </div>
      )}
    </div>
  );
}
