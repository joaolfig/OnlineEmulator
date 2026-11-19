import { afterEach, describe, expect, it } from 'vitest';
import type { Emulator } from '../../src/adapters/emulator/types';
import { MemoryNetwork } from '../../src/adapters/net/memory';
import { GuestSession } from '../../src/app/guest/guestSession';
import { HostSession } from '../../src/app/host/hostSession';
import { Logger } from '../../src/app/logger';
import { buttonMask, EMPTY_PAD, type PadState } from '../../src/core/input/pad';
import { encodeInput } from '../../src/core/protocol/inputCodec';
import { HOST_ID, type DeviceMode } from '../../src/core/room/room';

/** Emulador de mentira que só registra o que recebeu. */
class RecordingEmulator implements Emulator {
  readonly saves = null;
  readonly inputs = new Map<number, PadState>();
  readonly released: number[] = [];
  start = () => Promise.resolve();
  captureStream = () => Promise.resolve(FAKE_STREAM);
  destroy = () => {};
  setInput(port: number, pad: PadState) {
    this.inputs.set(port, pad);
  }
  releaseAll(port: number) {
    this.released.push(port);
    this.inputs.set(port, EMPTY_PAD);
  }
}

// MediaStream não existe no Node; o transporte em memória só repassa o objeto.
const FAKE_STREAM = { id: 'fake-stream' } as unknown as MediaStream;
const A = { buttons: buttonMask('A'), x: 0, y: 0 };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let clock = 0;
const now = () => clock;
const sessions: { close(): void }[] = [];

async function setup() {
  const network = new MemoryNetwork();
  const emulator = new RecordingEmulator();
  const logger = new Logger();
  let seed = 0;
  const host = new HostSession({
    emulator,
    transport: network.createHost(),
    logger,
    hostName: 'Host',
    randomBytes: (n) => Uint8Array.from({ length: n }, () => seed++),
    now,
  });
  sessions.push(host);
  await host.open(FAKE_STREAM);
  const code = host.roomCode.value ?? '';

  const addGuest = async (name: string, mode: DeviceMode = 'play') => {
    const guest = new GuestSession({ transport: network.createGuest(), logger, now });
    sessions.push({ close: () => guest.leave() });
    await guest.join(code, name, mode);
    await flush();
    return guest;
  };
  return { network, emulator, host, code, addGuest };
}

afterEach(() => {
  sessions.splice(0).forEach((s) => s.close());
  clock = 0;
});

