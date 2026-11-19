import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmulatorSaves } from '../../src/adapters/emulator/types';
import { RewindBuffer } from '../../src/app/host/rewindBuffer';
import { Logger } from '../../src/app/logger';
import { pushSnapshot, rewindReachMs, snapshotIndexFor } from '../../src/core/saves/rewind';

const snaps = (...times: number[]) => times.map((time) => ({ time, data: time }));

describe('regras do voltar no tempo', () => {
  it('guarda só as últimas fotos', () => {
    let list = snaps();
    for (const time of [1, 2, 3, 4]) list = pushSnapshot(list, { time, data: time }, 3);
    expect(list.map((s) => s.time)).toEqual([2, 3, 4]);
  });

  it('escolhe a foto mais recente que tenha pelo menos a idade pedida', () => {
    const list = snaps(10_000, 20_000, 30_000, 40_000);
    expect(snapshotIndexFor(list, 45_000, 10_000)).toBe(2); // foto de 30 s (15 s atrás)
    expect(snapshotIndexFor(list, 45_000, 5_000)).toBe(3);
    expect(snapshotIndexFor(list, 45_000, 60_000)).toBeNull();
  });

  it('calcula até onde dá para voltar', () => {
    expect(rewindReachMs(snaps(), 50)).toBe(0);
    expect(rewindReachMs(snaps(10, 20), 50)).toBe(40);
  });
});

/** "Emulador" cujo estado é só um número: fácil de conferir para onde voltou. */
function setup() {
  let current = 0;
  let clock = 0;
  const saves: EmulatorSaves = {
    saveExtension: 'eep',
    flushSave: () => Promise.resolve(),
    exportSave: () => null,
    importSave: () => {},
    exportState: () => Uint8Array.of(current),
    importState: (data) => {
      current = data[0] ?? -1;
    },
  };
  const buffer = new RewindBuffer({
    saves,
    logger: new Logger(),
    intervalMs: 10_000,
    capacity: 30,
    compress: async (d) => d,
    decompress: async (d) => d,
    now: () => clock,
  });
  return {
    buffer,
    play: (state: number, ms: number) => {
      current = state;
      clock += ms;
    },
    state: () => current,
    tick: (ms: number) => (clock += ms),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RewindBuffer', () => {
  it('tira uma foto ao começar e depois a cada intervalo', async () => {
    const { buffer } = setup();
    buffer.start();
    await vi.advanceTimersByTimeAsync(35_000);
    expect(buffer.times.value).toHaveLength(4);
    buffer.stop();
  });

  it('volta para a foto certa, descarta o "futuro" e permite desfazer', async () => {
    const { buffer, play, state } = setup();
    for (const s of [1, 2, 3, 4]) {
      play(s, 10_000);
      await buffer.capture();
    }
    play(5, 5_000); // estado atual, 5 s depois da última foto (clock = 45 s)

    expect(await buffer.rewind(30)).toBe(true); // alvo: 15 s → foto do estado 1 (tirada aos 10 s)
    expect(state()).toBe(1);
    expect(buffer.times.value).toEqual([10_000]);
    expect(buffer.canUndo.value).toBe(true);

    await buffer.undoRewind();
    expect(state()).toBe(5);
    expect(buffer.canUndo.value).toBe(false);
  });

  it('não faz nada se ainda não houver foto tão antiga', async () => {
    const { buffer, play, state } = setup();
    play(1, 1_000);
    await buffer.capture();
    play(2, 1_000);
    expect(await buffer.rewind(60)).toBe(false);
    expect(state()).toBe(2);
    expect(buffer.canUndo.value).toBe(false);
  });

  it('conta a memória usada pelas fotos', async () => {
    const { buffer } = setup();
    await buffer.capture();
    await buffer.capture();
    expect(buffer.memoryBytes.value).toBe(2);
  });
});
