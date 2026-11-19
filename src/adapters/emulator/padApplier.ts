import { AXIS_LIMIT, BUTTONS, EMPTY_PAD, foldStickIntoDpad, type PadState } from '../../core/input/pad';
import { AXIS_VALUE_MAX, FIRST_ANALOG_INDEX, N64_STICK_INDEX } from './n64map';
import { N64_MAPPING, type PadMapping } from './systems';

export type SimulateInput = (port: number, index: number, value: number) => void;

const axisValue = (v: number): number => Math.round((Math.abs(v) / AXIS_LIMIT) * AXIS_VALUE_MAX);

/** Traduz PadState em chamadas simulateInput do EmulatorJS, enviando só o que mudou. */
export class PadApplier {
  private readonly last = new Map<number, PadState>();

  constructor(
    private readonly simulateInput: SimulateInput,
    private readonly mapping: PadMapping = N64_MAPPING,
  ) {}

  apply(port: number, input: PadState): void {
    const pad = this.mapping.stick === 'dpad' ? foldStickIntoDpad(input) : input;
    const prev = this.last.get(port) ?? EMPTY_PAD;
    const changed = prev.buttons ^ pad.buttons;
    BUTTONS.forEach((button, bit) => {
      if (!(changed & (1 << bit))) return;
      const index = this.mapping.buttons[button];
      if (index === undefined) return; // botão que esse console não tem
      const down = (pad.buttons & (1 << bit)) !== 0;
      this.simulateInput(port, index, down ? (index >= FIRST_ANALOG_INDEX ? AXIS_VALUE_MAX : 1) : 0);
    });
    if (prev.x !== pad.x) {
      this.simulateInput(port, N64_STICK_INDEX.right, pad.x > 0 ? axisValue(pad.x) : 0);
      this.simulateInput(port, N64_STICK_INDEX.left, pad.x < 0 ? axisValue(pad.x) : 0);
    }
    if (prev.y !== pad.y) {
      this.simulateInput(port, N64_STICK_INDEX.down, pad.y > 0 ? axisValue(pad.y) : 0);
      this.simulateInput(port, N64_STICK_INDEX.up, pad.y < 0 ? axisValue(pad.y) : 0);
    }
    this.last.set(port, pad);
  }

  release(port: number): void {
    this.apply(port, EMPTY_PAD);
  }
}
