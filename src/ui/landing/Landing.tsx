import { useState } from 'preact/hooks';
import { SYSTEMS } from '../../adapters/emulator/systems';
import { config } from '../../config';
import { isValidRoomCode, normalizeRoomCode } from '../../core/util/roomCode';
import { t } from '../strings';

export function Landing() {
  const [code, setCode] = useState('');
  const normalized = normalizeRoomCode(code);
  const valid = isValidRoomCode(normalized, config.roomCodeLength);

  const join = (e: Event) => {
    e.preventDefault();
    if (valid) location.href = `play.html?r=${normalized}`;
  };

  return (
    <main class="page narrow">
      <header class="stack">
        <h1>{t.appName}</h1>
        <p class="muted">{t.tagline}</p>
        <ul class="console-list" aria-label={t.consolesTitle}>
          {SYSTEMS.map((s) => (
            <li key={s.id}>
              {s.label}
              <span class="muted small"> · {t.landing.players(s.ports)}</span>
            </li>
          ))}
        </ul>
      </header>
      <section class="panel stack">
        <h2>{t.landing.createRoom}</h2>
        <p class="muted">{t.landing.createRoomHint}</p>
        <a class="button primary" href="host.html">
          {t.landing.createRoom}
        </a>
      </section>
      <form class="panel stack" onSubmit={join}>
        <h2>{t.landing.joinRoom}</h2>
        <div class="row">
          <input
            class="mono"
            value={code}
            maxLength={config.roomCodeLength}
            autocapitalize="characters"
            aria-label={t.guest.roomCode}
            placeholder={t.landing.codePlaceholder}
            onInput={(e) => setCode(e.currentTarget.value)}
          />
          <button class="primary" type="submit" disabled={!valid}>
            {t.landing.join}
          </button>
        </div>
      </form>
    </main>
  );
}
