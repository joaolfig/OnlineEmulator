import { useState } from 'preact/hooks';
import { readPreference, writePreference } from '../../adapters/storage/preferences';
import {
  EFFECT_IDS,
  parseEffects,
  serializeEffects,
  toggleEffect,
  type EffectId,
  type EffectSet,
} from '../../effects/catalog';
import { t } from '../strings';

const EFFECTS_KEY = 'effects';

/** Efeitos ligados neste aparelho, lembrados para a próxima vez. Padrão: nenhum. */
export function useEffectsPreference(): [EffectSet, (id: EffectId) => void, () => void] {
  const [effects, setEffects] = useState<EffectSet>(() => parseEffects(readPreference(EFFECTS_KEY)));
  const save = (next: EffectSet) => {
    writePreference(EFFECTS_KEY, serializeEffects(next));
    setEffects(next);
  };
  return [effects, (id) => save(toggleEffect(effects, id)), () => save([])];
}

interface Props {
  readonly effects: EffectSet;
  readonly onToggle: (id: EffectId) => void;
}

/** Chaves liga/desliga dos efeitos visuais (dá para ligar vários). */
export function EffectToggles({ effects, onToggle }: Props) {
  return (
    <div class="effect-toggles" role="group" aria-label={t.effects.label} title={t.effects.hint}>
      <span class="effect-toggles-label">✨ {t.effects.label}</span>
      {EFFECT_IDS.map((id) => {
        const on = effects.includes(id);
        return (
          <button
            key={id}
            type="button"
            class={on ? 'primary' : ''}
            aria-pressed={on}
            onClick={() => onToggle(id)}
          >
            {t.effects.names[id]}
          </button>
        );
      })}
    </div>
  );
}
