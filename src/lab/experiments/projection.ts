// Ideia 1: o jogo continua 2D, mas vira um plano dentro de um espaço 3D.

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from 'three';
import { averageColor, damp, degToRad, tiltTarget } from '../math';
import { createScreenStage, SAMPLE_VIDEO_GLSL, SCREEN_HEIGHT } from './common';
import type { Experiment } from './types';

export const flat: Experiment = {
  id: 'flat',
  name: 'Referência (sem efeito)',
  idea: 'ref',
  summary: 'O jogo puro, num plano reto. Serve para comparar com os outros efeitos.',
  caveat: 'Nenhum.',
  params: [],
  create(ctx) {
    const stage = createScreenStage(ctx);
    return {
      update() {},
      render: () => ctx.renderer.render(stage.scene, stage.camera),
      resize: (w, h) => stage.resize(w, h),
      dispose: () => stage.dispose(),
    };
  },
};

export const tilt: Experiment = {
  id: 'tilt',
  name: 'Inclinação dinâmica',
  idea: '1',
  summary:
    'A tela gira alguns graus para o lado em que você anda e inclina para trás quando pula (A), como se a câmera acompanhasse o movimento.',
  caveat: 'Com ângulo alto pode dar enjoo; com movimento constante (corrida) a tela fica sempre torta.',
  params: [
    { key: 'maxAngle', label: 'Ângulo máximo (°)', min: 0, max: 25, step: 1, value: 8 },
    { key: 'smoothing', label: 'Rapidez da resposta', min: 1, max: 20, step: 1, value: 6 },
  ],
  create(ctx) {
    const stage = createScreenStage(ctx);
    let yaw = 0;
    let pitch = 0;
    return {
      update(dt, input) {
        const target = tiltTarget(input.pad, ctx.params.maxAngle ?? 8);
        const lambda = ctx.params.smoothing ?? 6;
        yaw = damp(yaw, target.yaw, lambda, dt);
        pitch = damp(pitch, target.pitch, lambda, dt);
        stage.screen.rotation.set(degToRad(pitch), degToRad(yaw), 0);
      },
      render: () => ctx.renderer.render(stage.scene, stage.camera),
      // Margem extra para as bordas não saírem da tela quando gira.
      resize: (w, h) => stage.resize(w, h, 1.12),
      dispose: () => stage.dispose(),
    };
  },
};

export const tabletop: Experiment = {
  id: 'tabletop',
  name: 'Modo mesa (tabuleiro 2.5D)',
  idea: '1',
  summary:
    'O jogo deitado para trás com perspectiva, como um tabuleiro na mesa. Combina com jogos vistos de cima (Mario Party, Bomberman, Zelda, Pokémon).',
  caveat: 'A parte de cima da tela fica menor e mais difícil de ler (placar, HUD).',
  params: [
    { key: 'angle', label: 'Inclinação (°)', min: 0, max: 60, step: 1, value: 32 },
    { key: 'fov', label: 'Perspectiva (FOV)', min: 15, max: 75, step: 1, value: 45 },
  ],
  create(ctx) {
    const stage = createScreenStage(ctx);
    let lastFov = 0;
    let size = { w: 1, h: 1 };
    return {
      update() {
        const fov = ctx.params.fov ?? 45;
        if (fov !== lastFov) {
          stage.camera.fov = fov;
          lastFov = fov;
          stage.resize(size.w, size.h, 0.92);
        }
        stage.screen.rotation.x = -degToRad(ctx.params.angle ?? 32);
        // Desce um pouco o tabuleiro para centralizar depois de deitar.
        stage.screen.position.y = -Math.sin(degToRad(ctx.params.angle ?? 32)) * SCREEN_HEIGHT * 0.12;
      },
      render: () => ctx.renderer.render(stage.scene, stage.camera),
      resize: (w, h) => {
        size = { w, h };
        stage.resize(w, h, 0.92);
      },
      dispose: () => stage.dispose(),
    };
  },
};

