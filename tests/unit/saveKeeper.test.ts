import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmulatorSaves } from '../../src/adapters/emulator/types';
import type { StateMeta } from '../../src/adapters/storage/stateStore';
import { SaveKeeper } from '../../src/app/host/saveKeeper';
import { Logger } from '../../src/app/logger';

function setup(overrides: Partial<EmulatorSaves> = {}) {
  const log: string[] = [];
  const saves: EmulatorSaves = {
    saveExtension: 'eep',
    flushSave: vi.fn(async () => void log.push('flush')),
    exportSave: () => null,
    importSave: () => {},
    exportState: vi.fn(() => {
      log.push('state');
      return new Uint8Array([1, 2, 3]);
    }),
    importState: () => {},
    ...overrides,
  };
  const stateStore = {
    save: vi.fn(async (romId: string, data: Uint8Array, emulatorVersion: string): Promise<StateMeta> => ({
      id: 'x',
      romId,
      createdAt: 0,
      size: data.length,
      emulatorVersion,
    })),
  };
  const logger = new Logger();
  const keeper = new SaveKeeper({
    saves,
    stateStore,
    romId: 'rom1',
    emulatorVersion: '4.2.3',
    logger,
    cartridgeFlushIntervalMs: 60_000,
    autoStateIntervalMs: 300_000,
    now: () => 1234,
  });
  return { saves, stateStore, logger, keeper, log };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SaveKeeper', () => {
  it('grava o cartucho a cada minuto e o estado a cada 5 minutos', async () => {
    const { saves, stateStore, keeper } = setup();
    keeper.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(saves.flushSave).toHaveBeenCalledTimes(1);
    expect(stateStore.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(240_000);
    expect(saves.flushSave).toHaveBeenCalledTimes(5);
    expect(stateStore.save).toHaveBeenCalledWith('rom1', new Uint8Array([1, 2, 3]), '4.2.3');
    keeper.stop();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(saves.flushSave).toHaveBeenCalledTimes(5);
  });

  it('saveAll grava os dois e atualiza os horários', async () => {
    const { keeper } = setup();
    await keeper.saveAll();
    expect(keeper.lastCartridgeSave.value).toBe(1234);
    expect(keeper.lastStateSave.value).toBe(1234);
  });

  it('nunca roda duas gravações ao mesmo tempo', async () => {
    let release: () => void = () => {};
    const { keeper, log } = setup({
      flushSave: () =>
        new Promise<void>((resolve) => {
          log.push('flush-start');
          release = () => {
            log.push('flush-end');
            resolve();
          };
        }),
    });
    const all = keeper.saveAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(['flush-start']);
    release();
    await all;
    expect(log).toEqual(['flush-start', 'flush-end', 'state']);
  });

  it('uma falha é registrada e não trava as próximas gravações', async () => {
    const { keeper, logger, saves } = setup({
      flushSave: vi.fn().mockRejectedValueOnce(new Error('disco cheio')).mockResolvedValue(undefined),
    });
    await keeper.flushCartridge();
    expect(logger.entries.value[0]?.message).toContain('disco cheio');
    await keeper.flushCartridge();
    expect(saves.flushSave).toHaveBeenCalledTimes(2);
    expect(keeper.lastCartridgeSave.value).toBe(1234);
  });
});
