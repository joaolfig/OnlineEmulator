// Ideia 2: mudar como cada pixel é desenhado (relevo, extrusão, brilho).

import { PlaneGeometry, ShaderMaterial, type Vector3 } from 'three';
import { degToRad, damp } from '../math';
import {
  createBloom,
  createReliefMaterial,
  createScreenStage,
  SAMPLE_VIDEO_GLSL,
  SCREEN_HEIGHT,
  syncTexel,
} from './common';
import type { Experiment } from './types';

export const relief: Experiment = {
  id: 'relief',
  name: 'Relevo com luz (normal map automático)',
  idea: '2',
  summary:
    'Cada borda de contraste ganha sombra e brilho, como se os sprites fossem de plástico ou metal. Mova o mouse (ou o dedo) sobre a tela para mover a luz.',
  caveat: 'Textos brancos também ganham relevo; com força alta a imagem fica "suja".',
  params: [
    { key: 'strength', label: 'Força do relevo', min: 0, max: 12, step: 0.5, value: 4 },
    { key: 'height', label: 'Altura da luz', min: 0.05, max: 1.5, step: 0.05, value: 0.35 },
    { key: 'specular', label: 'Brilho especular', min: 0, max: 2, step: 0.05, value: 0.3 },
    { key: 'ambient', label: 'Luz ambiente', min: 0, max: 1, step: 0.05, value: 0.55 },
  ],
  create(ctx) {
    const material = createReliefMaterial(ctx);
    const stage = createScreenStage(ctx, 40, material);
    const light = material.uniforms.light?.value as Vector3;
    return {
      update(dt, input) {
        syncTexel(material, ctx.video);
        (material.uniforms.strength as { value: number }).value = ctx.params.strength ?? 4;
        (material.uniforms.specular as { value: number }).value = ctx.params.specular ?? 0.6;
        (material.uniforms.ambient as { value: number }).value = ctx.params.ambient ?? 0.55;
        light.x = damp(light.x, 0.5 + input.pointer.x * 0.6, 10, dt);
        light.y = damp(light.y, 0.5 + input.pointer.y * 0.6, 10, dt);
        light.z = ctx.params.height ?? 0.35;
      },
      render: () => ctx.renderer.render(stage.scene, stage.camera),
      resize: (w, h) => stage.resize(w, h),
      dispose: () => stage.dispose(),
    };
  },
};

export const extrude: Experiment = {
  id: 'extrude',
  name: 'Extrusão 3D por brilho',
  idea: '2',
  summary:
    'Um plano com milhares de vértices onde pixels claros saltam para a frente e escuros afundam. Em fundo escuro, personagens, tiros e moedas viram relevos físicos.',
  caveat: 'O HUD branco salta muito; fundos claros (céu azul) viram uma parede ondulada.',
  params: [
    { key: 'depth', label: 'Profundidade', min: 0, max: 1.5, step: 0.05, value: 0.45 },
    { key: 'angle', label: 'Ângulo da câmera (°)', min: 0, max: 60, step: 1, value: 28 },
    { key: 'orbit', label: 'Girar sozinho (0 = parado)', min: 0, max: 1, step: 0.05, value: 0.25 },
  ],
  create(ctx) {
    const width = SCREEN_HEIGHT * ctx.aspect;
    // Um vértice por pixel do jogo (320×240), para o relevo seguir o desenho.
    const geometry = new PlaneGeometry(width, SCREEN_HEIGHT, 320, 240);
    const material = new ShaderMaterial({
      uniforms: { map: { value: ctx.texture }, depth: { value: 0.45 } },
      vertexShader: /* glsl */ `
        uniform sampler2D map;
        uniform float depth;
        varying vec2 vUv;
        varying float vHeight;
        void main() {
          vUv = uv;
          float l = dot(texture2D(map, uv).rgb, vec3(0.299, 0.587, 0.114));
          vHeight = l;
          vec3 displaced = position + vec3(0.0, 0.0, l * depth);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        ${SAMPLE_VIDEO_GLSL}
        varying vec2 vUv;
        varying float vHeight;
        void main() {
          // Partes mais fundas um pouco mais escuras, para dar leitura de volume.
          vec3 color = sampleVideo(map, vUv) * (0.75 + 0.35 * vHeight);
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const stage = createScreenStage(ctx, 40, material);
    stage.screen.geometry.dispose();
    stage.screen.geometry = geometry;
    let time = 0;
    return {
      update(dt) {
        time += dt;
        (material.uniforms.depth as { value: number }).value = ctx.params.depth ?? 0.45;
        const orbit = ctx.params.orbit ?? 0.25;
        stage.screen.rotation.x = -degToRad(ctx.params.angle ?? 28);
        stage.screen.rotation.z = Math.sin(time * 0.6) * degToRad(10) * orbit;
      },
      render: () => ctx.renderer.render(stage.scene, stage.camera),
      resize: (w, h) => stage.resize(w, h, 0.95),
      dispose: () => stage.dispose(),
    };
  },
};

export const bloom: Experiment = {
  id: 'bloom',
  name: 'Bloom (brilho estilo HD-2D)',
  idea: '2',
  summary:
    'As partes mais claras (fogo, lasers, moedas, explosões) ganham um brilho que vaza para os lados, como nos remakes "HD-2D".',
  caveat: 'Com limiar baixo, tudo que é claro brilha (inclusive textos e céu) e a imagem fica lavada.',
  params: [
    { key: 'strength', label: 'Intensidade', min: 0, max: 3, step: 0.05, value: 1.1 },
    { key: 'radius', label: 'Espalhamento', min: 0, max: 1, step: 0.05, value: 0.45 },
    { key: 'threshold', label: 'Limiar (só acima disto brilha)', min: 0, max: 1, step: 0.02, value: 0.55 },
  ],
  create(ctx) {
    const stage = createScreenStage(ctx);
    const post = createBloom(ctx.renderer, stage.scene, stage.camera);
    return {
      update() {
        post.bloom.strength = ctx.params.strength ?? 1.1;
        post.bloom.radius = ctx.params.radius ?? 0.45;
        post.bloom.threshold = ctx.params.threshold ?? 0.55;
      },
      render: () => post.composer.render(),
      resize(w, h) {
        stage.resize(w, h);
        post.resize(w, h);
      },
      dispose() {
        post.dispose();
        stage.dispose();
      },
    };
  },
};
