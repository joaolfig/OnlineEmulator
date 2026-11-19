import type { HostSession } from '../../app/host/hostSession';
import type { Port } from '../../core/room/room';
import { t } from '../strings';

const SPECTATOR = 'spectator';
const portToValue = (port: Port): string => (port === null ? SPECTATOR : String(port));
const valueToPort = (value: string): Port => (value === SPECTATOR ? null : Number(value));

export function PlayersPanel({ session }: { session: HostSession }) {
  const room = session.room.value;
  const stats = session.stats.value;

  return (
    <section class="panel">
      <h2>{t.host.players}</h2>
      <table>
        <thead>
          <tr>
            <th>Porta</th>
            <th>Nome</th>
            <th>Ping</th>
            <th>Vídeo</th>
          </tr>
        </thead>
        <tbody data-testid="players">
          {room.participants.map((p) => {
            const s = stats.get(p.id);
            return (
              <tr key={p.id}>
                <td>
                  <select
                    aria-label={`Porta de ${p.name}`}
                    value={portToValue(p.port)}
                    onChange={(e) => session.setPort(p.id, valueToPort(e.currentTarget.value))}
                  >
                    {Array.from({ length: room.portCount }, (_, i) => (
                      <option key={i} value={String(i)}>
                        P{i + 1}
                      </option>
                    ))}
                    <option value={SPECTATOR}>{t.host.spectator}</option>
                  </select>
                </td>
                <td>{p.isHost ? t.host.hostName : p.name}</td>
                <td>{s?.rttMs != null ? `${s.rttMs} ms` : '—'}</td>
                <td>{s?.kbps != null ? `${s.kbps} kbps · ${s.fps ?? '?'} fps` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="muted">{t.host.portHint}</p>
    </section>
  );
}
