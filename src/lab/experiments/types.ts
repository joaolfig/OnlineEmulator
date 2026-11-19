import type { VideoTexture, WebGLRenderer } from 'three';
import type { PadState } from '../../core/input/pad';

/** Controle de uma experiência: deslizante, ou lista de opções quando `options` existe. */
export interface ParamDef {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly options?: readonly { readonly value: number; readonly label: string }[];
}

export interface LabInput {
  readonly pad: PadState;
}

export interface ExperimentContext {
  readonly renderer: WebGLRenderer;
  /** Quadro do jogo, atualizado ao vivo. */
  readonly texture: VideoTexture;
  readonly video: HTMLVideoElement;
  /** Proporção largura/altura do jogo (4:3 no N64). */
  readonly aspect: number;
  /** Valores atuais dos controles deslizantes (a UI altera este objeto; a experiência lê a cada quadro). */
  readonly params: Record<string, number>;
}

export interface ExperimentInstance {
  update(dtSeconds: number, input: LabInput): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface Experiment {
  readonly id: string;
  readonly name: string;
  /** De qual ideia saiu: 1 = projeção 3D, 2 = shaders, combo = as duas. */
  readonly idea: '1' | '2' | 'combo' | 'ref';
  readonly summary: string;
  /** O que pode atrapalhar o jogo. */
  readonly caveat: string;
  readonly params: readonly ParamDef[];
  create(ctx: ExperimentContext): ExperimentInstance;
}
