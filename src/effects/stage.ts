import { LinearFilter, NearestFilter, SRGBColorSpace, VideoTexture, WebGLRenderer } from 'three';
import { EMPTY_PAD, type PadState } from '../core/input/pad';
import type { Experiment, ExperimentInstance, EffectInput } from './types';

const DEFAULT_ASPECT = 4 / 3;

/**
 * Palco 3D dos efeitos: recebe o vídeo do jogo (o mesmo MediaStream que os convidados recebem),
 * transforma em textura e roda o efeito escolhido a cada quadro. Usado no jogo e no laboratório.
 */
export class EffectStage {
  readonly renderer: WebGLRenderer;
  private readonly video = document.createElement('video');
  private readonly texture: VideoTexture;
  private instance: ExperimentInstance | null = null;
  private experiment: Experiment | null = null;
  private aspect = DEFAULT_ASPECT;
  private params: Record<string, number> = {};
  /** De onde vem o controle (para efeitos que reagem a ele, como a inclinação). */
  private readPad: () => PadState = () => EMPTY_PAD;
  private rafId = 0;
  private last = 0;
  private frames = 0;
  private fpsWindowStart = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly abort = new AbortController();

  constructor(
    private readonly container: HTMLElement,
    private readonly onFps: (fps: number) => void = () => {},
  ) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.renderer.domElement);

    this.video.muted = true;
    this.video.playsInline = true;
    this.texture = new VideoTexture(this.video);
    this.texture.colorSpace = SRGBColorSpace;
    this.setPixelated(true);

    // Quando o vídeo muda de tamanho (ex.: troca da cena demo para uma ROM), refaz a cena no novo formato.
    this.video.addEventListener(
      'resize',
      () => {
        const { videoWidth: w, videoHeight: h } = this.video;
        if (w === 0 || h === 0) return;
        const aspect = w / h;
        if (Math.abs(aspect - this.aspect) < 0.01) return;
        this.aspect = aspect;
        this.rebuild();
      },
      { signal: this.abort.signal },
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  /** Pixels "quadrados" (nítidos) ou suavizados ao ampliar. */
  setPixelated(pixelated: boolean): void {
    this.texture.magFilter = pixelated ? NearestFilter : LinearFilter;
    this.texture.minFilter = pixelated ? NearestFilter : LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  async setSource(stream: MediaStream): Promise<void> {
    this.video.srcObject = stream;
    await this.video.play();
  }

  setExperiment(experiment: Experiment, params: Record<string, number>): void {
    this.experiment = experiment;
    this.params = params;
    this.rebuild();
  }

  /** Recria a cena com o formato atual do vídeo (o plano 3D segue a proporção real do jogo). */
  private rebuild(): void {
    if (!this.experiment) return;
    this.instance?.dispose();
    this.instance = this.experiment.create({
      renderer: this.renderer,
      texture: this.texture,
      video: this.video,
      aspect: this.aspect,
      params: this.params,
    });
    this.resize();
  }

  setPad(pad: PadState): void {
    this.readPad = () => pad;
  }

  setPadSource(read: () => PadState): void {
    this.readPad = read;
  }

  start(): void {
    this.last = performance.now();
    this.fpsWindowStart = this.last;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const input: EffectInput = { pad: this.readPad() };
      this.instance?.update(dt, input);
      this.instance?.render();
      this.countFrame(now);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.abort.abort();
    this.video.pause();
    this.video.srcObject = null;
    this.resizeObserver.disconnect();
    this.instance?.dispose();
    this.texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.instance?.resize(w, h);
  }

  private countFrame(now: number): void {
    this.frames++;
    if (now - this.fpsWindowStart >= 1000) {
      this.onFps(Math.round((this.frames * 1000) / (now - this.fpsWindowStart)));
      this.frames = 0;
      this.fpsWindowStart = now;
    }
  }
}
