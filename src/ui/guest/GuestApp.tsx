import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PeerJsGuestTransport } from '../../adapters/net/peerjs';
import { readPreference, writePreference } from '../../adapters/storage/preferences';
import { GuestSession } from '../../app/guest/guestSession';
import { startInputLoop } from '../../app/inputLoop';
import { isDebugEnabled, Logger } from '../../app/logger';
import { config } from '../../config';
import { DEVICE_MODES, type DeviceMode } from '../../core/room/room';
import { isValidRoomCode, normalizeRoomCode } from '../../core/util/roomCode';
import { EMPTY_PAD, type PadState } from '../../core/input/pad';
import { enterFullscreen, isTouchDevice } from '../shared/device';
import { EffectLayer } from '../shared/EffectLayer';
import { EffectToggles, useEffectsPreference } from '../shared/EffectPicker';
import { createTouchState, readTouch, TouchControls } from '../shared/TouchControls';
import { PORT_COLORS, t } from '../strings';

const NAME_KEY = 'name';
const MODE_KEY = 'mode';
const REWOUND_NOTICE_MS = 4000;
const isDeviceMode = (value: string | null): value is DeviceMode =>
  (DEVICE_MODES as readonly (string | null)[]).includes(value);

export function GuestApp() {
  const logger = useMemo(() => new Logger(isDebugEnabled()), []);
  const [session, setSession] = useState<GuestSession | null>(null);

  // Sai da sala ao fechar a página ou trocar de sessão.
  useEffect(() => () => session?.leave(), [session]);

  const join = (code: string, name: string, mode: DeviceMode) => {
    session?.leave();
    const s = new GuestSession({ transport: new PeerJsGuestTransport(), logger });
    setSession(s);
    void s.join(code, name, mode);
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
  readonly onJoin: (code: string, name: string, mode: DeviceMode) => void;
}

function JoinForm({ busy, error, onJoin }: JoinFormProps) {
  const [code, setCode] = useState(() =>
    normalizeRoomCode(new URLSearchParams(location.search).get('r') ?? ''),
  );
  const [name, setName] = useState(() => readPreference(NAME_KEY) ?? '');
  const [mode, setMode] = useState<DeviceMode>(() => {
    const saved = readPreference(MODE_KEY);
    return isDeviceMode(saved) ? saved : 'play';
  });
  const [touched, setTouched] = useState(false);
  const valid = isValidRoomCode(normalizeRoomCode(code), config.roomCodeLength);

  const submit = (e: Event) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const finalName = name.trim().slice(0, config.maxNameLength) || 'Jogador';
    writePreference(NAME_KEY, finalName);
    writePreference(MODE_KEY, mode);
    onJoin(normalizeRoomCode(code), finalName, mode);
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
        <fieldset class="mode-picker">
          <legend>{t.guest.modeQuestion}</legend>
          {DEVICE_MODES.map((m) => (
            <label key={m} class={`mode-option${mode === m ? ' selected' : ''}`}>
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              <span>
                <strong>{t.guest.modes[m].label}</strong>
                <span class="muted small">{t.guest.modes[m].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button class="primary" type="submit" disabled={busy}>
          {busy ? t.guest.connecting : t.guest.join}
        </button>
        {touched && !valid && <p class="err">{t.guest.invalidCode}</p>}
        {error && <p class="err">{error}</p>}
        {mode !== 'watch' && <p class="muted">{t.guest.controlsHint}</p>}
      </form>
    </main>
  );
}

function Stage({ session, onRejoin }: { session: GuestSession; onRejoin: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const touch = useMemo(createTouchState, []);
  const stream = session.stream.value;
  const port = session.port.value;
  const mode = session.mode;
  const isTouch = useMemo(isTouchDevice, []);
  const hasPort = typeof port === 'number';
  const showVideo = mode !== 'controller';
  const showTouch = isTouch && mode !== 'watch' && hasPort;
  const [effects, toggleEffect, clearEffects] = useEffectsPreference();
  const [showEffects, setShowEffects] = useState(false);
  const effectActive = showVideo && effects.length > 0;
  /** Último estado do controle deste aparelho, para o efeito visual reagir a ele. */
  const lastPad = useRef<PadState>(EMPTY_PAD);

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

  useEffect(() => {
    if (mode === 'watch') return;
    return startInputLoop(
      (pad) => {
        lastPad.current = pad;
        session.tick(pad);
      },
      isTouch ? [() => readTouch(touch)] : [],
    );
  }, [session, touch, isTouch, mode]);

  const fullscreen = () => enterFullscreen(document.documentElement);

  // Aviso de "voltar no tempo" aparece por alguns segundos.
  const rewound = session.rewound.value;
  const [showRewound, setShowRewound] = useState(false);
  useEffect(() => {
    if (!rewound) return;
    setShowRewound(true);
    const timer = setTimeout(() => setShowRewound(false), REWOUND_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [rewound]);

  const playerColor = hasPort ? PORT_COLORS[port % PORT_COLORS.length] : undefined;

  return (
    <div class={`stage${mode === 'controller' ? ' controller-mode' : ''}`}>
      {/* Com efeito ligado o vídeo continua tocando (é ele que tem o som), mas fica escondido sob o efeito. */}
      {showVideo && <video ref={video} playsInline autoplay class={effectActive ? 'under-effect' : ''} />}
      {showVideo && (
        <EffectLayer
          stream={stream}
          effects={effects}
          readPad={() => lastPad.current}
          onError={(err) => {
            console.error(t.effects.failed, err);
            clearEffects();
          }}
        />
      )}
      {mode === 'controller' && (
        <div class="player-badge" style={{ color: playerColor }} aria-hidden="true">
          {hasPort ? t.guest.playerBadge(port) : '…'}
        </div>
      )}
      {showTouch && (
        <TouchControls state={touch} large={mode === 'controller'} layout={session.layout.value} />
      )}
      <div class="hud">
        <span class="pill" data-testid="who" style={{ borderColor: playerColor }}>
          {port === undefined ? t.guest.connecting : t.guest.you(port)}
        </span>
        <span class="pill mono">
          ping {session.rttMs.value ?? '?'} ms{showVideo && ` · ${session.fps.value ?? '?'} fps`}
        </span>
        {session.speed.value > 1 && (
          <span class="pill" data-testid="speed">
            {t.guest.speed(session.speed.value)}
          </span>
        )}
        <span class="grow" />
        {showVideo && (
          <button
            class={effectActive ? 'primary' : ''}
            aria-expanded={showEffects}
            aria-label={t.effects.label}
            onClick={() => setShowEffects((v) => !v)}
          >
            ✨
          </button>
        )}
        <button onClick={() => void fullscreen()} aria-label={t.guest.fullscreen}>
          ⛶
        </button>
      </div>
      {showVideo && showEffects && (
        <div class="effects-panel">
          <EffectToggles effects={effects} onToggle={toggleEffect} />
        </div>
      )}
      {showRewound && rewound && <div class="toast">{t.guest.rewound(rewound.seconds)}</div>}
      {mode !== 'watch' && port === null && session.status.value === 'connected' && (
        <div class="overlay-message">{t.guest.waitingForPort}</div>
      )}
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
