import { signal } from '@preact/signals-core';
import type { Emulator } from '../../adapters/emulator/types';
import { readVideoStats, tuneVideoSender, type VideoSendSettings } from '../../adapters/media/rtc';
import {
  RoomCodeTakenError,
  type HostTransport,
  type Link,
  type MediaSession,
  type Unsubscribe,
} from '../../adapters/net/types';
import { config } from '../../config';
import type { ControllerLayout } from '../../core/input/layout';
import type { PadState } from '../../core/input/pad';
import { decodeInput } from '../../core/protocol/inputCodec';
import { parseGuestMessage, PROTOCOL_VERSION, type HostMessage } from '../../core/protocol/messages';
import { isNewerSeq } from '../../core/protocol/seq';
import {
  createRoom,
  HOST_ID,
  join,
  leave,
  portChanges,
  portOf,
  setAvatar,
  setPort,
  findParticipant,
  type DeviceMode,
  type Port,
  type RoomState,
} from '../../core/room/room';
import { MAX_VISIBLE_REACTIONS, type Avatar, type ReactionEvent, type ReactionId } from '../../core/social';
import { RateLimiter } from '../../core/util/rateLimiter';
import { generateRoomCode, type RandomBytes } from '../../core/util/roomCode';
import type { Logger } from '../logger';

const MAX_ROOM_CODE_ATTEMPTS = 3;

export interface GuestStats {
  readonly rttMs: number | null;
  readonly kbps: number | null;
  readonly fps: number | null;
}

export interface HostSessionDeps {
  readonly emulator: Emulator;
  readonly transport: HostTransport;
  readonly logger: Logger;
  readonly hostName: string;
  /** Boneco do host (escolhido no próprio aparelho). */
  readonly hostAvatar?: Avatar;
  readonly randomBytes: RandomBytes;
  /** Portas do console deste jogo (N64 = 4, SNES = 2, portáteis = 1). */
  readonly portCount?: number;
  /** Botões que os convidados devem ver na tela. */
  readonly layout?: ControllerLayout;
  readonly now?: () => number;
}

interface GuestConnection {
  readonly link: Link;
  readonly limiter: RateLimiter;
  readonly unsubscribe: Unsubscribe[];
  joined: boolean;
  media: MediaSession | null;
  lastSeq: number | null;
  lastBytes: number | null;
  stats: GuestStats;
  /** Quando mandou a última reação (para o intervalo mínimo). */
  lastReactionAt: number;
}

export type HostStatus = 'idle' | 'opening' | 'open' | 'error';

/**
 * Orquestra o lado do host: abre a sala, aceita convidados, distribui portas,
 * aplica os inputs no emulador e transmite o vídeo. Não conhece a UI nem o PeerJS.
 */
export class HostSession {
  readonly room = signal<RoomState>(createRoom('', config.portCount));
  readonly roomCode = signal<string | null>(null);
  readonly status = signal<HostStatus>('idle');
  readonly stats = signal<ReadonlyMap<string, GuestStats>>(new Map());
  readonly videoSettings = signal<VideoSendSettings>({
    maxBitrate: config.video.defaultBitrate,
    maxFramerate: config.video.defaultFps,
  });
  /** Velocidade do jogo (1 = normal). */
  readonly speed = signal(1);
  /** Reações recentes, para mostrar na tela do host. */
  readonly reactions = signal<readonly ReactionEvent[]>([]);
  private reactionKey = 0;
  private hostLastReactionAt = -Infinity;

  private readonly guests = new Map<string, GuestConnection>();
  private readonly now: () => number;
  private stream: MediaStream | null = null;
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private unsubscribeLinks: Unsubscribe | null = null;

  constructor(private readonly deps: HostSessionDeps) {
    this.now = deps.now ?? (() => performance.now());
    this.room.value = createRoom(deps.hostName, deps.portCount ?? config.portCount, deps.hostAvatar);
  }

  get guestCount(): number {
    return [...this.guests.values()].filter((g) => g.joined).length;
  }

  /** Abre a sala com um código novo (tentando outro se o código já estiver em uso). */
  async open(stream: MediaStream): Promise<void> {
    const { transport, logger, randomBytes } = this.deps;
    this.stream = stream;
    this.status.value = 'opening';
    this.unsubscribeLinks = transport.onLink((link) => this.acceptLink(link));
    for (let attempt = 1; ; attempt++) {
      const code = generateRoomCode(config.roomCodeLength, randomBytes);
      try {
        await transport.open(code);
        this.roomCode.value = code;
        this.status.value = 'open';
        logger.success(`Sala ${code} aberta`);
        break;
      } catch (err) {
        if (err instanceof RoomCodeTakenError && attempt < MAX_ROOM_CODE_ATTEMPTS) continue;
        this.status.value = 'error';
        logger.error('Não foi possível abrir a sala', err);
        throw err;
      }
    }
    this.statsTimer = setInterval(() => void this.pollStats(), config.statsIntervalMs);
  }

