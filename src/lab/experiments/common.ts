import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Material,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { fitDistance } from '../math';
import type { ExperimentContext } from './types';

export const SCREEN_HEIGHT = 3;

/**
 * Textura de vídeo chega em sRGB sem conversão (o Three.js só converte sozinho nos materiais prontos,
 * via DECODE_VIDEO_TEXTURE). Nos shaders próprios, convertemos para linear antes de iluminar;
 * sem isso as cores saem "lavadas".
 */
export const SAMPLE_VIDEO_GLSL = /* glsl */ `
  vec3 sampleVideo(sampler2D tex, vec2 uv) { return sRGBTransferEOTF(texture2D(tex, uv)).rgb; }
`;

/** Cena básica: um plano com o jogo, de frente para a câmera. */
export function createScreenStage(ctx: ExperimentContext, fov = 40, material?: Material) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(fov, 1, 0.1, 100);
  const width = SCREEN_HEIGHT * ctx.aspect;
  const geometry = new PlaneGeometry(width, SCREEN_HEIGHT);
  const screen = new Mesh(geometry, material ?? new MeshBasicMaterial({ map: ctx.texture }));
  scene.add(screen);

  /** Afasta a câmera até a tela caber, considerando também a largura em telas estreitas. */
  const fit = (viewAspect: number, extraMargin = 1) => {
    const neededHeight = Math.max(SCREEN_HEIGHT, width / viewAspect);
    camera.position.set(0, 0, fitDistance(neededHeight, camera.fov) * extraMargin);
    camera.lookAt(0, 0, 0);
  };

  return {
    scene,
    camera,
    screen,
    fit,
    resize(w: number, h: number, extraMargin = 1) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit(camera.aspect, extraMargin);
    },
    dispose() {
      geometry.dispose();
      (screen.material as Material).dispose();
    },
  };
}

/** Pós-processamento com bloom (brilho que "vaza" das partes claras). */
export function createBloom(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 1.2, 0.4, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    bloom,
    composer,
    resize(w: number, h: number) {
      composer.setSize(w, h);
    },
    dispose() {
      composer.dispose();
    },
  };
}

/**
 * Relevo falso: calcula a "normal" de cada pixel pela diferença de brilho com os vizinhos (Sobel)
 * e ilumina com uma luz móvel. Onde há contraste forte, aparece sombra e brilho.
 */
export function createReliefMaterial(ctx: ExperimentContext): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      map: { value: ctx.texture },
      texel: { value: new Vector2(1 / 320, 1 / 240) },
      strength: { value: 4 },
      light: { value: new Vector3(0.5, 0.5, 0.35) },
      ambient: { value: 0.55 },
      specular: { value: 0.6 },
      aspect: { value: ctx.aspect },
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
      uniform vec2 texel;
      uniform float strength;
      uniform vec3 light;
      uniform float ambient;
      uniform float specular;
      uniform float aspect;
      varying vec2 vUv;

      ${SAMPLE_VIDEO_GLSL}
      float lum(vec2 uv) { return dot(sampleVideo(map, uv), vec3(0.2126, 0.7152, 0.0722)); }

      void main() {
        vec3 base = sampleVideo(map, vUv);
        // Sobel 3x3: gradiente horizontal e vertical do brilho.
        float tl = lum(vUv + texel * vec2(-1.0,  1.0));
        float t  = lum(vUv + texel * vec2( 0.0,  1.0));
        float tr = lum(vUv + texel * vec2( 1.0,  1.0));
        float l  = lum(vUv + texel * vec2(-1.0,  0.0));
        float r  = lum(vUv + texel * vec2( 1.0,  0.0));
        float bl = lum(vUv + texel * vec2(-1.0, -1.0));
        float b  = lum(vUv + texel * vec2( 0.0, -1.0));
        float br = lum(vUv + texel * vec2( 1.0, -1.0));
        float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
        float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
        vec3 normal = normalize(vec3(-gx * strength, -gy * strength, 1.0));

        vec3 toLight = normalize(vec3((light.xy - vUv) * vec2(aspect, 1.0), light.z));
        float diffuse = max(dot(normal, toLight), 0.0);
        vec3 halfway = normalize(toLight + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(normal, halfway), 0.0), 32.0) * specular;

        gl_FragColor = vec4(base * (ambient + diffuse * (1.0 - ambient)) * 1.2 + spec, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Atualiza o tamanho do texel com a resolução real do vídeo (muda quando o jogo troca de modo). */
export function syncTexel(material: ShaderMaterial, video: HTMLVideoElement): void {
  const texel = material.uniforms.texel?.value as Vector2 | undefined;
  if (texel && video.videoWidth > 0) texel.set(1 / video.videoWidth, 1 / video.videoHeight);
}
