import * as v from 'valibot';
import { config } from '../../config';

// Mensagens do canal de controle (JSON, confiável). Os inputs vão por outro canal (inputCodec.ts).
// Toda mensagem recebida da rede passa por estes schemas antes de ser usada.

export const PROTOCOL_VERSION = 1;

const Port = v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(config.portCount - 1)));
const Timestamp = v.pipe(v.number(), v.finite(), v.minValue(0));
const Name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(config.maxNameLength));

// ---------- Convidado → Host ----------

export const GuestMessageSchema = v.variant('type', [
  v.object({ type: v.literal('hello'), v: v.number(), name: Name }),
  v.object({ type: v.literal('ping'), ts: Timestamp }),
  v.object({ type: v.literal('rtt'), ms: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(60_000)) }),
]);
export type GuestMessage = v.InferOutput<typeof GuestMessageSchema>;

// ---------- Host → Convidado ----------

const LobbyPlayer = v.object({ name: Name, port: Port, isHost: v.boolean() });

export const HostMessageSchema = v.variant('type', [
  v.object({ type: v.literal('welcome'), port: Port }),
  v.object({ type: v.literal('port'), port: Port }),
  v.object({ type: v.literal('lobby'), players: v.pipe(v.array(LobbyPlayer), v.maxLength(32)) }),
  v.object({ type: v.literal('pong'), ts: Timestamp }),
  v.object({
    type: v.literal('error'),
    code: v.picklist(['version-mismatch', 'rejected']),
  }),
]);
export type HostMessage = v.InferOutput<typeof HostMessageSchema>;
export type LobbyPlayer = v.InferOutput<typeof LobbyPlayer>;

export function parseGuestMessage(data: unknown): GuestMessage | null {
  const result = v.safeParse(GuestMessageSchema, data);
  return result.success ? result.output : null;
}

export function parseHostMessage(data: unknown): HostMessage | null {
  const result = v.safeParse(HostMessageSchema, data);
  return result.success ? result.output : null;
}
