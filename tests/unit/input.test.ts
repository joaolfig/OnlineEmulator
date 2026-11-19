import { describe, expect, it } from 'vitest';
import { padFromGamepad } from '../../src/core/input/gamepad';
import { DEFAULT_KEYBOARD_PROFILE, padFromKeys } from '../../src/core/input/keyboard';
import { buttonMask, EMPTY_PAD, isPressed, mergePads } from '../../src/core/input/pad';

const keys = (...codes: string[]) => padFromKeys(new Set(codes), DEFAULT_KEYBOARD_PROFILE);

describe('padFromKeys', () => {
  it('nada apertado = controle neutro', () => {
    expect(keys()).toEqual(EMPTY_PAD);
  });

  it('mapeia botões pela posição física', () => {
    const pad = keys('KeyK', 'Enter');
    expect(isPressed(pad, 'A')).toBe(true);
    expect(isPressed(pad, 'START')).toBe(true);
    expect(isPressed(pad, 'B')).toBe(false);
  });

  it('analógico em diagonal, com meia força no Shift', () => {
    expect(keys('KeyD', 'KeyW')).toMatchObject({ x: 127, y: -127 });
    expect(keys('ArrowLeft', 'ShiftLeft')).toMatchObject({ x: -64, y: 0 });
  });

  it('direções opostas se anulam', () => {
    expect(keys('KeyA', 'KeyD')).toMatchObject({ x: 0 });
  });
});

describe('padFromGamepad', () => {
  const idle = { buttons: Array<boolean>(17).fill(false), axes: [0, 0, 0, 0] };

  it('ignora o analógico dentro da deadzone', () => {
    expect(padFromGamepad({ ...idle, axes: [0.1, -0.1, 0, 0] })).toEqual(EMPTY_PAD);
  });

  it('converte eixos e botões', () => {
    const buttons = [...idle.buttons];
    buttons[0] = true; // A
    buttons[7] = true; // gatilho direito → Z
    const pad = padFromGamepad({ buttons, axes: [1, -0.5, 0, 0.9] });
    expect(pad.x).toBe(127);
    expect(pad.y).toBe(-63); // Math.round(-63.5) arredonda para cima
    expect(pad.buttons).toBe(buttonMask('A') | buttonMask('Z') | buttonMask('CDOWN'));
  });
});

describe('mergePads', () => {
  it('soma botões e usa o primeiro analógico inclinado', () => {
    const merged = mergePads([
      { buttons: buttonMask('A'), x: 0, y: 0 },
      { buttons: buttonMask('B'), x: 50, y: 10 },
      { buttons: 0, x: -127, y: 0 },
    ]);
    expect(merged).toEqual({ buttons: buttonMask('A') | buttonMask('B'), x: 50, y: 10 });
  });
});
