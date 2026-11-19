// Leitura de teclado e gamepad → PadState. Usado pelo host e pelos convidados.
import { BUTTON_BITS } from './shared.js';

export const bit = (name) => 1 << BUTTON_BITS.indexOf(name);

// Teclado por posição física (KeyboardEvent.code), funciona igual em ABNT2 e US.
const KEYMAP = {
  KeyK: 'A', KeyJ: 'B', KeyL: 'Z', Enter: 'START', KeyQ: 'L', KeyE: 'R',
  KeyT: 'CUP', KeyG: 'CDOWN', KeyF: 'CLEFT', KeyH: 'CRIGHT',
};
const STICK_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const DEADZONE = 0.15;

const isTyping = (target) =>
  target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;

const keysDown = new Set();
addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return;
  if (KEYMAP[e.code] || STICK_KEYS[e.code]) e.preventDefault();
  keysDown.add(e.code);
});
addEventListener('keyup', (e) => keysDown.delete(e.code));
// Soltar tudo ao perder o foco, senão a tecla fica "presa".
addEventListener('blur', () => keysDown.clear());
document.addEventListener('visibilitychange', () => keysDown.clear());

export function readKeyboard(pad) {
  for (const code of keysDown) if (KEYMAP[code]) pad.buttons |= bit(KEYMAP[code]);
  let x = 0, y = 0;
  for (const code of keysDown) {
    if (STICK_KEYS[code]) {
      x += STICK_KEYS[code][0];
      y += STICK_KEYS[code][1];
    }
  }
  const force = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') ? 63 : 127;
  if (x || y) {
    pad.x = Math.sign(x) * force;
    pad.y = Math.sign(y) * force;
  }
}

// Gamepad por polling, mapeamento "standard" (Xbox/PlayStation).
export function readGamepads(pad) {
  for (const gp of navigator.getGamepads?.() ?? []) {
    if (!gp || gp.mapping !== 'standard') continue;
    const b = (i) => gp.buttons[i]?.pressed;
    if (b(0)) pad.buttons |= bit('A');
    if (b(2) || b(1)) pad.buttons |= bit('B');
    if (b(6) || b(7)) pad.buttons |= bit('Z');
    if (b(4)) pad.buttons |= bit('L');
    if (b(5)) pad.buttons |= bit('R');
    if (b(9)) pad.buttons |= bit('START');
    if (b(12)) pad.buttons |= bit('DUP');
    if (b(13)) pad.buttons |= bit('DDOWN');
    if (b(14)) pad.buttons |= bit('DLEFT');
    if (b(15)) pad.buttons |= bit('DRIGHT');
    const [ax = 0, ay = 0, cx = 0, cy = 0] = gp.axes;
    if (Math.hypot(ax, ay) > DEADZONE) {
      pad.x = Math.round(ax * 127);
      pad.y = Math.round(ay * 127);
    }
    if (cy < -0.5) pad.buttons |= bit('CUP');
    if (cy > 0.5) pad.buttons |= bit('CDOWN');
    if (cx < -0.5) pad.buttons |= bit('CLEFT');
    if (cx > 0.5) pad.buttons |= bit('CRIGHT');
  }
}
