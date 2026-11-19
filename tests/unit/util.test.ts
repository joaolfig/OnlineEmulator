import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../../src/core/util/rateLimiter';
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
} from '../../src/core/util/roomCode';

describe('roomCode', () => {
  it('gera códigos só com o alfabeto sem ambíguos', () => {
    const code = generateRoomCode(6, () => Uint8Array.from([0, 31, 32, 255, 8, 100]));
    expect(code).toHaveLength(6);
    expect(isValidRoomCode(code, 6)).toBe(true);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01IO]/);
  });

  it('normaliza e valida o que o usuário digita', () => {
    expect(normalizeRoomCode('  k7qx2m ')).toBe('K7QX2M');
    expect(isValidRoomCode('K7QX2M', 6)).toBe(true);
    expect(isValidRoomCode('K7QX2', 6)).toBe(false);
    expect(isValidRoomCode('K7QX2O', 6)).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('limita por janela de 1 segundo', () => {
    let now = 0;
    const limiter = new RateLimiter(2, () => now);
    expect([limiter.tryConsume(), limiter.tryConsume(), limiter.tryConsume()]).toEqual([true, true, false]);
    now = 1000;
    expect(limiter.tryConsume()).toBe(true);
  });
});
