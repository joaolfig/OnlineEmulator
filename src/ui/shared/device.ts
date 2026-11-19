// Detecção do tipo de aparelho e tela cheia, usadas pelo host e pelo convidado.

/** Tela de toque como dispositivo principal (celular/tablet). */
export const isTouchDevice = (): boolean => matchMedia('(pointer: coarse)').matches;

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/** Entra em tela cheia (no elemento dado) e tenta travar em paisagem. Sem suporte (iOS): segue sem. */
export async function enterFullscreen(element: HTMLElement): Promise<void> {
  try {
    await element.requestFullscreen();
    await (screen.orientation as LockableOrientation).lock?.('landscape');
  } catch {
    // Navegador sem suporte a tela cheia ou a travar a orientação.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
}
