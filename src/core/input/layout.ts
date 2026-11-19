/**
 * Layout dos botões na tela do convidado, conforme o console do jogo:
 * - n64: analógico, A, B, Z, Start, L, R e C-buttons;
 * - retropad: consoles 2D (direcional, A, B, X, Y, Select, Start, L, R).
 */
export const CONTROLLER_LAYOUTS = ['n64', 'retropad'] as const;
export type ControllerLayout = (typeof CONTROLLER_LAYOUTS)[number];
