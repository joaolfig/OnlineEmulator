// Ajustes de baixa latência e leitura de estatísticas de um RTCPeerConnection.

export interface VideoSendSettings {
  readonly maxBitrate: number;
  readonly maxFramerate: number;
}

export async function tuneVideoSender(pc: RTCPeerConnection, settings: VideoSendSettings): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue;
    const params = sender.getParameters();
    const [first, ...rest] = params.encodings.length > 0 ? params.encodings : [{}];
    params.encodings = [
      { ...first, maxBitrate: settings.maxBitrate, maxFramerate: settings.maxFramerate },
      ...rest,
    ];
    params.degradationPreference = 'maintain-framerate';
    await sender.setParameters(params);
  }
}

/** Pede ao navegador o menor buffer possível no receptor (troca suavidade por latência). */
export function lowLatencyReceivers(pc: RTCPeerConnection): void {
  for (const receiver of pc.getReceivers()) {
    // jitterBufferTarget é o padrão atual; playoutDelayHint é o nome antigo no Chrome.
    const r = receiver as { jitterBufferTarget?: number | null; playoutDelayHint?: number };
    if ('jitterBufferTarget' in receiver) r.jitterBufferTarget = 0;
    else if ('playoutDelayHint' in receiver) r.playoutDelayHint = 0;
  }
}

export interface VideoStats {
  readonly bytes: number;
  readonly fps: number | null;
}

/** Bytes e fps do vídeo enviado (outbound) ou recebido (inbound). */
export async function readVideoStats(
  pc: RTCPeerConnection,
  direction: 'outbound' | 'inbound',
): Promise<VideoStats | null> {
  const report = await pc.getStats();
  let result: VideoStats | null = null;
  report.forEach(
    (s: {
      type: string;
      kind?: string;
      bytesSent?: number;
      bytesReceived?: number;
      framesPerSecond?: number;
    }) => {
      if (s.type !== `${direction}-rtp` || s.kind !== 'video') return;
      result = {
        bytes: (direction === 'outbound' ? s.bytesSent : s.bytesReceived) ?? 0,
        fps: s.framesPerSecond ?? null,
      };
    },
  );
  return result;
}
