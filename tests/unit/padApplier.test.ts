import { describe, expect, it } from 'vitest';
import { PadApplier } from '../../src/adapters/emulator/padApplier';
import { detectSystem } from '../../src/adapters/emulator/systems';
import { buttonMask } from '../../src/core/input/pad';

const setup = () => {
  const calls: [number, number, number][] = [];
  return { calls, applier: new PadApplier((port, index, value) => calls.push([port, index, value])) };
};

describe('PadApplier', () => {
  it('envia só o que mudou', () => {
    const { calls, applier } = setup();
    applier.apply(1, { buttons: buttonMask('A'), x: 0, y: 0 });
    expect(calls).toEqual([[1, 0, 1]]);
    calls.length = 0;
    applier.apply(1, { buttons: buttonMask('A'), x: 0, y: 0 });
    expect(calls).toEqual([]);
  });

  it('analógico vira dois eixos do EmulatorJS (um ligado, o oposto zerado)', () => {
    const { calls, applier } = setup();
    applier.apply(0, { buttons: 0, x: 127, y: -127 });
    expect(calls).toEqual([
      [0, 16, 0x7fff],
      [0, 17, 0],
      [0, 18, 0],
      [0, 19, 0x7fff],
    ]);
  });

  it('C-buttons são eixos analógicos no EmulatorJS', () => {
    const { calls, applier } = setup();
    applier.apply(2, { buttons: buttonMask('CUP'), x: 0, y: 0 });
    expect(calls).toEqual([[2, 23, 0x7fff]]);
  });

  it('release solta tudo que estava apertado', () => {
    const { calls, applier } = setup();
    applier.apply(3, { buttons: buttonMask('B') | buttonMask('START'), x: -64, y: 0 });
    calls.length = 0;
    applier.release(3);
    expect(calls).toEqual(
      expect.arrayContaining([
        [3, 1, 0],
        [3, 3, 0],
        [3, 16, 0],
        [3, 17, 0],
      ]),
    );
  });

  it('portas são independentes', () => {
    const { calls, applier } = setup();
    applier.apply(0, { buttons: buttonMask('A'), x: 0, y: 0 });
    applier.apply(1, { buttons: buttonMask('A'), x: 0, y: 0 });
    expect(calls).toEqual([
      [0, 0, 1],
      [1, 0, 1],
    ]);
  });
});

describe('PadApplier em consoles 2D (RetroPad)', () => {
  const setup2d = (system = detectSystem('jogo.sfc')) => {
    const calls: [number, number, number][] = [];
    if (!system) throw new Error('sistema não detectado');
    return { calls, applier: new PadApplier((p, i, v) => calls.push([p, i, v]), system.mapping) };
  };

  it('analógico vira direcional e A/B vão para os botões do RetroPad', () => {
    const { calls, applier } = setup2d();
    applier.apply(0, { buttons: buttonMask('A') | buttonMask('B'), x: 127, y: -127 });
    expect(calls).toEqual(
      expect.arrayContaining([
        [0, 8, 1], // A
        [0, 0, 1], // B
        [0, 4, 1], // ↑
        [0, 7, 1], // →
      ]),
    );
    // Nada vai para o analógico (índices 16+), que esses consoles não têm.
    expect(calls.some(([, index]) => index >= 16)).toBe(false);
  });

  it('inclinação pequena não aperta o direcional', () => {
    const { calls, applier } = setup2d();
    applier.apply(0, { buttons: 0, x: 30, y: 0 });
    expect(calls).toEqual([]);
  });
});

describe('detectSystem', () => {
  it.each([
    ['Mario Kart 64.z64', 'n64'],
    ['Zelda.SFC', 'snes'],
    ['Sonic.md', 'segaMD'],
    ['Pokemon.gbc', 'gb'],
    ['Metroid.gba', 'gba'],
  ])('%s → %s', (file, id) => expect(detectSystem(file)?.id).toBe(id));

  it('formato desconhecido', () => expect(detectSystem('foto.png')).toBeNull());
});
