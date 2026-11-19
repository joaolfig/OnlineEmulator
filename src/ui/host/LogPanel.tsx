import type { Logger } from '../../app/logger';
import { Collapsible } from '../shared/Collapsible';
import { isTouchDevice } from '../shared/device';
import { t } from '../strings';

export function LogPanel({ logger }: { logger: Logger }) {
  return (
    <Collapsible title={t.host.log} defaultOpen={!isTouchDevice()}>
      <ul class="log mono" aria-live="polite">
        {logger.entries.value.map((entry) => (
          <li key={entry.id} class={entry.level}>
            {new Date(entry.time).toLocaleTimeString('pt-BR')} {entry.message}
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}
