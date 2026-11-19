import { padFromGamepad } from '../../core/input/gamepad';
import { mergePads, type PadState } from '../../core/input/pad';

/** Lê todos os gamepads conectados (mapeamento "standard") e junta num único controle. */
export function readGamepads(): PadState {
  const pads: PadState[] = [];
  for (const gp of navigator.getGamepads?.() ?? []) {
    if (!gp || gp.mapping !== 'standard') continue;
    pads.push(padFromGamepad({ buttons: gp.buttons.map((b) => b.pressed), axes: gp.axes }));
  }
  return mergePads(pads);
}
