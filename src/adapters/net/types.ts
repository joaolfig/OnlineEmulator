// O resto do app só conhece estas interfaces; PeerJS (ou outra coisa) fica escondido na implementação.

export type Unsubscribe = () => void;

/** Conexão com um par remoto: canal de controle (confiável, JSON) + canal de input (rápido, binário). */
export interface Link {
  readonly peerId: string;
  readonly isOpen: boolean;
  sendControl(message: object): void;
  sendInput(data: ArrayBuffer): void;
  onControl(handler: (data: unknown) => void): Unsubscribe;
  onInput(handler: (data: unknown) => void): Unsubscribe;
  onClose(handler: () => void): Unsubscribe;
  close(): void;
}

/** Transmissão de mídia para um convidado. `pc` permite ajustar bitrate e ler estatísticas. */
export interface MediaSession {
  readonly pc: RTCPeerConnection | null;
  close(): void;
}

export interface HostTransport {
  /** Registra a sala com esse código. Rejeita com RoomCodeTakenError se já existir. */
  open(roomCode: string): Promise<void>;
  onLink(handler: (link: Link) => void): Unsubscribe;
  sendMedia(peerId: string, stream: MediaStream): MediaSession;
  destroy(): void;
}

export interface GuestTransport {
  /** Conecta na sala. Rejeita com RoomNotFoundError ou NetworkError. */
  join(roomCode: string): Promise<Link>;
  onMedia(handler: (stream: MediaStream, pc: RTCPeerConnection | null) => void): Unsubscribe;
  destroy(): void;
}

export class RoomCodeTakenError extends Error {
  override readonly name = 'RoomCodeTakenError';
}
export class RoomNotFoundError extends Error {
  override readonly name = 'RoomNotFoundError';
}
export class NetworkError extends Error {
  override readonly name = 'NetworkError';
}
