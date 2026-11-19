import { describe, expect, it } from 'vitest';
import { createRoom, HOST_ID, join, leave, portChanges, portOf, setPort } from '../../src/core/room/room';

const ports = (state: ReturnType<typeof createRoom>) =>
  Object.fromEntries(state.participants.map((p) => [p.id, p.port]));

describe('room', () => {
  it('host começa no P1', () => {
    expect(portOf(createRoom('Host', 4), HOST_ID)).toBe(0);
  });

  it('convidados entram nas portas livres e o quinto vira espectador', () => {
    let room = createRoom('Host', 4);
    for (const id of ['a', 'b', 'c', 'd']) room = join(room, id, id);
    expect(ports(room)).toEqual({ host: 0, a: 1, b: 2, c: 3, d: null });
  });

  it('entrar duas vezes não duplica', () => {
    const room = join(join(createRoom('Host', 4), 'a', 'A'), 'a', 'A');
    expect(room.participants).toHaveLength(2);
  });

  it('quem sai libera a porta para o próximo', () => {
    let room = join(join(createRoom('Host', 4), 'a', 'A'), 'b', 'B');
    room = join(leave(room, 'a'), 'c', 'C');
    expect(portOf(room, 'c')).toBe(1);
  });

  it('o host não pode sair', () => {
    const room = createRoom('Host', 4);
    expect(leave(room, HOST_ID)).toBe(room);
  });

  it('mover para porta ocupada troca os dois', () => {
    const room = setPort(join(createRoom('Host', 4), 'a', 'A'), 'a', 0);
    expect(ports(room)).toEqual({ host: 1, a: 0 });
  });

  it('mover para porta livre só move', () => {
    const room = setPort(join(createRoom('Host', 4), 'a', 'A'), 'a', 3);
    expect(ports(room)).toEqual({ host: 0, a: 3 });
  });

  it('espectador pegando porta ocupada manda o ocupante para espectador', () => {
    let room = createRoom('Host', 1);
    room = join(room, 'a', 'A');
    expect(portOf(room, 'a')).toBeNull();
    room = setPort(room, 'a', 0);
    expect(ports(room)).toEqual({ host: null, a: 0 });
  });

  it('ignora porta inválida ou participante desconhecido', () => {
    const room = join(createRoom('Host', 4), 'a', 'A');
    expect(setPort(room, 'a', 9)).toBe(room);
    expect(setPort(room, 'a', 1.5)).toBe(room);
    expect(setPort(room, 'zzz', 2)).toBe(room);
  });

  it('aparelho "só tela" entra como espectador mesmo com porta livre e não pode pegar porta', () => {
    let room = join(createRoom('Host', 4), 'tv', 'TV', 'watch');
    expect(portOf(room, 'tv')).toBeNull();
    expect(setPort(room, 'tv', 1)).toBe(room);
    // E não rouba a vaga de quem chega depois.
    room = join(room, 'a', 'A');
    expect(portOf(room, 'a')).toBe(1);
  });

  it('aparelho "só controle" ocupa porta normalmente', () => {
    const room = join(createRoom('Host', 4), 'cel', 'Cel', 'controller');
    expect(portOf(room, 'cel')).toBe(1);
  });

  it('portChanges lista as duas pontas de uma troca', () => {
    const before = join(createRoom('Host', 4), 'a', 'A');
    const after = setPort(before, 'a', 0);
    expect(portChanges(before, after)).toEqual([
      { id: HOST_ID, from: 0, to: 1 },
      { id: 'a', from: 1, to: 0 },
    ]);
  });
});
