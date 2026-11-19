import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Emulator } from '../../src/adapters/emulator/types';
import { MemoryNetwork } from '../../src/adapters/net/memory';
import { GuestSession } from '../../src/app/guest/guestSession';
import { HostSession, type HostSessionDeps } from '../../src/app/host/hostSession';
import { Logger } from '../../src/app/logger';
import { buttonMask, EMPTY_PAD, type PadState } from '../../src/core/input/pad';
import { encodeInput } from '../../src/core/protocol/inputCodec';
import { HOST_ID, type DeviceMode } from '../../src/core/room/room';
import type { Avatar } from '../../src/core/social';

/** Emulador de mentira que só registra o que recebeu. */
class RecordingEmulator implements Emulator {
  readonly saves = null;
  readonly inputs = new Map<number, PadState>();
  readonly released: number[] = [];
  speed = 1;
  /** Porta dos controles do próprio PC (null = espectador). */
  localPort: number | null = 0;
  setLocalPort(port: number | null) {
    this.localPort = port;
  }
  start = () => Promise.resolve();
  setSpeed(multiplier: number) {
    this.speed = multiplier;
  }
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

async function setup(options: Partial<Pick<HostSessionDeps, 'portCount' | 'layout'>> = {}) {
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
    ...options,
  });
  sessions.push(host);
  await host.open(FAKE_STREAM);
  const code = host.roomCode.value ?? '';

  const addGuest = async (name: string, mode: DeviceMode = 'play', avatar?: Avatar) => {
    const guest = new GuestSession({ transport: network.createGuest(), logger, now });
    sessions.push({ close: () => guest.leave() });
    await guest.join(code, name, mode, avatar);
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

  it('acelerar muda o emulador e avisa quem está na sala e quem entra depois', async () => {
    const { host, emulator, addGuest } = await setup();
    const ana = await addGuest('Ana');
    host.setSpeed(3);
    expect(emulator.speed).toBe(3);
    expect(ana.speed.value).toBe(3);
    const bia = await addGuest('Bia');
    expect(bia.speed.value).toBe(3);
    host.setSpeed(99);
    expect(emulator.speed).toBe(8); // limitado ao máximo
    host.setSpeed(1);
    expect(ana.speed.value).toBe(1);
  });

  it('convidados recebem o aviso de voltar no tempo', async () => {
    const { host, addGuest } = await setup();
    const ana = await addGuest('Ana');
    host.notifyRewound(30);
    expect(ana.rewound.value?.seconds).toBe(30);
  });

  it('console de 2 portas (SNES): o terceiro jogador vira espectador', async () => {
    const { addGuest } = await setup({ portCount: 2 });
    expect((await addGuest('Ana')).port.value).toBe(1);
    expect((await addGuest('Bia')).port.value).toBeNull();
  });

  it('convidado recebe o layout de botões do console', async () => {
    const { addGuest } = await setup({ layout: 'retropad' });
    expect((await addGuest('Ana')).layout.value).toBe('retropad');
    const n64 = await setup();
    expect((await n64.addGuest('Bia')).layout.value).toBe('n64');
  });

  it('PC como tela e celular como controle: host espectador, celular no P1', async () => {
    const { host, emulator, addGuest } = await setup();
    const phone = await addGuest('Celular', 'controller');
    host.setPort(HOST_ID, null);
    expect(emulator.localPort).toBeNull(); // o teclado do PC não controla ninguém
    host.setPort(host.room.value.participants[1]?.id ?? '', 0);
    await flush();
    expect(phone.port.value).toBe(0);
    phone.tick(A);
    expect(emulator.inputs.get(0)).toEqual(A);
  });

  it('os controles do PC seguem a porta do host (inclusive numa troca)', async () => {
    const { host, emulator, addGuest } = await setup();
    await addGuest('Ana');
    host.setPort(host.room.value.participants[1]?.id ?? '', 0); // Ana pega o P1, host vai para o P2
    expect(emulator.localPort).toBe(1);
    host.setPort(HOST_ID, 3);
    expect(emulator.localPort).toBe(3);
  });

  it('convidado repete o "olá" e mostra erro se o host nunca responder', async () => {
    vi.useFakeTimers();
    try {
      const network = new MemoryNetwork();
      const silentHost = network.createHost(); // sala aberta, mas ninguém responde
      await silentHost.open('SILENT');
      const hellos: unknown[] = [];
      silentHost.onLink((link) => link.onControl((m) => hellos.push(m)));
      const guest = new GuestSession({ transport: network.createGuest(), logger: new Logger(), now });
      sessions.push({ close: () => guest.leave() });
      await guest.join('SILENT', 'Ana');
      for (let i = 0; i < 4; i++) {
        clock += 1500;
        await vi.advanceTimersByTimeAsync(1500);
      }
      expect(hellos.filter((m) => (m as { type: string }).type === 'hello').length).toBeGreaterThan(1);
      expect(guest.status.value).toBe('connecting');
      clock += 15_000;
      await vi.advanceTimersByTimeAsync(1500);
      expect(guest.status.value).toBe('error');
      expect(guest.error.value).toBe('network');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reações chegam a todos com nome e boneco, respeitando o intervalo mínimo', async () => {
    const { host, addGuest } = await setup();
    const ana = await addGuest('Ana', 'play', '🐙');
    const cam = await addGuest('Cam');
    expect(ana.react('lol')).toBe(true);
    expect(ana.react('nooo')).toBe(false); // cedo demais
    await flush();
    const expected = { reaction: 'lol', name: 'Ana', avatar: '🐙' };
    expect(host.reactions.value.at(-1)).toMatchObject(expected);
    expect(cam.reactions.value.at(-1)).toMatchObject(expected);
    clock += 2000;
    host.react('nice');
    await flush();
    expect(cam.reactions.value.at(-1)).toMatchObject({ reaction: 'nice', name: 'Host' });
  });

  it('o boneco escolhido aparece para todos; "Só controle" não manda reação', async () => {
    const { host, addGuest } = await setup();
    const ana = await addGuest('Ana', 'play', '🦖');
    const controller = await addGuest('Controle', 'controller');
    expect(controller.react('lol')).toBe(false);
    host.setHostAvatar('👻');
    await flush();
    expect(ana.lobby.value.map((p) => p.avatar)).toEqual(['👻', '🦖', expect.any(String)]);
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
