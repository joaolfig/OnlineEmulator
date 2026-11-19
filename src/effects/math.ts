// Funções puras do laboratório de visual (testadas em tests/unit/lab.test.ts).

import { AXIS_LIMIT, isPressed, type PadState } from '../core/input/pad';

/**
 * Aproxima `current` de `target` de forma suave e independente do FPS
 * (amortecimento exponencial: quanto maior `lambda`, mais rápido).
 */
export function damp(current: number, target: number, lambda: number, dtSeconds: number): number {
  return target + (current - target) * Math.exp(-lambda * dtSeconds);
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Para onde a tela deve inclinar segundo o controle:
 * analógico para os lados gira no eixo Y; A (pulo) inclina para trás no eixo X.
 */
export function tiltTarget(pad: PadState, maxDegrees: number): { yaw: number; pitch: number } {
  const yaw = (pad.x / AXIS_LIMIT) * maxDegrees;
  const pitch = (isPressed(pad, 'A') ? -0.6 : 0) * maxDegrees + (pad.y / AXIS_LIMIT) * maxDegrees * 0.3;
  return { yaw, pitch };
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Cor média de pixels RGBA (ex.: uma miniatura do quadro), para a luz ambiente "Ambilight". */
export function averageColor(rgba: ArrayLike<number>): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  const count = Math.floor(rgba.length / 4);
  if (count === 0) return { r: 0, g: 0, b: 0 };
  for (let i = 0; i < count * 4; i += 4) {
    r += rgba[i] ?? 0;
    g += rgba[i + 1] ?? 0;
    b += rgba[i + 2] ?? 0;
  }
  return { r: r / count / 255, g: g / count / 255, b: b / count / 255 };
}

/**
 * Centro das partes mais claras da imagem (fogo, lasers, explosões), em coordenadas 0..1
 * com y para cima. O brilho é elevado à 4ª potência para que só o que brilha muito conte.
 * null se a imagem for quase toda escura.
 */
export function brightCentroid(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): { x: number; y: number } | null {
  let sumX = 0;
  let sumY = 0;
  let total = 0;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const lum = (0.2126 * (rgba[i] ?? 0) + 0.7152 * (rgba[i + 1] ?? 0) + 0.0722 * (rgba[i + 2] ?? 0)) / 255;
      const weight = lum ** 4;
      sumX += (px + 0.5) * weight;
      sumY += (py + 0.5) * weight;
      total += weight;
    }
  }
  const MIN_TOTAL = 0.05;
  if (total < MIN_TOTAL) return null;
  return { x: sumX / total / width, y: 1 - sumY / total / height };
}

/** Distância da câmera para um plano de altura `height` caber inteiro na vertical com o FOV dado. */
export function fitDistance(height: number, fovDegrees: number, margin = 1.08): number {
  return (height / 2 / Math.tan(degToRad(fovDegrees) / 2)) * margin;
}
