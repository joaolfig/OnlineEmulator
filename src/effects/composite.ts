// Os efeitos do jogo combinados num único desenho. Cada um pode ser ligado ou desligado:
// - inclinação: a tela gira seguindo o controle;
// - TV de tubo: tela curva com moldura, pixels que se misturam como no feixe da TV e luz de fundo;
// - relevo: as bordas da imagem ganham volume, iluminadas pelas partes claras do jogo.
// Tudo num shader só (com #define por efeito): ligar os três custa quase o mesmo que um.

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { EffectId } from './catalog';
import { createScreenStage, SAMPLE_VIDEO_GLSL, SCREEN_HEIGHT } from './common';
import { averageColor, brightCentroid, damp, degToRad, tiltTarget } from './math';
import type { EffectContext, EffectScene } from './types';

/** Configuração fixa da TV de tubo. */
const CRT = { softness: 0.8, scanlines: 0.5, curvature: 0.12, ambilight: 0.45 } as const;
/** Inclinação: ângulo máximo e rapidez da resposta. */
const TILT = { maxAngle: 8, smoothing: 6 } as const;

/** Relevo: força das bordas, altura da luz, brilho especular e luz ambiente. */
const RELIEF = { strength: 4, height: 0.35, specular: 0.3, ambient: 0.55 } as const;
/** A luz do relevo sai das partes mais claras do jogo, procuradas numa miniatura do quadro. */
const LIGHT_SAMPLE_W = 32;
const LIGHT_SAMPLE_H = 24;
/** Sem nada brilhando na tela, a luz descansa no alto, um pouco à esquerda. */
const LIGHT_REST = { x: 0.3, y: 0.85 };

const FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 res;
  uniform float aspect;
  uniform float softness;
  uniform float scanlines;
  uniform float strength;
  uniform vec3 light;
  uniform float ambient;
  uniform float specular;
  varying vec2 vUv;

  ${SAMPLE_VIDEO_GLSL}
  vec3 texelAt(vec2 p) { return sampleVideo(map, p / res); }
  float lumAt(vec2 uv) { return dot(sampleVideo(map, uv), vec3(0.2126, 0.7152, 0.0722)); }

  void main() {
    vec2 pos = vUv * res;
    vec3 color;

  #ifdef CRT
    // Feixe da TV: cada pixel se mistura com o vizinho na horizontal, e um pouco com as linhas ao lado.
    float x0 = floor(pos.x - 0.5) + 0.5;
    float y0 = floor(pos.y) + 0.5;
    float w = mix(step(0.5, pos.x - x0), smoothstep(0.0, 1.0, pos.x - x0), softness);
    color = mix(texelAt(vec2(x0, y0)), texelAt(vec2(x0 + 1.0, y0)), w);
    vec3 above = mix(texelAt(vec2(x0, y0 + 1.0)), texelAt(vec2(x0 + 1.0, y0 + 1.0)), w);
    vec3 below = mix(texelAt(vec2(x0, y0 - 1.0)), texelAt(vec2(x0 + 1.0, y0 - 1.0)), w);
    color += (above + below) * 0.07 * softness;
  #else
    color = sampleVideo(map, vUv);
  #endif

  #ifdef RELIEF
    // Relevo: normal de cada pixel pela diferença de brilho com os vizinhos (Sobel 3x3).
    vec2 t = 1.0 / res;
    float tl = lumAt(vUv + t * vec2(-1.0,  1.0));
    float tc = lumAt(vUv + t * vec2( 0.0,  1.0));
    float tr = lumAt(vUv + t * vec2( 1.0,  1.0));
    float ml = lumAt(vUv + t * vec2(-1.0,  0.0));
    float mr = lumAt(vUv + t * vec2( 1.0,  0.0));
    float bl = lumAt(vUv + t * vec2(-1.0, -1.0));
    float bc = lumAt(vUv + t * vec2( 0.0, -1.0));
    float br = lumAt(vUv + t * vec2( 1.0, -1.0));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    vec3 normal = normalize(vec3(-gx * strength, -gy * strength, 1.0));
    vec3 toLight = normalize(vec3((light.xy - vUv) * vec2(aspect, 1.0), light.z));
    float diffuse = max(dot(normal, toLight), 0.0);
    float spec = pow(max(dot(normal, normalize(toLight + vec3(0.0, 0.0, 1.0))), 0.0), 32.0) * specular;
    color = color * (ambient + diffuse * (1.0 - ambient)) * 1.2 + spec;
  #endif

  #ifdef CRT
    // Linha de varredura: feixe mais grosso onde a imagem é clara; máscara RGB e cantos escuros.
    float lum = clamp(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
    float dy = fract(pos.y) - 0.5;
    float beam = mix(0.2, 0.42, lum);
    color *= mix(1.0, exp(-(dy * dy) / (2.0 * beam * beam)) * 1.55, scanlines);
    float column = mod(floor(gl_FragCoord.x), 3.0);
    vec3 mask = vec3(column == 0.0 ? 1.1 : 0.94, column == 1.0 ? 1.1 : 0.94, column == 2.0 ? 1.1 : 0.94);
    color *= mix(vec3(1.0), mask, scanlines * 0.6);
    vec2 edge = vUv * (1.0 - vUv);
    color *= pow(clamp(edge.x * edge.y * 18.0, 0.0, 1.0), 0.35) * 1.08;
  #endif

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

type Flags = Readonly<Record<EffectId, boolean>>;

/** Monta a cena com os efeitos ligados em `flags`. */
export function createComposite(ctx: EffectContext, flags: Flags): EffectScene {
  const material = new ShaderMaterial({
    defines: { ...(flags.crt ? { CRT: '' } : {}), ...(flags.relief ? { RELIEF: '' } : {}) },
    uniforms: {
      map: { value: ctx.texture },
      res: { value: new Vector2(320, 240) },
      aspect: { value: ctx.aspect },
      softness: { value: CRT.softness },
      scanlines: { value: CRT.scanlines },
      strength: { value: RELIEF.strength },
      light: { value: new Vector3(LIGHT_REST.x, LIGHT_REST.y, RELIEF.height) },
      ambient: { value: RELIEF.ambient },
      specular: { value: RELIEF.specular },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const uniform = <T>(name: string) => material.uniforms[name] as { value: T };
  const stage = createScreenStage(ctx, 40, material);
  const width = SCREEN_HEIGHT * ctx.aspect;
  // Tudo que gira junto com a inclinação (tela, moldura e luz da TV).
  const rig = new Group();
  stage.scene.remove(stage.screen);
  rig.add(stage.screen);
  stage.scene.add(rig);
  const disposers: (() => void)[] = [];

  // ---------- TV de tubo: tela curva, moldura e luz de fundo (Ambilight) ----------
  let ambilight: ((dt: number) => void) | null = null;
  if (flags.crt) {
    const curved = new PlaneGeometry(width, SCREEN_HEIGHT, 48, 36);
    const pos = curved.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / (width / 2);
        const y = pos.getY(i) / (SCREEN_HEIGHT / 2);
        pos.setZ(i, CRT.curvature * (1 - (x * x + y * y) / 2));
      }
    }
    stage.screen.geometry.dispose();
    stage.screen.geometry = curved;

    const cabinetMaterial = new MeshBasicMaterial({ color: 0x2a2a30 });
    const cabinet = new Mesh(new BoxGeometry(width + 0.7, SCREEN_HEIGHT + 0.7, 1.6), cabinetMaterial);
    cabinet.position.z = -0.85;
    const glowTexture = new CanvasTexture(radialGlowCanvas());
    const glowMaterial = new MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const glow = new Mesh(new PlaneGeometry(width * 3.2, SCREEN_HEIGHT * 3.2), glowMaterial);
    glow.position.z = -1.8;
    rig.add(cabinet, glow);

    const sample = document.createElement('canvas');
    sample.width = 16;
    sample.height = 12;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    const color = new Color(0, 0, 0);
    const target = new Color(0, 0, 0);
    let frame = 0;
    ambilight = (dt) => {
      if (sampleCtx && frame++ % 3 === 0 && ctx.video.readyState >= 2) {
        sampleCtx.drawImage(ctx.video, 0, 0, sample.width, sample.height);
        const avg = averageColor(sampleCtx.getImageData(0, 0, sample.width, sample.height).data);
        const k = CRT.ambilight;
        target.setRGB(Math.min(1, avg.r * k), Math.min(1, avg.g * k), Math.min(1, avg.b * k));
      }
      color.lerp(target, Math.min(1, dt * 6));
      glowMaterial.color.copy(color);
      stage.scene.background = color.clone().multiplyScalar(0.12);
    };
    disposers.push(() => {
      cabinet.geometry.dispose();
      cabinetMaterial.dispose();
      glow.geometry.dispose();
      glowMaterial.dispose();
      glowTexture.dispose();
    });
  }

  // ---------- Relevo: a luz vai até as partes mais claras do jogo (fogo, lasers, explosões) ----------
  let moveLight: ((dt: number) => void) | null = null;
  if (flags.relief) {
    const light = uniform<Vector3>('light').value;
    const sample = document.createElement('canvas');
    sample.width = LIGHT_SAMPLE_W;
    sample.height = LIGHT_SAMPLE_H;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    let target = { ...LIGHT_REST };
    let frame = 0;
    moveLight = (dt) => {
      // A cada 4 quadros, procura as partes mais claras numa miniatura do jogo.
      if (sampleCtx && frame++ % 4 === 0 && ctx.video.readyState >= 2) {
        sampleCtx.drawImage(ctx.video, 0, 0, LIGHT_SAMPLE_W, LIGHT_SAMPLE_H);
        const data = sampleCtx.getImageData(0, 0, LIGHT_SAMPLE_W, LIGHT_SAMPLE_H).data;
        target = brightCentroid(data, LIGHT_SAMPLE_W, LIGHT_SAMPLE_H) ?? LIGHT_REST;
      }
      // A luz "desliza" até o alvo em vez de pular.
      light.x = damp(light.x, target.x, 5, dt);
      light.y = damp(light.y, target.y, 5, dt);
    };
  }

  // Margem para nada sair da tela: a moldura da TV e a inclinação ocupam mais espaço.
  const margin = (flags.crt ? 1.3 : 1) * (flags.tilt ? (flags.crt ? 1.18 : 1.1) : 1);
  let yaw = 0;
  let pitch = 0;

  return {
    update(dt, input) {
      if (ctx.video.videoWidth > 0) {
        uniform<Vector2>('res').value.set(ctx.video.videoWidth, ctx.video.videoHeight);
      }
      ambilight?.(dt);
      moveLight?.(dt);
      if (flags.tilt) {
        const target = tiltTarget(input.pad, TILT.maxAngle);
        yaw = damp(yaw, target.yaw, TILT.smoothing, dt);
        pitch = damp(pitch, target.pitch, TILT.smoothing, dt);
        rig.rotation.set(degToRad(pitch), degToRad(yaw), 0);
      }
    },
    render: () => ctx.renderer.render(stage.scene, stage.camera),
    resize: (w, h) => stage.resize(w, h, margin),
    dispose() {
      disposers.forEach((fn) => fn());
      stage.dispose();
    },
  };
}

function radialGlowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
  }
  return canvas;
}
