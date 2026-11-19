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
  /** Limite de mensagens de controle por segundo por convidado (o resto é descartado). */
  maxControlMessagesPerSecond: 30,

  saves: {
    /** Grava a memória do cartucho no navegador (o próprio EmulatorJS só grava a cada 5 min). */
    cartridgeFlushIntervalMs: 60_000,
    /** Savestate automático para "continuar de onde parou". */
    autoStateIntervalMs: 5 * 60_000,
    /** Quantos savestates automáticos guardar por jogo. */
    autoStatesKept: 3,
  },

  video: {
    captureFps: 60,
    defaultFps: 60,
    fpsOptions: [60, 30],
    defaultBitrate: 2_500_000,
    bitrateOptions: [1_000_000, 2_500_000, 4_000_000],
  },
} as const;
