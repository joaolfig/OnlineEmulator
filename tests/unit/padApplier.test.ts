import { describe, expect, it } from 'vitest';
import { PadApplier } from '../../src/adapters/emulator/padApplier';
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
