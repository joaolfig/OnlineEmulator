import { Peer, type DataConnection, type PeerError, type PeerOptions } from 'peerjs';
import { config } from '../../config';
import { Emitter } from './emitter';
import {
  NetworkError,
  RoomCodeTakenError,
  RoomNotFoundError,
  type GuestTransport,
  type HostTransport,
  type Link,
  type MediaSession,
  type Unsubscribe,
} from './types';

const CONTROL_LABEL = 'control';
const INPUT_LABEL = 'input';

const peerOptions = (): PeerOptions => ({ config: { iceServers: [...config.iceServers] }, debug: 1 });
const hostPeerId = (roomCode: string): string => config.peerIdPrefix + roomCode;

/** Junta as duas DataConnections de um par num Link. */
class PeerLink implements Link {
  private readonly controlEvents = new Emitter<[unknown]>();
  private readonly inputEvents = new Emitter<[unknown]>();
  private readonly closeEvents = new Emitter<[]>();
  private closed = false;

  constructor(
    private readonly control: DataConnection,
    private readonly input: DataConnection,
  ) {
    control.on('data', (data) => this.controlEvents.emit(data));
    input.on('data', (data) => this.inputEvents.emit(data));
    for (const conn of [control, input]) {
      conn.on('close', () => this.close());
      conn.on('error', () => this.close());
    }
  }

  get peerId(): string {
    return this.control.peer;
  }

  /** Entrega mensagens que chegaram antes de o link existir. */
  deliverEarly(control: readonly unknown[], input: readonly unknown[]): void {
    control.forEach((data) => this.controlEvents.emit(data));
    input.forEach((data) => this.inputEvents.emit(data));
  }

  get isOpen(): boolean {
    return !this.closed && this.control.open;
  }

  sendControl(message: object): void {
    if (this.isOpen) void this.control.send(message);
  }

  sendInput(data: ArrayBuffer): void {
    if (!this.closed && this.input.open) void this.input.send(data);
  }

  onControl(handler: (data: unknown) => void): Unsubscribe {
    return this.controlEvents.on(handler);
  }

  onInput(handler: (data: unknown) => void): Unsubscribe {
    return this.inputEvents.on(handler);
  }

  onClose(handler: () => void): Unsubscribe {
    return this.closeEvents.on(handler);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.control.close();
    this.input.close();
    this.closeEvents.emit();
    this.controlEvents.clear();
    this.inputEvents.clear();
    this.closeEvents.clear();
  }
}

const whenOpen = (conn: DataConnection): Promise<void> =>
  new Promise((resolve, reject) => {
    if (conn.open) return resolve();
    conn.once('open', () => resolve());
    conn.once('error', (err) => reject(new NetworkError(err.message)));
  });

