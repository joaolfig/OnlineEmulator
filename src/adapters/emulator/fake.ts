import { AXIS_LIMIT, EMPTY_PAD, isPressed, type PadState } from '../../core/input/pad';
import type { Emulator, EmulatorSaves } from './types';

const WIDTH = 640;
const HEIGHT = 480;
const COLORS = ['#f0506e', '#5b8cff', '#f5a524', '#3ecf8e'];
const SPEED = 5;

/**
 * Emulador falso: desenha uma bolinha por porta que se move com o analógico e cresce com A,
 * e toca um tom que muda quando alguém aperta A. Serve para testar a rede sem ROM
 * (modo teste na UI e testes ponta a ponta).
 */
export class FakeEmulator implements Emulator {
  private readonly pads = new Map<number, PadState>();
  private positions: { x: number; y: number }[] = [];
  private speed = 1;
  private readonly canvas = document.createElement('canvas');
  private audio: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private frame = 0;
  private rafId = 0;

  constructor(private readonly portCount: number) {}

  start(container: HTMLElement): Promise<void> {
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.canvas.style.width = '100%';
    container.append(this.canvas);

    this.audio = new AudioContext();
    const gain = this.audio.createGain();
    gain.gain.value = 0.04;
    this.oscillator = this.audio.createOscillator();
    this.oscillator.connect(gain).connect(this.audio.destination);
    this.oscillator.start();

    this.positions = Array.from({ length: this.portCount }, (_, p) => ({ x: 120 + p * 130, y: HEIGHT / 2 }));
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('Canvas 2D indisponível'));

    const draw = () => {
      this.frame += this.speed;
      ctx.fillStyle = '#101020';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.fillText(`MODO TESTE  frame ${this.frame}${this.speed > 1 ? `  ⏩ ${this.speed}x` : ''}`, 20, 34);
      let anyA = false;
      this.positions.forEach((pos, port) => {
        const pad = this.pads.get(port) ?? EMPTY_PAD;
        const step = SPEED * this.speed;
        pos.x = Math.max(20, Math.min(WIDTH - 20, pos.x + (pad.x / AXIS_LIMIT) * step));
        pos.y = Math.max(60, Math.min(HEIGHT - 20, pos.y + (pad.y / AXIS_LIMIT) * step));
        const a = isPressed(pad, 'A');
        anyA ||= a;
        ctx.fillStyle = COLORS[port % COLORS.length] ?? '#fff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, a ? 26 : 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(`P${port + 1}`, pos.x - 14, pos.y - 30);
      });
      if (this.oscillator) this.oscillator.frequency.value = anyA ? 660 : 220 + (this.frame % 120);
      this.rafId = requestAnimationFrame(draw);
    };
    draw();
    return Promise.resolve();
  }

  setInput(port: number, pad: PadState): void {
    this.pads.set(port, pad);
  }

  releaseAll(port: number): void {
    this.pads.set(port, EMPTY_PAD);
  }

  /** O modo teste não tem controles próprios: tudo vem do app. */
  setLocalPort(): void {}

  setSpeed(multiplier: number): void {
    this.speed = Math.max(1, Math.round(multiplier));
  }

  /** "Savestate" do modo teste: posição das bolinhas e o número do frame. */
  readonly saves: EmulatorSaves = {
    saveExtension: 'sav',
    flushSave: () => Promise.resolve(),
    exportSave: () => null,
    importSave: () => {},
    exportState: () =>
      new TextEncoder().encode(JSON.stringify({ frame: this.frame, positions: this.positions })),
    importState: (data) => {
      const state = JSON.parse(new TextDecoder().decode(data)) as {
        frame: number;
        positions: { x: number; y: number }[];
      };
      this.frame = state.frame;
      this.positions = state.positions;
    },
  };

  captureStream(fps: number): Promise<MediaStream> {
    const stream = this.canvas.captureStream(fps);
    if (this.audio && this.oscillator) {
      const destination = this.audio.createMediaStreamDestination();
      this.oscillator.connect(destination);
      destination.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    return Promise.resolve(stream);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.oscillator?.stop();
    void this.audio?.close();
    this.canvas.remove();
  }
}
