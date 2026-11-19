import { signal } from '@preact/signals-core';

export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  readonly id: number;
  readonly time: number;
  readonly level: LogLevel;
  readonly message: string;
}

const MAX_ENTRIES = 200;

/** Log visível na UI (e no console). Mensagens 'debug' só aparecem com ?debug=1. */
export class Logger {
  readonly entries = signal<readonly LogEntry[]>([]);
  private nextId = 1;

  constructor(private readonly debugEnabled = false) {}

  debug(message: string): void {
    if (this.debugEnabled) this.add('debug', message);
  }
  info(message: string): void {
    this.add('info', message);
  }
  success(message: string): void {
    this.add('success', message);
  }
  warn(message: string): void {
    this.add('warn', message);
  }
  error(message: string, cause?: unknown): void {
    this.add('error', cause instanceof Error ? `${message}: ${cause.message}` : message);
  }

  private add(level: LogLevel, message: string): void {
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method](`[onlemu] ${message}`);
    const entry: LogEntry = { id: this.nextId++, time: Date.now(), level, message };
    this.entries.value = [entry, ...this.entries.value].slice(0, MAX_ENTRIES);
  }
}

export const isDebugEnabled = (): boolean => new URLSearchParams(location.search).has('debug');
