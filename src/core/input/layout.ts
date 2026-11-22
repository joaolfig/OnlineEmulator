/**
 * Layout dos botões na tela do convidado, conforme o console do jogo:
 * - n64: analógico, A, B, Z, Start, L, R e C-buttons;
 * - snes: direcional, A, B, X, Y, Select, Start, L, R;
 * - nes: direcional, A, B, Select, Start (também Game Boy);
 * - gba: direcional, A, B, Select, Start, L, R;
 * - md: direcional, A, B, C, X, Y, Z, Mode, Start;
 * - sms: direcional, 1, 2, Pause;
 * - gg: direcional, 1, 2, Start;
 * - pce: direcional, I, II, Select, Run.
 */
export const CONTROLLER_LAYOUTS = ['n64', 'snes', 'nes', 'gba', 'md', 'sms', 'gg', 'pce'] as const;
export type ControllerLayout = (typeof CONTROLLER_LAYOUTS)[number];