describe('host + convidados (transporte em memória)', () => {
  it('convidado entra, recebe a porta e o vídeo', async () => {
    const { host, addGuest } = await setup();
    const guest = await addGuest('Ana');
    expect(guest.status.value).toBe('connected');
    expect(guest.port.value).toBe(1);
    expect(guest.stream.value).toBe(FAKE_STREAM);
    expect(host.room.value.participants.map((p) => p.name)).toEqual(['Host', 'Ana']);
    expect(guest.lobby.value).toHaveLength(2);
  });

  it('controle do convidado chega no emulador na porta dele', async () => {
    const { emulator, addGuest } = await setup();
    const guest = await addGuest('Ana');
    guest.tick(A);
    expect(emulator.inputs.get(1)).toEqual(A);
  });

  it('não reenvia o mesmo estado antes do heartbeat, mas reenvia depois', async () => {
    const { emulator, addGuest } = await setup();
    const guest = await addGuest('Ana');
    guest.tick(A);
    emulator.inputs.clear();
    clock += 10;
    guest.tick(A);
    expect(emulator.inputs.has(1)).toBe(false);
    clock += 100;
    guest.tick(A);
    expect(emulator.inputs.get(1)).toEqual(A);
  });

  it('descarta pacotes antigos (seq repetido)', async () => {
    const { network, emulator, code } = await setup();
    const link = await network.createGuest().join(code);
    link.sendControl({ type: 'hello', v: 1, name: 'Bot' });
    link.sendInput(encodeInput({ seq: 5, players: [{ local: 0, pad: A }] }));
    link.sendInput(encodeInput({ seq: 4, players: [{ local: 0, pad: EMPTY_PAD }] }));
    expect(emulator.inputs.get(1)).toEqual(A);
  });

  it('trocar portas avisa os convidados e solta os botões das duas portas', async () => {
    const { host, emulator, addGuest } = await setup();
    const guest = await addGuest('Ana');
    const guestId = host.room.value.participants[1]?.id ?? '';
    host.setPort(guestId, 0);
    await flush();
    expect(guest.port.value).toBe(0);
    expect(emulator.released).toEqual(expect.arrayContaining([0, 1]));
    // Agora o controle do convidado vai para o P1 e o do host para o P2.
    guest.tick(A);
    expect(emulator.inputs.get(0)).toEqual(A);
    host.setLocalPad(A);
    expect(emulator.inputs.get(1)).toEqual(A);
    expect(host.room.value.participants.find((p) => p.id === HOST_ID)?.port).toBe(1);
  });

  it('convidado que sai libera a porta e solta os botões', async () => {
    const { host, emulator, addGuest } = await setup();
    const guest = await addGuest('Ana');
    guest.tick(A);
    guest.leave();
    await flush();
    expect(emulator.released).toContain(1);
    expect(host.room.value.participants).toHaveLength(1);
  });

  it('quinto jogador entra como espectador e não controla nada', async () => {
    const { emulator, addGuest } = await setup();
    for (const name of ['B', 'C', 'D']) await addGuest(name);
    const fifth = await addGuest('E');
    expect(fifth.port.value).toBeNull();
    emulator.inputs.clear();
    fifth.tick(A);
    expect(emulator.inputs.size).toBe(0);
  });

  it('ignora inputs e mensagens de quem não mandou hello', async () => {
    const { network, emulator, host, code } = await setup();
    const link = await network.createGuest().join(code);
    link.sendInput(encodeInput({ seq: 1, players: [{ local: 0, pad: A }] }));
    link.sendControl({ type: 'hack', payload: 'x' });
    expect(emulator.inputs.size).toBe(0);
    expect(host.room.value.participants).toHaveLength(1);
  });

  it('recusa versão de protocolo diferente', async () => {
    const { network, host, code } = await setup();
    const link = await network.createGuest().join(code);
    const received: unknown[] = [];
    link.onControl((m) => received.push(m));
    link.sendControl({ type: 'hello', v: 999, name: 'Velho' });
    expect(received).toContainEqual({ type: 'error', code: 'version-mismatch' });
    expect(link.isOpen).toBe(false);
    expect(host.room.value.participants).toHaveLength(1);
  });

  it('aparelho "só controle" ganha porta e controla, mas não recebe vídeo', async () => {
    const { emulator, addGuest } = await setup();
    const phone = await addGuest('Celular', 'controller');
    expect(phone.port.value).toBe(1);
    expect(phone.stream.value).toBeNull();
    phone.tick(A);
    expect(emulator.inputs.get(1)).toEqual(A);
  });

  it('aparelho "só assistir" recebe vídeo como espectador e não ocupa porta', async () => {
    const { host, addGuest } = await setup();
    const tv = await addGuest('TV', 'watch');
    expect(tv.port.value).toBeNull();
    expect(tv.stream.value).toBe(FAKE_STREAM);
    const player = await addGuest('Ana');
    expect(player.port.value).toBe(1);
    // O host não consegue colocar a TV numa porta.
    host.setPort(host.room.value.participants.find((p) => p.name === 'TV')?.id ?? '', 2);
    expect(tv.port.value).toBeNull();
  });

  it('sala inexistente gera erro amigável', async () => {
    const network = new MemoryNetwork();
    const guest = new GuestSession({ transport: network.createGuest(), logger: new Logger(), now });
    sessions.push({ close: () => guest.leave() });
    await guest.join('ZZZZZZ', 'Ana');
    expect(guest.status.value).toBe('error');
    expect(guest.error.value).toBe('room-not-found');
  });
});
