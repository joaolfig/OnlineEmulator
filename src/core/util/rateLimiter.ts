/** Limitador de taxa simples (janela de 1 s). `now` é injetado para facilitar testes. */
export class RateLimiter {
  private windowStart = -Infinity;
  private count = 0;

  constructor(
    private readonly maxPerSecond: number,
    private readonly now: () => number,
  ) {}

  /** true se a ação pode acontecer agora. */
  tryConsume(): boolean {
    const t = this.now();
    if (t - this.windowStart >= 1000) {
      this.windowStart = t;
      this.count = 0;
    }
    if (this.count >= this.maxPerSecond) return false;
    this.count++;
    return true;
  }
}
