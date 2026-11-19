import { AXIS_LIMIT, buttonMask, type Button, type PadState } from './pad';

/**
 * Perfil de teclado. As teclas usam KeyboardEvent.code (posição física),
 * então o mesmo perfil funciona em teclado ABNT2, americano etc.
 */
export interface KeyboardProfile {
  readonly id: string;
  readonly name: string;
  readonly buttons: Readonly<Partial<Record<Button, readonly string[]>>>;
  readonly stick: Readonly<Record<'up' | 'down' | 'left' | 'right', readonly string[]>>;
  /** Segurar estas teclas inclina o analógico só até a metade. */
  readonly halfTilt: readonly string[];
}

export const DEFAULT_KEYBOARD_PROFILE: KeyboardProfile = {
  id: 'default',
  name: 'Padrão (WASD/setas)',
  buttons: {
    A: ['KeyK'],
    B: ['KeyJ'],
    Z: ['KeyL'],
    START: ['Enter'],
    L: ['KeyQ'],
    R: ['KeyE'],
    CUP: ['KeyT'],
    CDOWN: ['KeyG'],
    CLEFT: ['KeyF'],
    CRIGHT: ['KeyH'],
  },
  stick: {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  },
  halfTilt: ['ShiftLeft', 'ShiftRight'],
};

const anyDown = (keys: ReadonlySet<string>, codes: readonly string[] | undefined): boolean =>
  codes?.some((code) => keys.has(code)) ?? false;

/** Converte as teclas apertadas no estado do controle, segundo o perfil. */
export function padFromKeys(keys: ReadonlySet<string>, profile: KeyboardProfile): PadState {
  let buttons = 0;
  for (const [button, codes] of Object.entries(profile.buttons) as [Button, readonly string[]][]) {
    if (anyDown(keys, codes)) buttons |= buttonMask(button);
  }
  const dx = Number(anyDown(keys, profile.stick.right)) - Number(anyDown(keys, profile.stick.left));
  const dy = Number(anyDown(keys, profile.stick.down)) - Number(anyDown(keys, profile.stick.up));
  const force = anyDown(keys, profile.halfTilt) ? Math.round(AXIS_LIMIT / 2) : AXIS_LIMIT;
  return { buttons, x: dx * force, y: dy * force };
}

/** Todas as teclas usadas pelo perfil (para impedir o comportamento padrão do navegador nelas). */
export function profileKeys(profile: KeyboardProfile): Set<string> {
  return new Set([...Object.values(profile.buttons).flat(), ...Object.values(profile.stick).flat()]);
}
