// Estado da sala: quem está conectado e em qual porta do console.
// Funções puras: recebem um estado e devolvem um novo, sem efeitos colaterais.

import { AVATARS, pickFreeAvatar, type Avatar } from '../social';

/** Porta do console (0 = P1) ou null para espectador. */
export type Port = number | null;

/**
 * Como o aparelho participa:
 * - play: recebe vídeo e controla;
 * - controller: só controla (sem vídeo, ex.: celular quando todos olham a mesma TV);
 * - watch: só exibe o jogo (espectador fixo, ex.: aparelho ligado na TV).
 */
export const DEVICE_MODES = ['play', 'controller', 'watch'] as const;
export type DeviceMode = (typeof DEVICE_MODES)[number];

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly port: Port;
  readonly isHost: boolean;
  readonly mode: DeviceMode;
  readonly avatar: Avatar;
}

export interface RoomState {
  readonly portCount: number;
  readonly participants: readonly Participant[];
}

export const HOST_ID = 'host';

export function createRoom(hostName: string, portCount: number, hostAvatar: Avatar = AVATARS[0]): RoomState {
  return {
    portCount,
    participants: [{ id: HOST_ID, name: hostName, port: 0, isHost: true, mode: 'play', avatar: hostAvatar }],
  };
}

export const findParticipant = (state: RoomState, id: string): Participant | undefined =>
  state.participants.find((p) => p.id === id);

export const portOf = (state: RoomState, id: string): Port => findParticipant(state, id)?.port ?? null;

export function freePort(state: RoomState): Port {
  const used = new Set(state.participants.map((p) => p.port));
  for (let port = 0; port < state.portCount; port++) if (!used.has(port)) return port;
  return null;
}

/** Entra na primeira porta livre, ou como espectador se a sala estiver cheia (ou se só for assistir). */
export function join(
  state: RoomState,
  id: string,
  name: string,
  mode: DeviceMode = 'play',
  avatar?: Avatar,
): RoomState {
  if (findParticipant(state, id)) return state;
  const port = mode === 'watch' ? null : freePort(state);
  // Sem escolha (convidado antigo), pega um boneco que ninguém está usando.
  const chosen = avatar ?? pickFreeAvatar(state.participants.map((p) => p.avatar));
  const participant: Participant = { id, name, port, isHost: false, mode, avatar: chosen };
  return { ...state, participants: [...state.participants, participant] };
}

export function leave(state: RoomState, id: string): RoomState {
  if (id === HOST_ID) return state;
  return { ...state, participants: state.participants.filter((p) => p.id !== id) };
}

/** Troca o boneco de alguém. */
export function setAvatar(state: RoomState, id: string, avatar: Avatar): RoomState {
  if (!findParticipant(state, id)) return state;
  return { ...state, participants: state.participants.map((p) => (p.id === id ? { ...p, avatar } : p)) };
}

/** Move alguém para outra porta. Se a porta estiver ocupada, os dois trocam de lugar. */
export function setPort(state: RoomState, id: string, port: Port): RoomState {
  const who = findParticipant(state, id);
  if (!who || who.port === port) return state;
  if (port !== null && (!Number.isInteger(port) || port < 0 || port >= state.portCount)) return state;
  // Um aparelho que só exibe o jogo não tem controles: não faz sentido ocupar uma porta.
  if (port !== null && who.mode === 'watch') return state;
  const occupant = port === null ? undefined : state.participants.find((p) => p.port === port);
  return {
    ...state,
    participants: state.participants.map((p) => {
      if (p.id === who.id) return { ...p, port };
      if (p.id === occupant?.id) return { ...p, port: who.port };
      return p;
    }),
  };
}

/** Lista quem mudou de porta entre dois estados (para avisar os convidados e soltar botões). */
export function portChanges(before: RoomState, after: RoomState): { id: string; from: Port; to: Port }[] {
  const changes: { id: string; from: Port; to: Port }[] = [];
  for (const p of after.participants) {
    const prev = findParticipant(before, p.id);
    if (prev && prev.port !== p.port) changes.push({ id: p.id, from: prev.port, to: p.port });
  }
  return changes;
}
