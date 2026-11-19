import { ALL_BUTTONS_MASK, AXIS_LIMIT, type PadState } from '../input/pad';
import { SEQ_MODULO } from './seq';

/**
 * Formato binário do pacote de input (little-endian):
 *   [u8 versão][u16 seq][u8 qtd] + qtd × ([u8 jogadorLocal][u16 botões][i8 x][i8 y])
 */
export const INPUT_CODEC_VERSION = 1;
const HEADER_BYTES = 4;
const PLAYER_BYTES = 5;
export const MAX_LOCAL_PLAYERS = 4;

export interface LocalPad {
  readonly local: number;
  readonly pad: PadState;
}

export interface InputPacket {
  readonly seq: number;
  readonly players: readonly LocalPad[];
}

export function encodeInput(packet: InputPacket): ArrayBuffer {
  const { seq, players } = packet;
  if (!Number.isInteger(seq) || seq < 0 || seq >= SEQ_MODULO) throw new RangeError(`seq inválido: ${seq}`);
  if (players.length > MAX_LOCAL_PLAYERS) throw new RangeError('jogadores locais demais');
  const buffer = new ArrayBuffer(HEADER_BYTES + players.length * PLAYER_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, INPUT_CODEC_VERSION);
  view.setUint16(1, seq, true);
  view.setUint8(3, players.length);
  players.forEach(({ local, pad }, i) => {
    const offset = HEADER_BYTES + i * PLAYER_BYTES;
    view.setUint8(offset, local);
    view.setUint16(offset + 1, pad.buttons & ALL_BUTTONS_MASK, true);
    view.setInt8(offset + 3, pad.x);
    view.setInt8(offset + 4, pad.y);
  });
  return buffer;
}

/** Decodifica e valida. Retorna null para qualquer pacote malformado (vem da rede: não confiar). */
export function decodeInput(data: unknown): InputPacket | null {
  if (!(data instanceof ArrayBuffer) || data.byteLength < HEADER_BYTES) return null;
  const view = new DataView(data);
  if (view.getUint8(0) !== INPUT_CODEC_VERSION) return null;
  const count = view.getUint8(3);
  if (count > MAX_LOCAL_PLAYERS || data.byteLength !== HEADER_BYTES + count * PLAYER_BYTES) return null;

  const players: LocalPad[] = [];
  for (let i = 0; i < count; i++) {
    const offset = HEADER_BYTES + i * PLAYER_BYTES;
    const local = view.getUint8(offset);
    const buttons = view.getUint16(offset + 1, true);
    const x = view.getInt8(offset + 3);
    const y = view.getInt8(offset + 4);
    const valid =
      local < MAX_LOCAL_PLAYERS &&
      (buttons & ~ALL_BUTTONS_MASK) === 0 &&
      Math.abs(x) <= AXIS_LIMIT &&
      Math.abs(y) <= AXIS_LIMIT;
    if (!valid) return null;
    players.push({ local, pad: { buttons, x, y } });
  }
  return { seq: view.getUint16(1, true), players };
}
