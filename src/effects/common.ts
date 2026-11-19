import { Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene, type Material } from 'three';
import { fitDistance } from './math';
import type { EffectContext } from './types';

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
export function createScreenStage(ctx: EffectContext, fov = 40, material?: Material) {
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
