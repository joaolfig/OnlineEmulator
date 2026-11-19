// Todas as constantes do app num só lugar (nada de números mágicos espalhados).

export const config = {
  /** Prefixo dos IDs no servidor público do PeerJS, para não colidir com outros apps. */
  peerIdPrefix: 'onlemu-v1-',
  /** Versão fixada do EmulatorJS: o adapter depende de APIs internas dele. */
  ejsVersion: '4.2.3',
  get ejsDataUrl(): string {
    return `https://cdn.emulatorjs.org/${this.ejsVersion}/data/`;
  },
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ] satisfies RTCIceServer[],

  /** Portas de controle do console (N64 = 4). */
  portCount: 4,
  roomCodeLength: 6,
  maxNameLength: 20,
  maxChatLength: 200,

  /** O convidado reenvia o estado do controle mesmo sem mudança, para cobrir pacotes perdidos. */
  inputHeartbeatMs: 50,
  pingIntervalMs: 1000,
  statsIntervalMs: 1000,
  joinTimeoutMs: 15_000,
  /** O convidado repete o "olá" neste intervalo até o host responder. */
  helloRetryMs: 1500,
  /** Limite de mensagens de controle por segundo por convidado (o resto é descartado). */
  maxControlMessagesPerSecond: 30,

  saves: {
    /** Grava a memória do cartucho no navegador (o próprio EmulatorJS só grava a cada 5 min). */
    cartridgeFlushIntervalMs: 60_000,
    /** Savestate automático para "continuar de onde parou". */
    autoStateIntervalMs: 60_000,
    /** Quantos savestates automáticos guardar por jogo: só o último. */
    autoStatesKept: 1,
  },

  /**
   * "Voltar no tempo": savestates comprimidos só na memória da aba, tirados periodicamente.
   * Nada disso vai para o disco: some ao sair do jogo ou fechar a janela.
   */
  rewind: {
    snapshotIntervalMs: 60_000,
    /** 6 pontos (o atual e um por minuto) cobrem sempre os últimos 5 minutos. */
    snapshotsKept: 6,
    /** Botões de voltar, em segundos. */
    stepsSeconds: [60, 120, 300],
  },

  /** Velocidades do "acelerar" (1 = normal). O limite real é o quanto o PC aguenta. */
  speedOptions: [1, 2, 3, 4],
  maxSpeed: 8,

  video: {
    captureFps: 60,
    defaultFps: 60,
    fpsOptions: [60, 30],
    defaultBitrate: 2_500_000,
    bitrateOptions: [1_000_000, 2_500_000, 4_000_000],
  },
} as const;
