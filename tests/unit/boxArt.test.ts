import { describe, expect, it } from 'vitest';
import { romBoxArtUrl } from '../../src/adapters/catalog/boxArt';
import type { RomMeta } from '../../src/adapters/storage/romLibrary';

const rom = (overrides: Partial<RomMeta>): RomMeta => ({
  id: 'x',
  name: 'Jogo',
  fileName: 'Jogo.z64',
  size: 1,
  addedAt: 0,
  lastPlayedAt: null,
  ...overrides,
});

describe('capas de todos os consoles', () => {
  it('N64 usa o nome do catálogo; sem catálogo, sem capa', () => {
    expect(romBoxArtUrl(rom({ catalogName: 'Mario Party 2 (USA)' }))).toContain(
      'Nintendo%20-%20Nintendo%2064/Named_Boxarts/Mario%20Party%202%20(USA).png',
    );
    expect(romBoxArtUrl(rom({ catalogName: null }))).toBeNull();
  });

  it('outros consoles usam o nome do arquivo na pasta do console', () => {
    const snes = rom({
      system: 'snes',
      name: 'Super Mario World (USA)',
      fileName: 'Super Mario World (USA).sfc',
    });
    expect(romBoxArtUrl(snes)).toContain(
      'Super%20Nintendo%20Entertainment%20System/Named_Boxarts/Super%20Mario',
    );
  });

  it('Game Boy e Game Boy Color têm pastas diferentes', () => {
    expect(romBoxArtUrl(rom({ system: 'gb', name: 'Tetris', fileName: 'Tetris.gb' }))).toContain(
      encodeURIComponent('Nintendo - Game Boy') + '/',
    );
    expect(romBoxArtUrl(rom({ system: 'gb', name: 'Zelda', fileName: 'Zelda.gbc' }))).toContain(
      encodeURIComponent('Nintendo - Game Boy Color'),
    );
  });
});