  /** Controles do próprio host (teclado/gamepad do PC), aplicados na porta atual dele. */
  setLocalPad(pad: PadState): void {
    const port = portOf(this.room.value, HOST_ID);
    if (port !== null) this.deps.emulator.setInput(port, pad);
  }

  /** Move alguém de porta; se estiver ocupada, os dois trocam. */
  setPort(participantId: string, port: Port): void {
    const before = this.room.value;
    const after = setPort(before, participantId, port);
    const changes = portChanges(before, after);
    if (changes.length === 0) return;
    for (const { from, to } of changes) {
      if (from !== null) this.deps.emulator.releaseAll(from);
      if (to !== null) this.deps.emulator.releaseAll(to);
    }
    this.room.value = after;
    // Os controles do próprio PC do host (teclado/controles do EmulatorJS) seguem a porta dele.
    const hostChange = changes.find((c) => c.id === HOST_ID);
    if (hostChange) this.deps.emulator.setLocalPort(hostChange.to);
    for (const { id, to } of changes) this.send(id, { type: 'port', port: to });
    this.broadcastLobby();
    const names = changes.map(({ id, to }) => {
      const name = after.participants.find((p) => p.id === id)?.name ?? id;
      return `${name} → ${to === null ? 'espectador' : `P${to + 1}`}`;
    });
    this.deps.logger.info(names.join(' · '));
  }

  setVideoSettings(settings: VideoSendSettings): void {
    this.videoSettings.value = settings;
    for (const guest of this.guests.values()) this.tune(guest);
  }

  /** Acelera (ou volta ao normal) o jogo para todos e avisa os convidados. */
  setSpeed(multiplier: number): void {
    const value = Math.min(config.maxSpeed, Math.max(1, multiplier));
    if (value === this.speed.value) return;
    this.speed.value = value;
    this.deps.emulator.setSpeed(value);
    this.broadcast({ type: 'speed', multiplier: value });
    this.deps.logger.info(value === 1 ? 'Velocidade normal' : `Jogo acelerado: ${value}x`);
  }

  /** Reação do próprio host. */
  react(reaction: ReactionId): void {
    const now = this.now();
    if (now - this.hostLastReactionAt < config.reactionCooldownMs) return;
    this.hostLastReactionAt = now;
    const host = findParticipant(this.room.value, HOST_ID);
    if (host) this.publishReaction(reaction, host.name, host.avatar);
  }

  /** Troca o boneco do host e avisa todo mundo. */
  setHostAvatar(avatar: Avatar): void {
    this.room.value = setAvatar(this.room.value, HOST_ID, avatar);
    this.broadcastLobby();
  }

  private handleReaction(guest: GuestConnection, reaction: ReactionId): void {
    const participant = findParticipant(this.room.value, guest.link.peerId);
    // Quem está em "Só controle" não manda reação (e quem não entrou também não).
    if (!guest.joined || !participant || participant.mode === 'controller') return;
    const now = this.now();
    if (now - guest.lastReactionAt < config.reactionCooldownMs) return;
    guest.lastReactionAt = now;
    this.publishReaction(reaction, participant.name, participant.avatar);
  }

  /** Mostra a reação na tela do host e manda para todos os convidados. */
  private publishReaction(reaction: ReactionId, name: string, avatar: Avatar): void {
    const event: ReactionEvent = { key: this.reactionKey++, reaction, name, avatar };
    this.reactions.value = [...this.reactions.value, event].slice(-MAX_VISIBLE_REACTIONS);
    this.broadcast({ type: 'reaction', reaction, name, avatar });
  }

  /** Avisa os convidados que o host voltou no tempo (o jogo "pula" para trás para todos). */
  notifyRewound(seconds: number): void {
    this.broadcast({ type: 'rewound', seconds: Math.round(seconds) });
    this.deps.logger.info(`Voltou ${seconds} s no tempo`);
  }

  close(): void {
    clearInterval(this.statsTimer);
    this.unsubscribeLinks?.();
    for (const guest of [...this.guests.values()]) guest.link.close();
    this.deps.transport.destroy();
    this.status.value = 'idle';
  }

  // ---------- Convidados ----------

  private acceptLink(link: Link): void {
    const guest: GuestConnection = {
      link,
      limiter: new RateLimiter(config.maxControlMessagesPerSecond, this.now),
      unsubscribe: [],
      joined: false,
      media: null,
      lastSeq: null,
      lastBytes: null,
      stats: { rttMs: null, kbps: null, fps: null },
      lastReactionAt: -Infinity,
    };
    this.guests.set(link.peerId, guest);
    guest.unsubscribe.push(
      link.onControl((data) => this.handleControl(guest, data)),
      link.onInput((data) => this.handleInput(guest, data)),
      link.onClose(() => this.removeGuest(guest)),
    );
  }

