// A "dica de ouro": juntar as duas ideias no mesmo plano 3D.

import type { Vector3 } from 'three';
import { damp, degToRad, tiltTarget } from '../math';
import { createBloom, createReliefMaterial, createScreenStage, SCREEN_HEIGHT, syncTexel } from './common';
import type { Experiment } from './types';

export const combo: Experiment = {
  id: 'combo',
  name: 'Combo: mesa + inclinação + relevo + bloom',
  idea: 'combo',
  summary:
    'As duas ideias juntas: tabuleiro deitado que reage ao controle, com relevo iluminado e brilho nas partes claras. A luz acompanha o seu personagem pela direção do analógico.',
  caveat: 'Mais pesado (relevo + bloom + 3D) e mais efeitos ao mesmo tempo podem cansar a vista.',
  params: [
    { key: 'angle', label: 'Inclinação da mesa (°)', min: 0, max: 50, step: 1, value: 22 },
    { key: 'maxTilt', label: 'Reação ao controle (°)', min: 0, max: 15, step: 1, value: 5 },
    { key: 'relief', label: 'Força do relevo', min: 0, max: 10, step: 0.5, value: 2.5 },
    { key: 'bloom', label: 'Bloom', min: 0, max: 2.5, step: 0.05, value: 0.8 },
  ],
  create(ctx) {
    const material = createReliefMaterial(ctx);
    const stage = createScreenStage(ctx, 45, material);
    const post = createBloom(ctx.renderer, stage.scene, stage.camera);
    post.bloom.threshold = 0.6;
    post.bloom.radius = 0.4;
    const light = material.uniforms.light?.value as Vector3;
    let yaw = 0;
    let pitch = 0;
    return {
      update(dt, input) {
        syncTexel(material, ctx.video);
        (material.uniforms.strength as { value: number }).value = ctx.params.relief ?? 2.5;
        post.bloom.strength = ctx.params.bloom ?? 0.8;
        const target = tiltTarget(input.pad, ctx.params.maxTilt ?? 5);
        yaw = damp(yaw, target.yaw, 6, dt);
        pitch = damp(pitch, target.pitch, 6, dt);
        const angle = ctx.params.angle ?? 22;
        stage.screen.rotation.set(-degToRad(angle) + degToRad(pitch), degToRad(yaw), 0);
        stage.screen.position.y = -Math.sin(degToRad(angle)) * SCREEN_HEIGHT * 0.1;
        // A luz se inclina para o lado do movimento, reforçando a sensação de direção.
        light.x = damp(light.x, 0.5 + (input.pad.x / 127) * 0.4 + input.pointer.x * 0.3, 4, dt);
        light.y = damp(light.y, 0.75 + input.pointer.y * 0.3, 4, dt);
      },
      render: () => post.composer.render(),
      resize(w, h) {
        stage.resize(w, h, 0.95);
        post.resize(w, h);
      },
      dispose() {
        post.dispose();
        stage.dispose();
      },
    };
  },
};
