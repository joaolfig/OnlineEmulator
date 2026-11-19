import { describe, expect, it } from 'vitest';
import { boxArtUrl, initials, splitGameName } from '../../src/core/catalog/thumbnails';
import { detectN64ByteOrder, toZ64 } from '../../src/core/rom/n64';
import { statesToPrune } from '../../src/core/saves/retention';

describe('ROM de N64: ordem dos bytes', () => {
  const z64 = Uint8Array.from([0x80, 0x37, 0x12, 0x40, 1, 2, 3, 4]);
  const v64 = Uint8Array.from([0x37, 0x80, 0x40, 0x12, 2, 1, 4, 3]);
  const n64 = Uint8Array.from([0x40, 0x12, 0x37, 0x80, 4, 3, 2, 1]);

  it('detecta as três ordens', () => {
    expect(detectN64ByteOrder(z64)).toBe('z64');
    expect(detectN64ByteOrder(v64)).toBe('v64');
    expect(detectN64ByteOrder(n64)).toBe('n64');
    expect(detectN64ByteOrder(Uint8Array.from([1, 2, 3, 4]))).toBeNull();
  });

  it('converte .v64 e .n64 para .z64', () => {
    expect(toZ64(v64)).toEqual(z64);
    expect(toZ64(n64)).toEqual(z64);
    expect(toZ64(z64)).toBe(z64);
  });

  it('não converte arquivos que não são de N64', () => {
    expect(toZ64(Uint8Array.from([0, 0, 0, 0]))).toBeNull();
  });
});

describe('capas e nomes do catálogo', () => {
  it('monta a URL do libretro trocando caracteres proibidos por _', () => {
    expect(boxArtUrl('Nintendo - Nintendo 64', 'Mario Party 2 (USA)')).toBe(
      'https://thumbnails.libretro.com/Nintendo%20-%20Nintendo%2064/Named_Boxarts/Mario%20Party%202%20(USA).png',
    );
    expect(boxArtUrl('X', 'A: B & C?')).toContain(encodeURIComponent('A_ B _ C_.png'));
  });

  it('separa título e marcações', () => {
    expect(splitGameName('Mario Party 2 (USA) (Rev 1)')).toEqual({
      title: 'Mario Party 2',
      tags: 'USA · Rev 1',
    });
    expect(splitGameName('meu_jogo')).toEqual({ title: 'meu_jogo', tags: '' });
  });

  it('gera iniciais para a capa genérica', () => {
    expect(initials('Mario Party 2')).toBe('MP2');
    expect(initials('Super Smash Bros.')).toBe('SSB');
    expect(initials('')).toBe('?');
  });
});

describe('retenção de savestates', () => {
  it('mantém os mais recentes e apaga o resto', () => {
    const states = [
      { id: 'a', createdAt: 1 },
      { id: 'b', createdAt: 4 },
      { id: 'c', createdAt: 2 },
      { id: 'd', createdAt: 3 },
    ];
    expect(statesToPrune(states, 3)).toEqual(['a']);
    expect(statesToPrune(states, 10)).toEqual([]);
  });
});
