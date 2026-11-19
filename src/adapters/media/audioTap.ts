// Plano B de captura de áudio: intercepta AudioNode.connect e duplica o que vai para os
// alto-falantes num MediaStreamDestination. Precisa ser instalado ANTES do EmulatorJS carregar.
// É um monkey-patch global, por isso fica isolado aqui: idempotente e desinstalável.

const taps = new WeakMap<BaseAudioContext, MediaStreamAudioDestinationNode>();
let original: AudioNode['connect'] | undefined;
let resolveStream: (stream: MediaStream) => void = () => {};
const firstTapStream = new Promise<MediaStream>((resolve) => (resolveStream = resolve));

export function installAudioTap(): () => void {
  if (original) return uninstallAudioTap;
  const connect = AudioNode.prototype.connect;
  original = connect;
  AudioNode.prototype.connect = function (this: AudioNode, ...args: Parameters<typeof connect>) {
    const result = connect.apply(this, args);
    const ctx = this.context;
    if (args[0] instanceof AudioDestinationNode && ctx instanceof AudioContext) {
      let tap = taps.get(ctx);
      if (!tap) {
        tap = ctx.createMediaStreamDestination();
        taps.set(ctx, tap);
        resolveStream(tap.stream);
      }
      (connect as (destination: AudioNode) => AudioNode).call(this, tap);
    }
    return result;
  } as typeof connect;
  return uninstallAudioTap;
}

export function uninstallAudioTap(): void {
  if (original) AudioNode.prototype.connect = original;
  original = undefined;
}

/** Stream do primeiro AudioContext que tocou som, ou null se nada tocar até o timeout. */
export function tappedAudio(timeoutMs: number): Promise<MediaStream | null> {
  return Promise.race([firstTapStream, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}
