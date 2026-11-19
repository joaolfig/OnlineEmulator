import type { Unsubscribe } from './types';

/** Emissor de eventos mínimo e tipado. */
export class Emitter<T extends unknown[]> {
  private readonly handlers = new Set<(...args: T) => void>();

  on(handler: (...args: T) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(...args: T): void {
    for (const handler of [...this.handlers]) handler(...args);
  }

  clear(): void {
    this.handlers.clear();
  }
}
