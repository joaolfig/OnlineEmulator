// Todos os textos da interface num só lugar (facilita revisar e traduzir).

import type { GuestErrorCode } from '../app/guest/guestSession';
import type { DeviceMode, Port } from '../core/room/room';
import type { EffectId } from '../effects/catalog';

export const t = {
  appName: 'OnlineEmulator',
  tagline: 'Jogue N64 online com amigos, direto no navegador.',

  effects: {
    label: 'Efeitos visuais',
    hint: 'Dá para ligar vários. Só neste aparelho: não muda o jogo nem o que os outros veem.',
    names: {
      tilt: 'Inclinação dinâmica',
      crt: 'TV de tubo',
      relief: 'Relevo com luz',
    } satisfies Record<EffectId, string>,
    failed: 'Não foi possível ligar os efeitos visuais neste aparelho',
  },

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
    playFromStart: 'Jogar do início',
    resume: 'Continuar',
    savedAt: (date: string) => `Salvo em ${date}`,
    olderStates: 'Estados salvos',
    stateFromOtherVersion: 'Salvo numa versão anterior do emulador: pode não abrir.',
    changeCover: 'Trocar capa',
    defaultCover: 'Capa padrão',
    remove: 'Remover',
    confirmRemove: (name: string) =>
      `Remover "${name}" da biblioteca? Os estados salvos ("Continuar") deste jogo também serão apagados.`,
    notInCatalog: 'Jogo não encontrado no catálogo',
    testMode: 'Modo teste (sem ROM)',
    testModeHint: 'Uma tela de teste no lugar do jogo, para testar a conexão com os amigos.',
    storageUsed: (used: string, quota: string) => `${used} usados de ${quota} disponíveis`,
    notPersisted: 'O navegador pode apagar a biblioteca se o disco encher.',
    persist: 'Proteger biblioteca',
    adding: 'Adicionando…',
    credits: 'Nomes e capas: libretro-database e libretro-thumbnails (CC-BY-SA 4.0).',
  },

  host: {
    loading: 'Carregando o emulador…',
    resuming: 'Continuando de onde parou…',
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
    modeLabel: { play: '', controller: '🎮 só controle', watch: '📺 tela' } satisfies Record<
      DeviceMode,
      string
    >,
    video: 'Vídeo enviado',
    bitrate: 'Qualidade',
    fps: 'FPS',
    preview: 'Preview do que os amigos veem',
    showPreview: 'Mostrar preview',
    saves: 'Saves',
    autoSaveStatus: (cartridge: string, state: string) =>
      `Cartucho salvo: ${cartridge} · Estado salvo: ${state}`,
    never: 'ainda não',
    saveNow: 'Salvar agora',
    exportSave: 'Baixar save',
    importSave: 'Importar save',
    exportState: 'Baixar savestate',
    importState: 'Importar savestate',
    noSaveYet: 'O jogo ainda não gravou nada no cartucho.',
    savesUnavailable: 'Saves não disponíveis no modo teste.',
    log: 'Atividade',
    keepVisible: 'Mantenha esta aba visível: em segundo plano o navegador pausa o jogo para todos.',
    backToLibrary: 'Voltar à biblioteca',
    saveAndExit: 'Sair e salvar',
    fullscreen: 'Tela cheia',
    exitFullscreen: 'Sair da tela cheia',
    touchHint:
      'Toque em ⛶ para jogar em tela cheia com os botões na tela. Controle Bluetooth também funciona.',
    phoneHostWarning:
      'Rodar o jogo no celular é pesado e pode ficar lento (principalmente N64). Para jogar liso, use um PC como host; o celular funciona muito bem como convidado.',
    saving: 'Salvando…',
    controlsHint:
      'Seus controles: WASD/setas, K = A, J = B, L = Z, Enter = Start, Q/E = L/R, T/F/G/H = C. Controle USB/Bluetooth também funciona.',
  },

  time: {
    speed: 'Velocidade',
    normal: 'Normal',
    speedHint:
      'Acelerado para todos. "Até" essa velocidade: se o PC não aguentar, o jogo acelera o quanto der. O som fica acelerado também.',
    rewind: 'Voltar no tempo',
    step: (seconds: number) => (seconds < 60 ? `${seconds} s` : `${seconds / 60} min`),
    notYet: 'Ainda não há um ponto tão antigo: o jogo guarda um ponto a cada 10 segundos.',
    undo: 'Desfazer',
    rewindHint: (reach: number, memory: string) =>
      `Dá para voltar até ${reach} s (pontos a cada 10 s, últimos 5 min, ${memory} na memória). Volta o jogo de todo mundo.`,
  },

  guest: {
    title: 'Entrar na sala',
    roomCode: 'Código da sala',
    name: 'Seu nome',
    join: 'Entrar',
    connecting: 'Conectando…',
    invalidCode: 'O código tem 6 letras e números.',
    modeQuestion: 'Como este aparelho vai participar?',
    modes: {
      play: { label: 'Jogar', hint: 'Vê o jogo e controla.' },
      controller: {
        label: 'Só controle',
        hint: 'Para quando todos olham a mesma TV: o celular vira só um controle, sem vídeo nem som.',
      },
      watch: { label: 'Só assistir', hint: 'Mostra o jogo sem controles, ex.: um aparelho ligado na TV.' },
    } satisfies Record<DeviceMode, { label: string; hint: string }>,
    you: (port: Port) => (port === null ? 'Espectador' : `Você é o P${port + 1}`),
    playerBadge: (port: number) => `P${port + 1}`,
    speed: (multiplier: number) => `⏩ ${multiplier}x`,
    rewound: (seconds: number) =>
      `⏪ O host voltou ${seconds < 60 ? `${seconds} s` : `${seconds / 60} min`} no tempo`,
    waitingForPort: 'Sala cheia: aguardando o host liberar uma porta.',
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

/** Cor de cada porta, a mesma usada no jogo de teste e nos indicadores. */
export const PORT_COLORS = ['#f0506e', '#5b8cff', '#f5a524', '#3ecf8e'] as const;

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

export const formatDateTime = (time: number): string =>
  new Date(time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const formatTime = (time: number | null): string =>
  time === null ? t.host.never : new Date(time).toLocaleTimeString('pt-BR', { timeStyle: 'short' });
