import { describe, expect, it } from 'vitest';
import { buttonMask } from '../../src/core/input/pad';
import { decodeInput, encodeInput, INPUT_CODEC_VERSION } from '../../src/core/protocol/inputCodec';

describe('inputCodec', () => {
  it('ida e volta preserva o pacote', () => {
    const packet = {
      seq: 65535,
      players: [
        { local: 0, pad: { buttons: buttonMask('A') | buttonMask('Z'), x: -127, y: 64 } },
        { local: 3, pad: { buttons: 0, x: 0, y: 127 } },
      ],
    };
    expect(decodeInput(encodeInput(packet))).toEqual(packet);
  });

  it('usa 5 bytes por jogador mais 4 de cabeçalho', () => {
    expect(encodeInput({ seq: 1, players: [{ local: 0, pad: { buttons: 0, x: 0, y: 0 } }] }).byteLength).toBe(
      9,
    );
  });

  it('rejeita seq fora do intervalo ao codificar', () => {
    expect(() => encodeInput({ seq: 70000, players: [] })).toThrow(RangeError);
  });

  describe('rejeita pacotes malformados', () => {
    const valid = () =>
      new Uint8Array(encodeInput({ seq: 1, players: [{ local: 0, pad: { buttons: 1, x: 0, y: 0 } }] }));

    it.each([
      ['não é ArrayBuffer', 'texto'],
      ['curto demais', new ArrayBuffer(2)],
    ])('%s', (_, data) => expect(decodeInput(data)).toBeNull());

    it('versão diferente', () => {
      const bytes = valid();
      bytes[0] = INPUT_CODEC_VERSION + 1;
      expect(decodeInput(bytes.buffer)).toBeNull();
    });

    it('tamanho não bate com a quantidade', () => {
      const bytes = valid();
      bytes[3] = 2;
      expect(decodeInput(bytes.buffer)).toBeNull();
    });

    it('bits de botão desconhecidos', () => {
      const bytes = valid();
      bytes[6] = 0xff; // byte alto do bitmask: bits 8..15, incluindo os não usados
      expect(decodeInput(bytes.buffer)).toBeNull();
    });

    it('analógico -128 (fora do limite de -127..127)', () => {
      const bytes = valid();
      bytes[7] = 0x80;
      expect(decodeInput(bytes.buffer)).toBeNull();
    });
  });
});
