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
  Vector2,
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

/**
 * Tela de TV de tubo. Imita o que o feixe de elétrons fazia com a imagem:
 * - cada pixel "vaza" para os vizinhos na horizontal (sem bordas quadradas);
 * - cada linha da imagem é um feixe que engrossa onde está claro (linhas de varredura);
 * - um pouco de brilho das linhas vizinhas, máscara RGB do vidro e cantos mais escuros.
 * Os artistas da época desenhavam contando com essa mistura (quadriculados viravam transparência).
 */
function createCrtMaterial(map: Texture) {
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      res: { value: new Vector2(320, 240) },
      scanlines: { value: 0.5 },
      softness: { value: 0.8 },
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
      uniform vec2 res;
      uniform float scanlines;
      uniform float softness;
      varying vec2 vUv;

      vec3 texel(vec2 p) { return sampleVideo(map, p / res); }

      void main() {
        vec2 pos = vUv * res;
        float x0 = floor(pos.x - 0.5) + 0.5;
        float y0 = floor(pos.y) + 0.5;
        float fx = pos.x - x0;
        // Nítido (degrau) com suavidade 0; transição suave entre vizinhos com suavidade 1.
        float w = mix(step(0.5, fx), smoothstep(0.0, 1.0, fx), softness);
        vec3 color = mix(texel(vec2(x0, y0)), texel(vec2(x0 + 1.0, y0)), w);
        vec3 above = mix(texel(vec2(x0, y0 + 1.0)), texel(vec2(x0 + 1.0, y0 + 1.0)), w);
        vec3 below = mix(texel(vec2(x0, y0 - 1.0)), texel(vec2(x0 + 1.0, y0 - 1.0)), w);
        color += (above + below) * 0.07 * softness;

        // Feixe de cada linha: gaussiana mais larga onde a imagem é mais clara.
        float lum = clamp(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
        float dy = fract(pos.y) - 0.5;
        float beam = mix(0.2, 0.42, lum);
        float scan = exp(-(dy * dy) / (2.0 * beam * beam)) * 1.55;
        color *= mix(1.0, scan, scanlines);

        // Máscara RGB do vidro (sutil) e cantos escuros.
        float column = mod(floor(gl_FragCoord.x), 3.0);
        vec3 mask = vec3(column == 0.0 ? 1.1 : 0.94, column == 1.0 ? 1.1 : 0.94, column == 2.0 ? 1.1 : 0.94);
        color *= mix(vec3(1.0), mask, scanlines * 0.6);
        vec2 edge = vUv * (1.0 - vUv);
        color *= pow(clamp(edge.x * edge.y * 18.0, 0.0, 1.0), 0.35);

        gl_FragColor = vec4(color * 1.08, 1.0);
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
    'O jogo numa TV antiga curva, num quarto escuro. Os pixels se misturam como no feixe da TV de tubo (sem quadradinhos duros) e a luz atrás da TV muda de cor conforme a imagem (Ambilight).',
  caveat:
    'Fica mais fiel em jogos 2D de 240 linhas (SNES, Mega Drive, NES). Linhas de varredura fortes escurecem a imagem.',
  params: [
    {
      key: 'softness',
      label: 'Suavidade de TV (0 = pixels nítidos)',
      min: 0,
      max: 1,
      step: 0.05,
      value: 0.8,
    },
    { key: 'scanlines', label: 'Linhas de varredura', min: 0, max: 1, step: 0.05, value: 0.5 },
    { key: 'curvature', label: 'Curvatura da tela', min: 0, max: 0.4, step: 0.01, value: 0.12 },
    { key: 'ambilight', label: 'Luz ambiente', min: 0, max: 3, step: 0.1, value: 1.4 },
    { key: 'turn', label: 'Ângulo da TV (°)', min: -25, max: 25, step: 1, value: 0 },
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
        (material.uniforms.scanlines as { value: number }).value = ctx.params.scanlines ?? 0.5;
        (material.uniforms.softness as { value: number }).value = ctx.params.softness ?? 0.8;
        // Resolução real do vídeo: cada linha da imagem vira uma linha de varredura.
        if (ctx.video.videoWidth > 0) {
          (material.uniforms.res as { value: Vector2 }).value.set(
            ctx.video.videoWidth,
            ctx.video.videoHeight,
          );
        }

        if (sampleCtx && frame++ % 3 === 0 && ctx.video.readyState >= 2) {
          sampleCtx.drawImage(ctx.video, 0, 0, sample.width, sample.height);
          const avg = averageColor(sampleCtx.getImageData(0, 0, sample.width, sample.height).data);
          const boost = ctx.params.ambilight ?? 1.4;
          target.setRGB(Math.min(1, avg.r * boost), Math.min(1, avg.g * boost), Math.min(1, avg.b * boost));
        }
        ambient.lerp(target, Math.min(1, dt * 6));
        glowMaterial.color.copy(ambient);
        stage.scene.background = ambient.clone().multiplyScalar(0.12);

        const turn = degToRad(ctx.params.turn ?? 0);
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
