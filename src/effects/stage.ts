import { NearestFilter, SRGBColorSpace, VideoTexture, WebGLRenderer } from 'three';
import { EMPTY_PAD, type PadState } from '../core/input/pad';
import type { EffectInput, EffectScene, EffectSceneFactory } from './types';

const DEFAULT_ASPECT = 4 / 3;

/**
 * Palco 3D dos efeitos: recebe o vídeo do jogo (o mesmo MediaStream que os convidados recebem),
 * transforma em textura e desenha a cena dos efeitos ligados a cada quadro.
 */
export class EffectStage {
  private readonly renderer: WebGLRenderer;
  private readonly video = document.createElement('video');
  private readonly texture: VideoTexture;
  private scene: EffectScene | null = null;
  private factory: EffectSceneFactory | null = null;
  private aspect = DEFAULT_ASPECT;
  /** De onde vem o controle (para efeitos que reagem a ele, como a inclinação). */
  private readPad: () => PadState = () => EMPTY_PAD;
  private rafId = 0;
  private last = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly abort = new AbortController();

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.renderer.domElement);

    this.video.muted = true;
    this.video.playsInline = true;
    this.texture = new VideoTexture(this.video);
    this.texture.colorSpace = SRGBColorSpace;
    // Pixels nítidos ao ampliar (a suavização da TV de tubo é feita no shader).
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;

    // Quando o vídeo muda de tamanho (o jogo trocou de resolução), refaz a cena no novo formato.
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

  async setSource(stream: MediaStream): Promise<void> {
    this.video.srcObject = stream;
    await this.video.play();
  }

  setScene(factory: EffectSceneFactory): void {
    this.factory = factory;
    this.rebuild();
  }

  setPadSource(read: () => PadState): void {
    this.readPad = read;
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const input: EffectInput = { pad: this.readPad() };
      this.scene?.update(dt, input);
      this.scene?.render();
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
    this.scene?.dispose();
    this.texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Recria a cena com o formato atual do vídeo (o plano 3D segue a proporção real do jogo). */
  private rebuild(): void {
    if (!this.factory) return;
    this.scene?.dispose();
    this.scene = this.factory({
      renderer: this.renderer,
      texture: this.texture,
      video: this.video,
      aspect: this.aspect,
    });
    this.resize();
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.scene?.resize(w, h);
  }
}
