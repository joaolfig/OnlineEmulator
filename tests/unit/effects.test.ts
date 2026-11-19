import { describe, expect, it } from 'vitest';
import { buttonMask } from '../../src/core/input/pad';
import { averageColor, brightCentroid, damp, fitDistance, tiltTarget } from '../../src/effects/math';

describe('efeitos visuais: matemática', () => {
  it('damp se aproxima do alvo sem passar dele, e mais rápido com lambda maior', () => {
    const slow = damp(0, 10, 2, 0.1);
    const fast = damp(0, 10, 20, 0.1);
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThan(10);
    expect(damp(5, 5, 6, 1)).toBe(5);
  });

  it('damp não depende do FPS: dois passos de 0,05 s = um passo de 0,1 s', () => {
    const twoSteps = damp(damp(0, 10, 6, 0.05), 10, 6, 0.05);
    expect(twoSteps).toBeCloseTo(damp(0, 10, 6, 0.1), 10);
  });

  it('inclinação segue o analógico e o pulo', () => {
    expect(tiltTarget({ buttons: 0, x: 127, y: 0 }, 8)).toEqual({ yaw: 8, pitch: 0 });
    expect(tiltTarget({ buttons: 0, x: -127, y: 0 }, 8).yaw).toBe(-8);
    expect(tiltTarget({ buttons: buttonMask('A'), x: 0, y: 0 }, 10).pitch).toBeCloseTo(-6);
  });

  it('cor média de pixels RGBA', () => {
    const red = [255, 0, 0, 255];
    const blue = [0, 0, 255, 255];
    expect(averageColor([...red, ...blue])).toEqual({ r: 0.5, g: 0, b: 0.5 });
    expect(averageColor([])).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('distância da câmera aumenta com FOV menor', () => {
    expect(fitDistance(3, 30)).toBeGreaterThan(fitDistance(3, 60));
  });

  it('acha o centro das partes mais claras (de onde sai a luz do relevo)', () => {
    // Imagem 4×2 escura com um pixel branco no canto superior direito.
    const pixels = new Array(4 * 2 * 4).fill(0);
    pixels.splice(3 * 4, 3, 255, 255, 255);
    const c = brightCentroid(pixels, 4, 2);
    expect(c?.x).toBeCloseTo(3.5 / 4);
    expect(c?.y).toBeCloseTo(1 - 0.5 / 2);
    expect(brightCentroid(new Array(4 * 2 * 4).fill(0), 4, 2)).toBeNull();
  });
});
