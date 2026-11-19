import type { Logger } from '../../app/logger';
import { t } from '../strings';

export function LogPanel({ logger }: { logger: Logger }) {
  return (
    <section class="panel">
      <h2>{t.host.log}</h2>
      <ul class="log mono" aria-live="polite">
        {logger.entries.value.map((entry) => (
          <li key={entry.id} class={entry.level}>
            {new Date(entry.time).toLocaleTimeString('pt-BR')} {entry.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
