import { signal } from '@preact/signals-core';
import { lowLatencyReceivers, readVideoStats } from '../../adapters/media/rtc';
import {
  RoomNotFoundError,
  type GuestTransport,
  type Link,
  type Unsubscribe,
} from '../../adapters/net/types';
import { config } from '../../config';
import type { ControllerLayout } from '../../core/input/layout';
import { EMPTY_PAD, samePad, type PadState } from '../../core/input/pad';
import { encodeInput } from '../../core/protocol/inputCodec';
import {
  parseHostMessage,
  PROTOCOL_VERSION,
  type GuestMessage,
  type LobbyPlayer,
} from '../../core/protocol/messages';
import { nextSeq } from '../../core/protocol/seq';
import type { DeviceMode, Port } from '../../core/room/room';
import { MAX_VISIBLE_REACTIONS, type Avatar, type ReactionEvent, type ReactionId } from '../../core/social';
import type { Logger } from '../logger';

export type GuestStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
export type GuestErrorCode = 'room-not-found' | 'network' | 'version-mismatch' | 'rejected';

export interface GuestSessionDeps {
  readonly transport: GuestTransport;
  readonly logger: Logger;
  readonly now?: () => number;
}

/** Lado do convidado: conecta na sala, recebe o vídeo e envia o estado do controle. */
export class GuestSession {
  readonly status = signal<GuestStatus>('idle');
  readonly error = signal<GuestErrorCode | null>(null);
  /** undefined até o host responder; null = espectador. */
  readonly port = signal<Port | undefined>(undefined);
  readonly lobby = signal<readonly LobbyPlayer[]>([]);
  readonly stream = signal<MediaStream | null>(null);
  readonly rttMs = signal<number | null>(null);
  readonly fps = signal<number | null>(null);
  /** Velocidade do jogo definida pelo host (1 = normal). */
  readonly speed = signal(1);
  /** Botões que este aparelho mostra (conforme o console do jogo). */
  readonly layout = signal<ControllerLayout>('n64');
  /** Reações recentes de todos (inclusive as minhas, que voltam pelo host). */
  readonly reactions = signal<readonly ReactionEvent[]>([]);
  private reactionKey = 0;
  private lastReactionAt = -Infinity;
  /** Último aviso de "voltar no tempo" (segundos e quando chegou), para mostrar por alguns segundos. */
  readonly rewound = signal<{ seconds: number; at: number } | null>(null);

  /** Como este aparelho participa (definido ao entrar). */
  mode: DeviceMode = 'play';
  /** Boneco escolhido ao entrar. */
  avatar: Avatar | undefined;

  private link: Link | null = null;
  private readonly unsubscribe: Unsubscribe[] = [];
  private readonly timers: ReturnType<typeof setInterval>[] = [];
  private readonly now: () => number;
  private seq = 0;
  private lastSent: PadState = EMPTY_PAD;
  private lastSentAt = -Infinity;

  constructor(private readonly deps: GuestSessionDeps) {
    this.now = deps.now ?? (() => performance.now());
  }

