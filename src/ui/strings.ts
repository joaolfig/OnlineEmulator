// Todos os textos da interface num só lugar (facilita revisar e traduzir).

import type { GuestErrorCode } from '../app/guest/guestSession';
import type { Port } from '../core/room/room';

export const t = {
  appName: 'OnlineEmulator',
  tagline: 'Jogue N64 online com amigos, direto no navegador.',

  landing: {
    createRoom: 'Criar sala',
    createRoomHint: 'Você roda o jogo no seu PC e os amigos entram pelo link.',
    joinRoom: 'Entrar numa sala',
    codePlaceholder: 'Código (ex.: K7QX2M)',
    join: 'Entrar',
  },

  library: {
    title: 'Biblioteca',
    empty: 'Nenhum jogo ainda. Adicione a ROM do seu jogo (ela fica salva só neste navegador).',
    addRom: 'Adicionar ROM',
    play: 'Jogar',
    remove: 'Remover',
    confirmRemove: (name: string) => `Remover "${name}" da biblioteca?`,
    testMode: 'Modo teste (sem ROM)',
    testModeHint: 'Uma tela de teste no lugar do jogo, para testar a conexão com os amigos.',
    storageUsed: (used: string, quota: string) => `${used} usados de ${quota} disponíveis`,
    notPersisted: 'O navegador pode apagar a biblioteca se o disco encher.',
    persist: 'Proteger biblioteca',
    adding: 'Adicionando…',
  },

  host: {
    loading: 'Carregando o emulador…',
    room: 'Sala',
    openingRoom: 'Abrindo sala…',
    roomError: 'Não foi possível abrir a sala. Verifique a internet e recarregue a página.',
    shareLink: 'Compartilhe o link ou o QR code:',
    copy: 'Copiar',
    copied: 'Copiado!',
    players: 'Jogadores',
    portHint: 'Escolher uma porta ocupada troca os dois jogadores de lugar.',
    hostName: 'Você (host)',
    spectator: 'Espectador',
    video: 'Vídeo enviado',
    bitrate: 'Qualidade',
    fps: 'FPS',
    preview: 'Preview do que os amigos veem',
    showPreview: 'Mostrar preview',
    saves: 'Saves',
    exportSave: 'Baixar save',
    importSave: 'Importar save',
    exportState: 'Baixar savestate',
    importState: 'Importar savestate',
    noSaveYet: 'O jogo ainda não gravou nada no cartucho.',
    savesUnavailable: 'Saves não disponíveis no modo teste.',
    log: 'Atividade',
    keepVisible: 'Mantenha esta aba visível: em segundo plano o navegador pausa o jogo para todos.',
    backToLibrary: 'Voltar à biblioteca',
    controlsHint:
      'Seus controles: WASD/setas, K = A, J = B, L = Z, Enter = Start, Q/E = L/R, T/F/G/H = C. Controle USB/Bluetooth também funciona.',
  },

  guest: {
    title: 'Entrar na sala',
    roomCode: 'Código da sala',
    name: 'Seu nome',
    join: 'Entrar',
    connecting: 'Conectando…',
    invalidCode: 'O código tem 6 letras e números.',
    you: (port: Port) => (port === null ? 'Espectador' : `Você é o P${port + 1}`),
    disconnected: 'Desconectado do host.',
    rejoin: 'Entrar de novo',
    fullscreen: 'Tela cheia',
    errors: {
      'room-not-found': 'Sala não encontrada. Confira o código ou peça um link novo.',
      network: 'Não foi possível conectar. Verifique a internet e tente de novo.',
      'version-mismatch': 'Sua página está desatualizada. Recarregue e tente de novo.',
      rejected: 'O host recusou a entrada.',
    } satisfies Record<GuestErrorCode, string>,
    controlsHint:
      'Teclado: WASD/setas (Shift = meia força), K = A, J = B, L = Z, Enter = Start, Q/E = L/R, T/F/G/H = C. Controle USB/Bluetooth também funciona. No celular aparecem botões na tela.',
  },
} as const;

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}
