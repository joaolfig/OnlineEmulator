import { useRef, useState } from 'preact/hooks';
import { buttonMask, clampAxis, AXIS_LIMIT, type Button, type PadState } from '../../core/input/pad';

/** Estado mutável do touch, lido a cada frame pelo laço de input (sem re-render por toque). */
export interface TouchState {
  buttons: number;
  x: number;
  y: number;
}

export const createTouchState = (): TouchState => ({ buttons: 0, x: 0, y: 0 });
export const readTouch = (state: TouchState): PadState => ({ ...state });

const STICK_RADIUS = 55;

// [rótulo, botão, right %, bottom %, tamanho px]
const LAYOUT: readonly (readonly [string, Button, number, number, number])[] = [
  ['A', 'A', 6, 18, 76],
  ['B', 'B', 20, 30, 64],
  ['Z', 'Z', 30, 10, 56],
  ['Start', 'START', 47, 4, 56],
  ['L', 'L', 88, 82, 52],
  ['R', 'R', 4, 82, 52],
  ['C▲', 'CUP', 12, 62, 40],
  ['C▼', 'CDOWN', 12, 44, 40],
  ['C◀', 'CLEFT', 19, 53, 40],
  ['C▶', 'CRIGHT', 5, 53, 40],
];

/** No modo "só controle" a tela inteira é do controle, então os botões crescem. */
const LARGE_SCALE = 1.35;

export function TouchControls({ state, large = false }: { state: TouchState; large?: boolean }) {
  const scale = large ? LARGE_SCALE : 1;
  return (
    <div class="touch">
      <Stick state={state} />
      {LAYOUT.map(([label, button, right, bottom, size]) => (
        <TouchButton
          key={button}
          {...{ label, button, right, bottom, state }}
          size={Math.round(size * scale)}
        />
      ))}
    </div>
  );
}

function Stick({ state }: { state: TouchState }) {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState<{ left: number; top: number; dx: number; dy: number } | null>(null);

  const end = (e: PointerEvent) => {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    state.x = 0;
    state.y = 0;
    setKnob(null);
  };

  return (
    <div
      class="touch-stick"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        const rect = e.currentTarget.getBoundingClientRect();
        setKnob({ left: e.clientX - rect.left, top: e.clientY - rect.top, dx: 0, dy: 0 });
      }}
      onPointerMove={(e) => {
        const o = origin.current;
        if (!o || o.id !== e.pointerId) return;
        let dx = e.clientX - o.x;
        let dy = e.clientY - o.y;
        const length = Math.hypot(dx, dy);
        if (length > STICK_RADIUS) {
          dx = (dx / length) * STICK_RADIUS;
          dy = (dy / length) * STICK_RADIUS;
        }
        state.x = clampAxis((dx / STICK_RADIUS) * AXIS_LIMIT);
        state.y = clampAxis((dy / STICK_RADIUS) * AXIS_LIMIT);
        setKnob((k) => k && { ...k, dx, dy });
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {knob && (
        <div class="touch-knob" style={{ left: `${knob.left}px`, top: `${knob.top}px` }}>
          <i style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
        </div>
      )}
    </div>
  );
}

interface TouchButtonProps {
  readonly label: string;
  readonly button: Button;
  readonly right: number;
  readonly bottom: number;
  readonly size: number;
  readonly state: TouchState;
}

function TouchButton({ label, button, right, bottom, size, state }: TouchButtonProps) {
  const [pressed, setPressed] = useState(false);
  const mask = buttonMask(button);
  const release = () => {
    state.buttons &= ~mask;
    setPressed(false);
  };
  return (
    <button
      class={`touch-btn${pressed ? ' on' : ''}`}
      aria-label={label}
      style={{
        right: `${right}%`,
        bottom: `${bottom}%`,
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size / 3.2)}px`,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        state.buttons |= mask;
        setPressed(true);
        navigator.vibrate?.(10);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      {label}
    </button>
  );
}