  private handleControl(guest: GuestConnection, data: unknown): void {
    if (!guest.limiter.tryConsume()) return;
    const message = parseGuestMessage(data);
    if (!message) {
      this.deps.logger.debug(`Mensagem inválida de ${guest.link.peerId}`);
      return;
    }
    switch (message.type) {
      case 'hello':
        return this.handleHello(guest, message.v, message.name, message.mode, message.avatar);
      case 'react':
        return this.handleReaction(guest, message.reaction);
      case 'ping':
        return guest.link.sendControl({ type: 'pong', ts: message.ts } satisfies HostMessage);
      case 'rtt':
        guest.stats = { ...guest.stats, rttMs: Math.round(message.ms) };
        return;
    }
  }

  private handleHello(
    guest: GuestConnection,
    version: number,
    name: string,
    mode: DeviceMode,
    avatar: Avatar | undefined,
  ): void {
    if (guest.joined) return;
    if (version !== PROTOCOL_VERSION) {
      guest.link.sendControl({ type: 'error', code: 'version-mismatch' } satisfies HostMessage);
      guest.link.close();
      return;
    }
    const id = guest.link.peerId;
    this.room.value = join(this.room.value, id, name, mode, avatar);
    guest.joined = true;
    const port = portOf(this.room.value, id);
    guest.link.sendControl({
      type: 'welcome',
      port,
      layout: this.deps.layout ?? 'n64',
    } satisfies HostMessage);
    if (this.speed.value !== 1) {
      guest.link.sendControl({ type: 'speed', multiplier: this.speed.value } satisfies HostMessage);
    }
    const role = port === null ? 'espectador' : `P${port + 1}`;
    this.deps.logger.success(`${name} entrou como ${role}${mode === 'controller' ? ' (só controle)' : ''}`);
    // Aparelho só de controle não recebe vídeo: economiza o processador do host, o Wi-Fi e a bateria.
    if (this.stream && mode !== 'controller') {
      guest.media = this.deps.transport.sendMedia(id, this.stream);
      const pc = guest.media.pc;
      pc?.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') this.tune(guest);
      });
    }
    this.broadcastLobby();
  }

  private handleInput(guest: GuestConnection, data: unknown): void {
    if (!guest.joined) return;
    const port = portOf(this.room.value, guest.link.peerId);
    if (port === null) return;
    const packet = decodeInput(data);
    if (!packet) return;
    if (guest.lastSeq !== null && !isNewerSeq(packet.seq, guest.lastSeq)) return;
    guest.lastSeq = packet.seq;
    // Fase 1: um jogador por aparelho (jogador local 0). Vários por aparelho entram na Fase 2.
    const player = packet.players.find((p) => p.local === 0);
    if (player) this.deps.emulator.setInput(port, player.pad);
  }

  private removeGuest(guest: GuestConnection): void {
    const id = guest.link.peerId;
    if (!this.guests.delete(id)) return;
    guest.unsubscribe.forEach((fn) => fn());
    guest.media?.close();
    if (!guest.joined) return;
    const port = portOf(this.room.value, id);
    if (port !== null) this.deps.emulator.releaseAll(port);
    const name = this.room.value.participants.find((p) => p.id === id)?.name ?? id;
    this.room.value = leave(this.room.value, id);
    this.deps.logger.info(`${name} saiu`);
    this.broadcastLobby();
  }

  private send(participantId: string, message: HostMessage): void {
    this.guests.get(participantId)?.link.sendControl(message);
  }

  private broadcast(message: HostMessage): void {
    for (const guest of this.guests.values()) if (guest.joined) guest.link.sendControl(message);
  }

  private broadcastLobby(): void {
    this.broadcast({
      type: 'lobby',
      players: this.room.value.participants.map(({ name, port, isHost, avatar }) => ({
        name,
        port,
        isHost,
        avatar,
      })),
    });
  }

  private tune(guest: GuestConnection): void {
    const pc = guest.media?.pc;
    if (!pc || pc.connectionState !== 'connected') return;
    tuneVideoSender(pc, this.videoSettings.value).catch((err: unknown) =>
      this.deps.logger.warn(`Ajuste de vídeo falhou: ${err instanceof Error ? err.message : String(err)}`),
    );
  }

  private async pollStats(): Promise<void> {
    const seconds = config.statsIntervalMs / 1000;
    for (const guest of this.guests.values()) {
      const pc = guest.media?.pc;
      if (!pc) continue;
      const video = await readVideoStats(pc, 'outbound');
      if (!video) continue;
      const kbps =
        guest.lastBytes === null ? null : Math.round(((video.bytes - guest.lastBytes) * 8) / 1000 / seconds);
      guest.lastBytes = video.bytes;
      guest.stats = { ...guest.stats, kbps, fps: video.fps };
    }
    this.stats.value = new Map([...this.guests].map(([id, g]) => [id, g.stats]));
  }
}
