import { useEffect, useRef, useState } from 'preact/hooks';
import { readPreference, writePreference } from '../../adapters/storage/preferences';
import { config } from '../../config';
import {
  AVATARS,
  findReaction,
  isAvatar,
  REACTIONS,
  type Avatar,
  type ReactionEvent,
  type ReactionId,
} from '../../core/social';
import { t } from '../strings';

const AVATAR_KEY = 'avatar';

/** Boneco escolhido neste aparelho, lembrado para a próxima vez. Sem escolha: um aleatório. */
export function useAvatarPreference(): [Avatar, (avatar: Avatar) => void] {
  const [avatar, setAvatar] = useState<Avatar>(() => {
    const saved = readPreference(AVATAR_KEY);
    return isAvatar(saved) ? saved : (AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? AVATARS[0]);
  });
  const choose = (value: Avatar) => {
    writePreference(AVATAR_KEY, value);
    setAvatar(value);
  };
  return [avatar, choose];
}

/** Grade de bonecos para escolher (tela de entrar do convidado). */
export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (avatar: Avatar) => void }) {
  return (
    <fieldset class="avatar-picker">
      <legend>{t.social.chooseAvatar}</legend>
      <div class="avatar-grid">
        {AVATARS.map((avatar) => (
          <button
            key={avatar}
            type="button"
            class={avatar === value ? 'selected' : ''}
            aria-pressed={avatar === value}
            aria-label={`${t.social.avatar} ${avatar}`}
            onClick={() => onChange(avatar)}
          >
            {avatar}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Lista curta de bonecos (para o host trocar o dele na tabela de jogadores). */
export function AvatarSelect({ value, onChange }: { value: Avatar; onChange: (avatar: Avatar) => void }) {
  return (
    <select
      class="avatar-select"
      aria-label={t.social.chooseAvatar}
      value={value}
      onChange={(e) => {
        const next = e.currentTarget.value;
        if (isAvatar(next)) onChange(next);
      }}
    >
      {AVATARS.map((avatar) => (
        <option key={avatar} value={avatar}>
          {avatar}
        </option>
      ))}
    </select>
  );
}

const OPEN_KEY = 'Backquote';
const DIGIT_CODES = REACTIONS.map((_, i) => `Digit${i + 1}`);

interface ReactionPickerProps {
  readonly onReact: (reaction: ReactionId) => void;
  /** "floating": botão solto no topo da tela (celular); "inline": botão discreto numa barra (PC). */
  readonly variant: 'floating' | 'inline';
}

/**
 * Botão de reações. No PC também abre com a tecla ` (acento, ao lado do 1), e as teclas 1–8
 * escolhem a reação enquanto o menu está aberto (sem atrapalhar os controles do jogo no resto do tempo).
 */
export function ReactionPicker({ onReact, variant }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const latest = useRef({ open, onReact });
  latest.current = { open, onReact };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const { open: isOpen, onReact: react } = latest.current;
      if (e.code === OPEN_KEY) {
        setOpen((v) => !v);
      } else if (isOpen && e.code === 'Escape') {
        setOpen(false);
      } else if (isOpen && DIGIT_CODES.includes(e.code)) {
        const reaction = REACTIONS[DIGIT_CODES.indexOf(e.code)];
        if (reaction) react(reaction.id);
        setOpen(false);
      } else {
        return;
      }
      // Fase de captura + stop: o emulador não vê as teclas usadas pelo menu de reações.
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  return (
    <div class={`reaction-picker ${variant}`}>
      <button
        type="button"
        class={`reaction-toggle${open ? ' primary' : ''}`}
        aria-expanded={open}
        aria-label={t.social.reactions}
        title={t.social.reactionsHint}
        onClick={() => setOpen((v) => !v)}
      >
        😀
      </button>
      {open && (
        <div class="reaction-menu" role="menu">
          {REACTIONS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onReact(r.id);
                setOpen(false);
              }}
            >
              <span class="reaction-emoji">{r.emoji}</span>
              <span class="reaction-text">{r.text}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Balões das reações recentes, com o boneco de quem mandou; cada um some depois de alguns segundos. */
export function ReactionFeed({ events }: { events: readonly ReactionEvent[] }) {
  const [visible, setVisible] = useState<readonly ReactionEvent[]>([]);
  const seen = useRef(new Set<number>());
  // Um timer por leva de reações; não são cancelados quando chegam outras (cada uma some no seu tempo).
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const fresh = events.filter((e) => !seen.current.has(e.key));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seen.current.add(e.key));
    setVisible((v) => [...v, ...fresh]);
    timers.current.push(
      setTimeout(() => setVisible((v) => v.filter((e) => !fresh.includes(e))), config.reactionVisibleMs),
    );
  }, [events]);

  if (visible.length === 0) return null;
  return (
    <ul class="reaction-feed" aria-live="polite">
      {visible.map((e) => {
        const reaction = findReaction(e.reaction);
        return (
          <li key={e.key} class="reaction-bubble">
            <span class="reaction-avatar">{e.avatar}</span>
            <span class="reaction-name">{e.name}</span>
            <span class="reaction-emoji">{reaction.emoji}</span>
            <span class="reaction-text">{reaction.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
