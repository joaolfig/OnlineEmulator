/** A partir daqui são atalhos do EmulatorJS (salvar estado, acelerar…), não botões do controle. */
export const HOTKEY_FIRST_INDEX = 24;

/**
 * Para onde vai um input vindo dos controles do próprio EmulatorJS (teclado/controles do PC):
 * o "jogador 1" do menu 🎮 segue a porta do host na sala; se o host é espectador, é ignorado.
 * Os outros jogadores do menu e os atalhos passam sem mudança.
 * @returns a porta de destino, ou null para descartar.
 */
export function routeNativeInput(player: number, index: number, hostPort: number | null): number | null {
  if (player !== 0 || index >= HOTKEY_FIRST_INDEX) return player;
  return hostPort;
}
