import { describe, expect, it } from 'vitest';
import { parseGuestMessage, parseHostMessage } from '../../src/core/protocol/messages';
import { createRoom, join, setAvatar } from '../../src/core/room/room';
import { AVATARS, pickFreeAvatar, REACTIONS } from '../../src/core/social';

describe('bonecos', () => {
  it('quem não escolhe ganha um boneco que ninguém está usando', () => {
    let room = createRoom('Host', 4, '🐸');
    room = join(room, 'a', 'Ana', 'play', '🐱');
    room = join(room, 'b', 'Bia');
    expect(room.participants.map((p) => p.avatar)).toEqual(['🐸', '🐱', '🐼']);
    expect(pickFreeAvatar(AVATARS)).toBe(AVATARS[0]); // acabaram: repete o primeiro
  });

  it('dá para trocar o boneco', () => {
    const room = setAvatar(createRoom('Host', 4, '🐸'), 'host', '👻');
    expect(room.participants[0]?.avatar).toBe('👻');
  });
});

describe('reações no protocolo', () => {
  it('8 reações, uma por tecla de 1 a 8', () => {
    expect(REACTIONS).toHaveLength(8);
    expect(new Set(REACTIONS.map((r) => r.id)).size).toBe(8);
  });

  it('aceita reação e boneco válidos e rejeita o resto', () => {
    expect(parseGuestMessage({ type: 'react', reaction: 'lol' })).toEqual({ type: 'react', reaction: 'lol' });
    expect(parseGuestMessage({ type: 'react', reaction: '<script>' })).toBeNull();
    expect(parseGuestMessage({ type: 'hello', v: 1, name: 'Ana', avatar: '🐙' })).toMatchObject({
      avatar: '🐙',
    });
    expect(parseGuestMessage({ type: 'hello', v: 1, name: 'Ana', avatar: '💩' })).toBeNull();
    expect(parseHostMessage({ type: 'reaction', reaction: 'nooo', name: 'Bia', avatar: '🦖' })).toMatchObject(
      { reaction: 'nooo' },
    );
  });
});
