import type { VideoTexture, WebGLRenderer } from 'three';
import type { PadState } from '../core/input/pad';

export interface EffectInput {
  readonly pad: PadState;
}

export interface EffectContext {
  readonly renderer: WebGLRenderer;
  /** Quadro do jogo, atualizado ao vivo. */
  readonly texture: VideoTexture;
  readonly video: HTMLVideoElement;
  /** Proporção largura/altura do jogo (4:3 no N64). */
  readonly aspect: number;
}

/** Cena montada com os efeitos ligados. */
export interface EffectScene {
  update(dtSeconds: number, input: EffectInput): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export type EffectSceneFactory = (ctx: EffectContext) => EffectScene;
