// Ideia 2: mudar como cada pixel é desenhado (relevo com luz).

import type { Vector3 } from 'three';
import { AXIS_LIMIT } from '../../core/input/pad';
import { brightCentroid, damp } from '../math';
import { createReliefMaterial, createScreenStage, syncTexel } from './common';
import type { Experiment } from './types';

/** De onde vem a luz do relevo. Nenhuma opção depende do mouse: os jogos não usam mouse. */
const LIGHT = { bright: 0, stick: 1, orbit: 2, fixed: 3 } as const;

/** Miniatura usada para achar as partes mais claras do quadro. */
const SAMPLE_W = 32;
const SAMPLE_H = 24;
/** Sem nada brilhando na tela, a luz descansa no alto, um pouco à esquerda. */
const REST = { x: 0.3, y: 0.85 };

export const relief: Experiment = {
  id: 'relief',
  name: 'Relevo com luz (normal map automático)',
  idea: '2',
  summary:
    'Cada borda de contraste ganha sombra e brilho, como se os sprites fossem de plástico ou metal. A luz pode sair das partes claras do jogo, seguir o controle, girar sozinha ou ficar fixa.',
  caveat: 'Textos brancos também ganham relevo; com força alta a imagem fica "suja".',
  params: [
    {
      key: 'lightMode',
      label: 'De onde vem a luz',
      min: 0,
      max: 3,
      step: 1,
      value: LIGHT.bright,
      options: [
        { value: LIGHT.bright, label: 'Do brilho do jogo (fogo, lasers, explosões)' },
        { value: LIGHT.stick, label: 'Segue o controle (analógico)' },
        { value: LIGHT.orbit, label: 'Gira sozinha' },
        { value: LIGHT.fixed, label: 'Fixa (canto de cima)' },
      ],
    },
    { key: 'strength', label: 'Força do relevo', min: 0, max: 12, step: 0.5, value: 4 },
    { key: 'height', label: 'Altura da luz', min: 0.05, max: 1.5, step: 0.05, value: 0.35 },
    { key: 'specular', label: 'Brilho especular', min: 0, max: 2, step: 0.05, value: 0.3 },
    { key: 'ambient', label: 'Luz ambiente', min: 0, max: 1, step: 0.05, value: 0.55 },
  ],
  create(ctx) {
    const material = createReliefMaterial(ctx);
    const stage = createScreenStage(ctx, 40, material);
    const light = material.uniforms.light?.value as Vector3;
    const sample = document.createElement('canvas');
    sample.width = SAMPLE_W;
    sample.height = SAMPLE_H;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    let target = { ...REST };
    let time = 0;
    let frame = 0;

    return {
      update(dt, input) {
        time += dt;
        syncTexel(material, ctx.video);
        (material.uniforms.strength as { value: number }).value = ctx.params.strength ?? 4;
        (material.uniforms.specular as { value: number }).value = ctx.params.specular ?? 0.3;
        (material.uniforms.ambient as { value: number }).value = ctx.params.ambient ?? 0.55;
        light.z = ctx.params.height ?? 0.35;

        switch (ctx.params.lightMode ?? LIGHT.bright) {
          case LIGHT.bright:
            // A cada 4 quadros, procura as partes mais claras numa miniatura do jogo.
            if (sampleCtx && frame++ % 4 === 0 && ctx.video.readyState >= 2) {
              sampleCtx.drawImage(ctx.video, 0, 0, SAMPLE_W, SAMPLE_H);
              const data = sampleCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
              target = brightCentroid(data, SAMPLE_W, SAMPLE_H) ?? REST;
            }
            break;
          case LIGHT.stick:
            target = {
              x: 0.5 + (input.pad.x / AXIS_LIMIT) * 0.45,
              y: 0.5 - (input.pad.y / AXIS_LIMIT) * 0.45,
            };
            break;
          case LIGHT.orbit:
            target = { x: 0.5 + Math.cos(time * 0.5) * 0.45, y: 0.5 + Math.sin(time * 0.5) * 0.45 };
            break;
          default:
            target = { ...REST };
        }
        // Movimento suave: a luz "desliza" até o alvo em vez de pular.
        light.x = damp(light.x, target.x, 5, dt);
        light.y = damp(light.y, target.y, 5, dt);
      },
      render: () => ctx.renderer.render(stage.scene, stage.camera),
      resize: (w, h) => stage.resize(w, h),
      dispose: () => stage.dispose(),
    };
  },
};