/** Tela de TV de tubo: curvatura, linhas de varredura, máscara RGB e cantos escuros. */
function createCrtMaterial(map: Texture) {
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      scanlines: { value: 0.35 },
      lines: { value: 240 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      ${SAMPLE_VIDEO_GLSL}
      uniform float scanlines;
      uniform float lines;
      varying vec2 vUv;
      void main() {
        vec3 color = sampleVideo(map, vUv);
        float scan = 1.0 - scanlines * (0.5 + 0.5 * cos(vUv.y * lines * 6.2831853));
        float column = mod(floor(gl_FragCoord.x), 3.0);
        vec3 mask = mix(vec3(1.0), vec3(column == 0.0 ? 1.15 : 0.9, column == 1.0 ? 1.15 : 0.9, column == 2.0 ? 1.15 : 0.9), scanlines);
        vec2 edge = vUv * (1.0 - vUv);
        float vignette = pow(clamp(edge.x * edge.y * 18.0, 0.0, 1.0), 0.35);
        gl_FragColor = vec4(color * scan * mask * vignette * 1.12, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export const crt: Experiment = {
  id: 'crt',
  name: 'TV de tubo 3D + Ambilight',
  idea: '1',
  summary:
    'O jogo numa TV antiga curva, com linhas de varredura, num quarto escuro. A luz atrás da TV muda de cor conforme a imagem (efeito Ambilight).',
  caveat: 'As linhas de varredura escurecem a imagem; a TV ocupa menos espaço que o jogo puro.',
  params: [
    { key: 'curvature', label: 'Curvatura da tela', min: 0, max: 0.4, step: 0.01, value: 0.15 },
    { key: 'scanlines', label: 'Linhas de varredura', min: 0, max: 1, step: 0.05, value: 0.35 },
    { key: 'ambilight', label: 'Luz ambiente', min: 0, max: 3, step: 0.1, value: 1.4 },
    { key: 'turn', label: 'Ângulo da TV (°)', min: -30, max: 30, step: 1, value: -12 },
  ],
  create(ctx) {
    const material = createCrtMaterial(ctx.texture);
    const stage = createScreenStage(ctx, 40, material);
    const width = SCREEN_HEIGHT * ctx.aspect;

    // Tela curva: plano subdividido com o centro empurrado para a frente.
    const curved = new PlaneGeometry(width, SCREEN_HEIGHT, 48, 36);
    const flatPositions = Float32Array.from(curved.attributes.position?.array ?? []);
    stage.screen.geometry.dispose();
    stage.screen.geometry = curved;
    let lastCurvature = -1;

    // Gabinete da TV e a luz atrás dela.
    const cabinet = new Mesh(
      new BoxGeometry(width + 0.7, SCREEN_HEIGHT + 0.7, 1.6),
      new MeshBasicMaterial({ color: 0x2a2a30 }),
    );
    cabinet.position.z = -0.85;
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const g = glowCanvas.getContext('2d');
    if (g) {
      const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gradient;
      g.fillRect(0, 0, 128, 128);
    }
    const glowTexture = new CanvasTexture(glowCanvas);
    const glowMaterial = new MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const glow = new Mesh(new PlaneGeometry(width * 3.2, SCREEN_HEIGHT * 3.2), glowMaterial);
    glow.position.z = -1.8;
    stage.scene.add(cabinet, glow);
    stage.scene.background = new Color(0x050507);

    // Amostra a imagem numa miniatura para calcular a cor média.
    const sample = document.createElement('canvas');
    sample.width = 16;
    sample.height = 12;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    let frame = 0;
    const ambient = new Color(0, 0, 0);
    const target = new Color(0, 0, 0);

    return {
      update(dt) {
        const curvature = ctx.params.curvature ?? 0.15;
        if (curvature !== lastCurvature) {
          lastCurvature = curvature;
          const pos = curved.attributes.position;
          if (pos) {
            for (let i = 0; i < pos.count; i++) {
              const x = (flatPositions[i * 3] ?? 0) / (width / 2);
              const y = (flatPositions[i * 3 + 1] ?? 0) / (SCREEN_HEIGHT / 2);
              pos.setZ(i, curvature * (1 - (x * x + y * y) / 2));
            }
            pos.needsUpdate = true;
          }
        }
        (material.uniforms.scanlines as { value: number }).value = ctx.params.scanlines ?? 0.35;
        (material.uniforms.lines as { value: number }).value = ctx.video.videoHeight || 240;

        if (sampleCtx && frame++ % 3 === 0 && ctx.video.readyState >= 2) {
          sampleCtx.drawImage(ctx.video, 0, 0, sample.width, sample.height);
          const avg = averageColor(sampleCtx.getImageData(0, 0, sample.width, sample.height).data);
          const boost = ctx.params.ambilight ?? 1.4;
          target.setRGB(Math.min(1, avg.r * boost), Math.min(1, avg.g * boost), Math.min(1, avg.b * boost));
        }
        ambient.lerp(target, Math.min(1, dt * 6));
        glowMaterial.color.copy(ambient);
        stage.scene.background = ambient.clone().multiplyScalar(0.12);

        const turn = degToRad(ctx.params.turn ?? -12);
        for (const object of [stage.screen, cabinet, glow]) object.rotation.y = turn;
        cabinet.position.x = Math.sin(turn) * -0.85;
        glow.position.x = Math.sin(turn) * -1.8;
      },
      render: () => ctx.renderer.render(stage.scene, stage.camera),
      resize: (w, h) => stage.resize(w, h, 1.3),
      dispose() {
        stage.dispose();
        cabinet.geometry.dispose();
        (cabinet.material as MeshBasicMaterial).dispose();
        glow.geometry.dispose();
        glowMaterial.dispose();
        glowTexture.dispose();
      },
    };
  },
};
