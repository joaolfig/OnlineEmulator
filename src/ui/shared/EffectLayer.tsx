import { useEffect, useRef } from 'preact/hooks';
import type { PadState } from '../../core/input/pad';
import { serializeEffects, type EffectSet } from '../../effects/catalog';

interface Props {
  readonly stream: MediaStream | null;
  readonly effects: EffectSet;
  /** Controle atual deste aparelho (a inclinação reage a ele). */
  readonly readPad: () => PadState;
  readonly onError: (error: unknown) => void;
}

/**
 * Desenha os efeitos visuais ligados por cima da imagem do jogo. Só existe neste aparelho:
 * não muda o jogo nem o que os outros veem. O código 3D é baixado só quando algum efeito é ligado.
 */
export function EffectLayer({ stream, effects, readPad, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  // Sempre a versão mais recente das funções, sem recriar o efeito a cada render.
  const latest = useRef({ readPad, onError, effects });
  latest.current = { readPad, onError, effects };
  // Texto estável ("tilt,crt") para o efeito só ser refeito quando a combinação realmente mudar.
  const key = serializeEffects(effects);

  useEffect(() => {
    const el = container.current;
    if (key === '' || !stream || !el) return;
    let dispose: (() => void) | null = null;
    let cancelled = false;
    import('../../effects')
      .then(({ mountEffect }) => {
        // Se os efeitos mudaram enquanto o código baixava, não liga nada.
        if (cancelled) return;
        dispose = mountEffect(
          el,
          stream,
          latest.current.effects,
          () => latest.current.readPad(),
          (err) => latest.current.onError(err),
        );
      })
      .catch((err: unknown) => latest.current.onError(err));
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [key, stream]);

  if (key === '') return null;
  return <div ref={container} class="effect-layer" aria-hidden="true" data-testid="effect-layer" />;
}