function withTimeout<T>(promise: Promise<T>, ms: number, error: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(error()), ms)));
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class PeerJsHostTransport implements HostTransport {
  private peer: Peer | null = null;
  private readonly linkEvents = new Emitter<[Link]>();
  private readonly pending = new Map<string, { control?: DataConnection; input?: DataConnection }>();
  private readonly early = new Map<
    DataConnection,
    { buffer: (data: unknown) => void; messages: unknown[] }
  >();

  /** Para de guardar mensagens desta conexão e devolve o que foi guardado. */
  private takeEarly(conn: DataConnection): unknown[] {
    const entry = this.early.get(conn);
    if (!entry) return [];
    conn.off('data', entry.buffer);
    this.early.delete(conn);
    return entry.messages;
  }

  open(roomCode: string): Promise<void> {
    this.peer?.destroy();
    const peer = new Peer(hostPeerId(roomCode), peerOptions());
    this.peer = peer;
    peer.on('connection', (conn) => this.acceptConnection(conn));
    return new Promise((resolve, reject) => {
      peer.once('open', () => resolve());
      peer.once('error', (err: PeerError<string>) =>
        reject(
          err.type === 'unavailable-id' ? new RoomCodeTakenError(roomCode) : new NetworkError(err.message),
        ),
      );
    });
  }

  onLink(handler: (link: Link) => void): Unsubscribe {
    return this.linkEvents.on(handler);
  }

  sendMedia(peerId: string, stream: MediaStream): MediaSession {
    if (!this.peer) throw new NetworkError('Sala não está aberta');
    const call = this.peer.call(peerId, stream);
    return { pc: call.peerConnection ?? null, close: () => call.close() };
  }

  destroy(): void {
    this.peer?.destroy();
    this.peer = null;
    this.linkEvents.clear();
    this.pending.clear();
  }

  private acceptConnection(conn: DataConnection): void {
    if (conn.label !== CONTROL_LABEL && conn.label !== INPUT_LABEL) return conn.close();
    // O convidado pode mandar mensagens (o "olá") assim que o lado dele abre, antes de o segundo
    // canal abrir aqui. Guarda tudo desde já e entrega quando a conexão estiver pronta.
    const early: unknown[] = [];
    const buffer = (data: unknown) => early.push(data);
    conn.on('data', buffer);
    this.early.set(conn, { buffer, messages: early });
    whenOpen(conn)
      .then(() => {
        const entry = this.pending.get(conn.peer) ?? {};
        if (conn.label === CONTROL_LABEL) entry.control = conn;
        else entry.input = conn;
        if (entry.control && entry.input) {
          this.pending.delete(conn.peer);
          const link = new PeerLink(entry.control, entry.input);
          const control = this.takeEarly(entry.control);
          const input = this.takeEarly(entry.input);
          this.linkEvents.emit(link);
          // Depois que a sessão já está ouvindo o link, entrega o que chegou cedo, na ordem.
          link.deliverEarly(control, input);
          return;
        }
        this.pending.set(conn.peer, entry);
        // Se o segundo canal nunca chegar, descarta o primeiro.
        setTimeout(() => {
          if (this.pending.get(conn.peer) === entry) {
            this.pending.delete(conn.peer);
            this.takeEarly(conn);
            conn.close();
          }
        }, config.joinTimeoutMs);
      })
      .catch(() => {
        this.takeEarly(conn);
        conn.close();
      });
  }
}

export class PeerJsGuestTransport implements GuestTransport {
  private peer: Peer | null = null;
  private readonly mediaEvents = new Emitter<[MediaStream, RTCPeerConnection | null]>();

  join(roomCode: string): Promise<Link> {
    this.peer?.destroy();
    const peer = new Peer(peerOptions());
    this.peer = peer;
    const hostId = hostPeerId(roomCode);

    peer.on('call', (call) => {
      // Só aceita vídeo vindo do host da sala.
      if (call.peer !== hostId) return call.close();
      call.answer();
      call.on('stream', (stream) => this.mediaEvents.emit(stream, call.peerConnection ?? null));
    });

    const connect = new Promise<Link>((resolve, reject) => {
      peer.once('error', (err: PeerError<string>) =>
        reject(
          err.type === 'peer-unavailable' ? new RoomNotFoundError(roomCode) : new NetworkError(err.message),
        ),
      );
      peer.once('open', () => {
        const control = peer.connect(hostId, { label: CONTROL_LABEL, serialization: 'json', reliable: true });
        // Input: sem ordem garantida; um pacote atrasado não deve segurar os seguintes.
        const input = peer.connect(hostId, { label: INPUT_LABEL, serialization: 'raw', reliable: false });
        Promise.all([whenOpen(control), whenOpen(input)])
          .then(() => resolve(new PeerLink(control, input)))
          .catch(reject);
      });
    });
    return withTimeout(connect, config.joinTimeoutMs, () => new NetworkError('Tempo esgotado ao conectar'));
  }

  onMedia(handler: (stream: MediaStream, pc: RTCPeerConnection | null) => void): Unsubscribe {
    return this.mediaEvents.on(handler);
  }

  destroy(): void {
    this.peer?.destroy();
    this.peer = null;
    this.mediaEvents.clear();
  }
}
