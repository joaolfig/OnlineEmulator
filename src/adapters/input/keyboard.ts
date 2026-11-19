import {
  DEFAULT_KEYBOARD_PROFILE,
  padFromKeys,
  profileKeys,
  type KeyboardProfile,
} from '../../core/input/keyboard';
import type { PadState } from '../../core/input/pad';

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement;

/** Acompanha as teclas apertadas. Chame dispose() ao sair da tela para remover os listeners. */
export class KeyboardTracker {
  private readonly keys = new Set<string>();
  private readonly abort = new AbortController();
  private readonly handledKeys: Set<string>;

  constructor(private readonly profile: KeyboardProfile = DEFAULT_KEYBOARD_PROFILE) {
    this.handledKeys = profileKeys(profile);
    const { signal } = this.abort;
    window.addEventListener(
      'keydown',
      (e) => {
        if (isTypingTarget(e.target)) return;
        // Impede rolar a página com as setas, Enter ativar botões focados etc.
        if (this.handledKeys.has(e.code)) e.preventDefault();
        this.keys.add(e.code);
      },
      { signal },
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), { signal });
    // Soltar tudo ao perder o foco; senão uma tecla segurada durante um Alt+Tab fica "presa".
    window.addEventListener('blur', () => this.keys.clear(), { signal });
    document.addEventListener('visibilitychange', () => this.keys.clear(), { signal });
  }

  read(): PadState {
    return padFromKeys(this.keys, this.profile);
  }

  dispose(): void {
    this.abort.abort();
    this.keys.clear();
  }
}
