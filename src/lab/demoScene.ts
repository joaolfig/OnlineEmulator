// "Jogo" de demonstração em pixel art, só para avaliar os efeitos sem ROM.
// Tem o que importa para julgar os efeitos: fundo escuro, sprites contrastados, brilhos
// (moedas, lasers, fogo) e texto de HUD branco (o caso difícil para relevo e extrusão).

import { AXIS_LIMIT, EMPTY_PAD, isPressed, type PadState } from '../core/input/pad';

export const DEMO_WIDTH = 320;
export const DEMO_HEIGHT = 240;
const GROUND_Y = 200;
const GRAVITY = 900;
const JUMP_SPEED = 330;
const RUN_SPEED = 120;

interface Laser {
  y: number;
  x: number;
  speed: number;
  color: string;
}

export class DemoScene {
  readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private pad: PadState = EMPTY_PAD;
  private player = { x: 60, y: GROUND_Y - 16, vy: 0, facing: 1 };
  private time = 0;
  private score = 12340;
  private rafId = 0;
  private last = 0;
  private readonly stars = Array.from({ length: 60 }, (_, i) => ({
    x: (i * 97) % DEMO_WIDTH,
    y: (i * 53) % 150,
    phase: i,
  }));
  private readonly coins = [90, 140, 190, 240, 280].map((x, i) => ({
    x,
    y: 130 - (i % 2) * 30,
    taken: false,
  }));
  private readonly lasers: Laser[] = [
    { y: 112, x: -40, speed: 160, color: '#3ff' },
    { y: 80, x: 200, speed: -120, color: '#f3f' },
  ];

  constructor() {
    this.canvas.width = DEMO_WIDTH;
    this.canvas.height = DEMO_HEIGHT;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  setPad(pad: PadState): void {
    this.pad = pad;
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private step(dt: number): void {
    this.time += dt;
    const p = this.player;
    const dir = this.pad.x / AXIS_LIMIT;
    p.x = Math.max(8, Math.min(DEMO_WIDTH - 24, p.x + dir * RUN_SPEED * dt));
    if (dir !== 0) p.facing = Math.sign(dir);
    const onGround = p.y >= GROUND_Y - 16;
    if (onGround && isPressed(this.pad, 'A')) p.vy = -JUMP_SPEED;
    p.vy += GRAVITY * dt;
    p.y = Math.min(GROUND_Y - 16, p.y + p.vy * dt);
    if (p.y >= GROUND_Y - 16) p.vy = 0;

    for (const coin of this.coins) {
      if (!coin.taken && Math.abs(coin.x - (p.x + 8)) < 10 && Math.abs(coin.y - (p.y + 8)) < 14) {
        coin.taken = true;
        this.score += 100;
      }
    }
    if (this.coins.every((c) => c.taken)) this.coins.forEach((c) => (c.taken = false));
    for (const laser of this.lasers) {
      laser.x += laser.speed * dt;
      if (laser.speed > 0 && laser.x > DEMO_WIDTH + 40) laser.x = -60;
      if (laser.speed < 0 && laser.x < -60) laser.x = DEMO_WIDTH + 40;
    }
  }

  private draw(): void {
    const { ctx } = this;
    // Céu escuro e estrelas piscando.
    ctx.fillStyle = '#0b0d1f';
    ctx.fillRect(0, 0, DEMO_WIDTH, DEMO_HEIGHT);
    for (const s of this.stars) {
      const on = Math.sin(this.time * 2 + s.phase) > -0.3;
      ctx.fillStyle = on ? '#cfd8ff' : '#3a4060';
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    // Montanhas ao fundo.
    ctx.fillStyle = '#1b2045';
    for (let x = 0; x < DEMO_WIDTH; x += 4) {
      const h = 30 + Math.sin(x * 0.03) * 14 + Math.sin(x * 0.11) * 6;
      ctx.fillRect(x, GROUND_Y - h, 4, h);
    }
    // Plataforma flutuante de tijolos.
    this.bricks(110, 150, 96, 12);
    // Chão de tijolos.
    this.bricks(0, GROUND_Y, DEMO_WIDTH, DEMO_HEIGHT - GROUND_Y);
    // Tocha com fogo tremulando.
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(296, GROUND_Y - 30, 4, 30);
    const flame = 6 + Math.sin(this.time * 18) * 2;
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(294, GROUND_Y - 30 - flame, 8, flame);
    ctx.fillStyle = '#ffe14a';
    ctx.fillRect(296, GROUND_Y - 28 - flame / 2, 4, flame / 2);
    // Moedas girando.
    for (const coin of this.coins) {
      if (coin.taken) continue;
      const w = Math.max(1, Math.abs(Math.cos(this.time * 4 + coin.x)) * 8);
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(coin.x - w / 2, coin.y - 5, w, 10);
      ctx.fillStyle = '#fff6b0';
      ctx.fillRect(coin.x - w / 4, coin.y - 3, Math.max(1, w / 4), 4);
    }
    // Lasers.
    for (const laser of this.lasers) {
      ctx.fillStyle = laser.color;
      ctx.fillRect(laser.x, laser.y, 40, 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(laser.x + 4, laser.y, 32, 1);
    }
    this.drawPlayer();
    // HUD: texto branco, o pior caso para relevo e extrusão.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`SCORE ${String(this.score).padStart(6, '0')}`, 8, 6);
    ctx.fillText(`TIME ${String(300 - (Math.floor(this.time) % 300)).padStart(3, '0')}`, 250, 6);
    ctx.fillStyle = '#ff4d6d';
    for (let i = 0; i < 3; i++) ctx.fillRect(8 + i * 10, 20, 7, 6);
  }

  private bricks(x: number, y: number, w: number, h: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#7a3b22';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3d1c10';
    for (let row = 0; row * 8 < h; row++) {
      ctx.fillRect(x, y + row * 8, w, 1);
      const offset = row % 2 === 0 ? 0 : 8;
      for (let col = x + offset; col < x + w; col += 16) ctx.fillRect(col, y + row * 8, 1, 8);
    }
    ctx.fillStyle = '#b25a32';
    ctx.fillRect(x, y, w, 1);
  }

  private drawPlayer(): void {
    const { ctx } = this;
    const { x, y, facing } = this.player;
    const px = Math.round(x);
    const py = Math.round(y);
    ctx.fillStyle = '#2b6cff'; // corpo
    ctx.fillRect(px + 2, py + 4, 12, 10);
    ctx.fillStyle = '#9ec1ff'; // capacete
    ctx.fillRect(px + 3, py, 10, 6);
    ctx.fillStyle = '#ffe14a'; // visor
    ctx.fillRect(facing > 0 ? px + 8 : px + 3, py + 2, 5, 2);
    ctx.fillStyle = '#1a2a55'; // pernas
    const step = Math.abs(this.pad.x) > 0 && Math.sin(this.time * 20) > 0 ? 2 : 0;
    ctx.fillRect(px + 3, py + 14, 4, 2 + step);
    ctx.fillRect(px + 9, py + 14, 4, 4 - step);
  }
}
