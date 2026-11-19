import { Emitter } from './emitter';
import {
  RoomCodeTakenError,
  RoomNotFoundError,
  type GuestTransport,
  type HostTransport,
  type Link,
  type MediaSession,
  type Unsubscribe,
} from './types';

// Transporte em memória, sem rede: usado nos testes de integração e útil para depurar.
// As mensagens passam por structuredClone para imitar a serialização da rede.

class MemoryLink implements Link {
  readonly controlEvents = new Emitter<[unknown]>();
  readonly inputEvents = new Emitter<[unknown]>();
  readonly closeEvents = new Emitter<[]>();
  other: MemoryLink | null = null;
  private closed = false;

  constructor(readonly peerId: string) {}

  get isOpen(): boolean {
    return !this.closed;
  }

  sendControl(message: object): void {
    if (!this.closed) this.other?.controlEvents.emit(structuredClone(message));
  }

  sendInput(data: ArrayBuffer): void {
    if (!this.closed) this.other?.inputEvents.emit(data.slice(0));
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
    this.closeEvents.emit();
    this.other?.close();
  }
}

/** Uma "rede" em memória onde hosts registram salas e convidados entram. */
export class MemoryNetwork {
  private readonly rooms = new Map<string, MemoryHostTransport>();
  private nextGuestId = 1;

  createHost(): MemoryHostTransport {
    return new MemoryHostTransport(this.rooms);
  }

  createGuest(): MemoryGuestTransport {
    return new MemoryGuestTransport(this.rooms, `guest-${this.nextGuestId++}`);
  }
}

export class MemoryHostTransport implements HostTransport {
  readonly linkEvents = new Emitter<[Link]>();
  readonly guests = new Map<string, MemoryGuestTransport>();
  private code: string | null = null;

  constructor(private readonly rooms: Map<string, MemoryHostTransport>) {}

  open(roomCode: string): Promise<void> {
    if (this.rooms.has(roomCode)) return Promise.reject(new RoomCodeTakenError(roomCode));
    this.rooms.set(roomCode, this);
    this.code = roomCode;
    return Promise.resolve();
  }

  onLink(handler: (link: Link) => void): Unsubscribe {
    return this.linkEvents.on(handler);
  }

  sendMedia(peerId: string, stream: MediaStream): MediaSession {
    this.guests.get(peerId)?.mediaEvents.emit(stream, null);
    return { pc: null, close: () => {} };
  }

  destroy(): void {
    if (this.code) this.rooms.delete(this.code);
    this.linkEvents.clear();
  }
}

export class MemoryGuestTransport implements GuestTransport {
  readonly mediaEvents = new Emitter<[MediaStream, RTCPeerConnection | null]>();
  private link: MemoryLink | null = null;

  constructor(
    private readonly rooms: Map<string, MemoryHostTransport>,
    private readonly id: string,
  ) {}

  join(roomCode: string): Promise<Link> {
    const host = this.rooms.get(roomCode);
    if (!host) return Promise.reject(new RoomNotFoundError(roomCode));
    const guestSide = new MemoryLink('host');
    const hostSide = new MemoryLink(this.id);
    guestSide.other = hostSide;
    hostSide.other = guestSide;
    this.link = guestSide;
    host.guests.set(this.id, this);
    host.linkEvents.emit(hostSide);
    return Promise.resolve(guestSide);
  }

  onMedia(handler: (stream: MediaStream, pc: RTCPeerConnection | null) => void): Unsubscribe {
    return this.mediaEvents.on(handler);
  }

  destroy(): void {
    this.link?.close();
    this.mediaEvents.clear();
  }
}
