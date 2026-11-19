import { readGamepads } from '../adapters/input/gamepad';
import { KeyboardTracker } from '../adapters/input/keyboard';
import { mergePads, type PadState } from '../core/input/pad';

/**
 * Lê teclado + gamepads (+ fontes extras, como o touch) a cada frame e entrega o controle combinado.
 * Retorna a função que para o laço e remove os listeners.
 */
export function startInputLoop(
  onPad: (pad: PadState) => void,
  extraSources: (() => PadState)[] = [],
): () => void {
  const keyboard = new KeyboardTracker();
  let rafId = 0;
  const loop = () => {
    onPad(mergePads([...extraSources.map((read) => read()), readGamepads(), keyboard.read()]));
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(rafId);
    keyboard.dispose();
  };
}
