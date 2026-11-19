import { describe, expect, it } from 'vitest';
import { parseGuestMessage, parseHostMessage, PROTOCOL_VERSION } from '../../src/core/protocol/messages';

describe('parseGuestMessage', () => {
  it('aceita hello, limpa espaços do nome e assume o modo "play" se não vier', () => {
    expect(parseGuestMessage({ type: 'hello', v: PROTOCOL_VERSION, name: '  Ana  ' })).toEqual({
      type: 'hello',
      v: PROTOCOL_VERSION,
      name: 'Ana',
      mode: 'play',
    });
  });

  it('aceita os modos de aparelho', () => {
    for (const mode of ['play', 'controller', 'watch']) {
      expect(parseGuestMessage({ type: 'hello', v: 1, name: 'Ana', mode })).toMatchObject({ mode });
    }
  });

  it.each([
    ['modo desconhecido', { type: 'hello', v: 1, name: 'Ana', mode: 'admin' }],
    ['tipo desconhecido', { type: 'hack' }],
    ['nome vazio', { type: 'hello', v: 1, name: '   ' }],
    ['nome longo demais', { type: 'hello', v: 1, name: 'x'.repeat(100) }],
    ['nome com tipo errado', { type: 'hello', v: 1, name: 42 }],
    ['ping sem timestamp', { type: 'ping' }],
    ['rtt negativo', { type: 'rtt', ms: -5 }],
    ['rtt infinito', { type: 'rtt', ms: Infinity }],
    ['null', null],
    ['string', 'hello'],
  ])('rejeita %s', (_, data) => expect(parseGuestMessage(data)).toBeNull());
});

describe('parseHostMessage', () => {
  it('aceita welcome com porta e como espectador', () => {
    expect(parseHostMessage({ type: 'welcome', port: 2 })).toEqual({ type: 'welcome', port: 2 });
    expect(parseHostMessage({ type: 'welcome', port: null })).toEqual({ type: 'welcome', port: null });
  });

  it.each([
    ['porta fora do console', { type: 'port', port: 7 }],
    ['porta fracionária', { type: 'port', port: 1.5 }],
    ['código de erro desconhecido', { type: 'error', code: 'boom' }],
  ])('rejeita %s', (_, data) => expect(parseHostMessage(data)).toBeNull());
});

describe('avisos de tempo', () => {
  it('aceita velocidade e voltar no tempo dentro dos limites', () => {
    expect(parseHostMessage({ type: 'speed', multiplier: 2 })).toEqual({ type: 'speed', multiplier: 2 });
    expect(parseHostMessage({ type: 'rewound', seconds: 30 })).toEqual({ type: 'rewound', seconds: 30 });
  });

  it.each([
    ['velocidade absurda', { type: 'speed', multiplier: 1000 }],
    ['velocidade menor que 1', { type: 'speed', multiplier: 0 }],
    ['voltar segundos negativos', { type: 'rewound', seconds: -10 }],
  ])('rejeita %s', (_, data) => expect(parseHostMessage(data)).toBeNull());
});