  async join(roomCode: string, name: string, mode: DeviceMode = 'play', avatar?: Avatar): Promise<void> {
    const { transport, logger } = this.deps;
    this.status.value = 'connecting';
    this.error.value = null;
    this.mode = mode;
    this.avatar = avatar;
    this.unsubscribe.push(transport.onMedia((stream, pc) => this.handleMedia(stream, pc)));
    try {
      this.link = await transport.join(roomCode);
    } catch (err) {
      this.status.value = 'error';
      this.error.value = err instanceof RoomNotFoundError ? 'room-not-found' : 'network';
      logger.error('Falha ao entrar na sala', err);
      return;
    }
    const link = this.link;
    this.unsubscribe.push(
      link.onControl((data) => this.handleControl(data)),
      link.onClose(() => {
        if (this.status.value === 'connected' || this.status.value === 'connecting') {
          this.status.value = 'disconnected';
        }
      }),
    );
    // Repete o "olá" até o host responder (uma mensagem pode se perder enquanto a conexão se ajeita);
    // o host ignora repetições. Sem resposta no prazo, mostra erro em vez de ficar "Conectando…".
    const hello = () =>
      link.sendControl({ type: 'hello', v: PROTOCOL_VERSION, name, mode, avatar } satisfies GuestMessage);
    hello();
    const startedAt = this.now();
    const retry = setInterval(() => {
      if (this.status.value !== 'connecting') return clearInterval(retry);
      if (this.now() - startedAt >= config.joinTimeoutMs) {
        clearInterval(retry);
        this.status.value = 'error';
        this.error.value = 'network';
        logger.error('O host não respondeu');
        return;
      }
      hello();
    }, config.helloRetryMs);
    this.timers.push(retry);
    this.timers.push(
      setInterval(
        () => link.sendControl({ type: 'ping', ts: this.now() } satisfies GuestMessage),
        config.pingIntervalMs,
      ),
    );
  }

  /**
   * Chamado a cada frame com o estado atual do controle. Envia quando algo muda
   * e também a cada heartbeat, para cobrir pacotes perdidos.
   */
  tick(pad: PadState): void {
    const link = this.link;
    if (!link?.isOpen || this.port.value === undefined || this.port.value === null) return;
    const now = this.now();
    if (samePad(pad, this.lastSent) && now - this.lastSentAt < config.inputHeartbeatMs) return;
    this.seq = nextSeq(this.seq);
    link.sendInput(encodeInput({ seq: this.seq, players: [{ local: 0, pad }] }));
    this.lastSent = pad;
    this.lastSentAt = now;
  }

  /** Manda uma reação (respeitando o intervalo mínimo; o host confere de novo). */
  react(reaction: ReactionId): boolean {
    const now = this.now();
    if (!this.link?.isOpen || this.mode === 'controller') return false;
    if (now - this.lastReactionAt < config.reactionCooldownMs) return false;
    this.lastReactionAt = now;
    this.link.sendControl({ type: 'react', reaction } satisfies GuestMessage);
    return true;
  }

  leave(): void {
    this.timers.splice(0).forEach(clearInterval);
    this.unsubscribe.splice(0).forEach((fn) => fn());
    this.link?.close();
    this.deps.transport.destroy();
    this.status.value = 'idle';
  }

  private handleControl(data: unknown): void {
    const message = parseHostMessage(data);
    if (!message) return;
    switch (message.type) {
      case 'welcome':
        this.port.value = message.port;
        this.layout.value = message.layout;
        this.status.value = 'connected';
        return;
      case 'port':
        this.port.value = message.port;
        return;
      case 'lobby':
        this.lobby.value = message.players;
        return;
      case 'pong': {
        const rtt = Math.max(0, this.now() - message.ts);
        this.rttMs.value = Math.round(rtt);
        this.link?.sendControl({ type: 'rtt', ms: rtt } satisfies GuestMessage);
        return;
      }
      case 'speed':
        this.speed.value = message.multiplier;
        return;
      case 'reaction': {
        const event: ReactionEvent = { key: this.reactionKey++, ...message };
        this.reactions.value = [...this.reactions.value, event].slice(-MAX_VISIBLE_REACTIONS);
        return;
      }
      case 'rewound':
        this.rewound.value = { seconds: message.seconds, at: this.now() };
        return;
      case 'error':
        this.status.value = 'error';
        this.error.value = message.code;
        return;
    }
  }

  private handleMedia(stream: MediaStream, pc: RTCPeerConnection | null): void {
    this.stream.value = stream;
    if (!pc) return;
    lowLatencyReceivers(pc);
    this.timers.push(
      setInterval(() => {
        void readVideoStats(pc, 'inbound').then((stats) => {
          this.fps.value = stats?.fps ?? null;
        });
      }, config.statsIntervalMs),
    );
  }
}
