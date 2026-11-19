// Estado da sala: quem está conectado e em qual porta do console.
// Funções puras: recebem um estado e devolvem um novo, sem efeitos colaterais.

/** Porta do console (0 = P1) ou null para espectador. */
export type Port = number | null;

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly port: Port;
  readonly isHost: boolean;
}

export interface RoomState {
  readonly portCount: number;
  readonly participants: readonly Participant[];
}

export const HOST_ID = 'host';

export function createRoom(hostName: string, portCount: number): RoomState {
  return { portCount, participants: [{ id: HOST_ID, name: hostName, port: 0, isHost: true }] };
}

export const findParticipant = (state: RoomState, id: string): Participant | undefined =>
  state.participants.find((p) => p.id === id);

export const portOf = (state: RoomState, id: string): Port => findParticipant(state, id)?.port ?? null;

export function freePort(state: RoomState): Port {
  const used = new Set(state.participants.map((p) => p.port));
  for (let port = 0; port < state.portCount; port++) if (!used.has(port)) return port;
  return null;
}

/** Entra na primeira porta livre, ou como espectador se a sala estiver cheia. */
export function join(state: RoomState, id: string, name: string): RoomState {
  if (findParticipant(state, id)) return state;
  const participant: Participant = { id, name, port: freePort(state), isHost: false };
  return { ...state, participants: [...state.participants, participant] };
}

export function leave(state: RoomState, id: string): RoomState {
  if (id === HOST_ID) return state;
  return { ...state, participants: state.participants.filter((p) => p.id !== id) };
}

/** Move alguém para outra porta. Se a porta estiver ocupada, os dois trocam de lugar. */
export function setPort(state: RoomState, id: string, port: Port): RoomState {
  const who = findParticipant(state, id);
  if (!who || who.port === port) return state;
  if (port !== null && (!Number.isInteger(port) || port < 0 || port >= state.portCount)) return state;
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
