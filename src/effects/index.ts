import type { PadState } from '../core/input/pad';
import type { EffectSet } from './catalog';
import { createComposite } from './composite';
import { EffectStage } from './stage';
import type { Experiment } from './types';

/**
 * Liga os efeitos escolhidos sobre o vídeo do jogo, desenhando dentro de `container`.
 * Ponto de entrada carregado sob demanda (import dinâmico): o three.js só é baixado
 * quando alguém liga um efeito.
 *
 * Retorna na hora a função que desliga tudo (sem esperar o vídeo começar), para que
 * trocar os efeitos rápido nunca deixe dois desenhos ao mesmo tempo.
 */
export function mountEffect(
  container: HTMLElement,
  stream: MediaStream,
  effects: EffectSet,
  readPad: () => PadState,
  onError: (error: unknown) => void,
): () => void {
  const combined: Experiment = {
    id: effects.join('+'),
    name: effects.join(' + '),
    idea: 'combo',
    summary: '',
    caveat: '',
    params: [],
    create: (ctx) =>
      createComposite(ctx, {
        tilt: effects.includes('tilt'),
        crt: effects.includes('crt'),
        relief: effects.includes('relief'),
      }),
  };
  const stage = new EffectStage(container);
  stage.setPadSource(readPad);
  stage.setExperiment(combined, {});
  stage.setSource(stream).catch((err: unknown) => {
    // Interromper o vídeo ao desligar o efeito é esperado, não é erro.
    if (!(err instanceof DOMException && err.name === 'AbortError')) onError(err);
  });
  stage.start();
  return () => stage.dispose();
}
