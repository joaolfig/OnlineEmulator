import { useState } from 'preact/hooks';
import type { HostSession } from '../../app/host/hostSession';
import type { RewindBuffer } from '../../app/host/rewindBuffer';
import { config } from '../../config';
import { formatBytes, t } from '../strings';

interface Props {
  readonly session: HostSession;
  readonly rewind: RewindBuffer | null;
}

/** Controles de tempo do host: acelerar e voltar no tempo. Afetam o jogo de todo mundo. */
export function TimePanel({ session, rewind }: Props) {
  const speed = session.speed.value;
  const times = rewind?.times.value ?? [];
  const [busy, setBusy] = useState(false);
  // Até onde dá para voltar: idade da foto mais antiga.
  const reachSeconds = times[0] === undefined ? 0 : (Date.now() - times[0]) / 1000;

  const goBack = async (seconds: number) => {
    if (!rewind) return;
    setBusy(true);
    if (await rewind.rewind(seconds)) session.notifyRewound(seconds);
    setBusy(false);
  };

  return (
    <section class="panel stack">
      <div class="row spread">
        <h2>{t.time.speed}</h2>
        <div class="segmented" role="group" aria-label={t.time.speed}>
          {config.speedOptions.map((value) => (
            <button
              key={value}
              class={speed === value ? 'primary' : ''}
              aria-pressed={speed === value}
              onClick={() => session.setSpeed(value)}
            >
              {value === 1 ? t.time.normal : `${value}x`}
            </button>
          ))}
        </div>
      </div>
      {speed > 1 && <p class="muted small">{t.time.speedHint}</p>}

      {rewind && (
        <>
          <div class="row spread">
            <h2>{t.time.rewind}</h2>
            <div class="row">
              {config.rewind.stepsSeconds.map((seconds) => (
                <button
                  key={seconds}
                  disabled={busy || reachSeconds < seconds}
                  title={reachSeconds < seconds ? t.time.notYet : undefined}
                  onClick={() => void goBack(seconds)}
                >
                  ⏪ {t.time.step(seconds)}
                </button>
              ))}
              {rewind.canUndo.value && (
                <button disabled={busy} onClick={() => void rewind.undoRewind()}>
                  ↩ {t.time.undo}
                </button>
              )}
            </div>
          </div>
          <p class="muted small">
            {t.time.rewindHint(Math.floor(reachSeconds), formatBytes(rewind.memoryBytes.value))}
          </p>
        </>
      )}
    </section>
  );
}
