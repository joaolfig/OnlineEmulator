import { useRef, useState } from 'preact/hooks';
import type { ControllerLayout } from '../../core/input/layout';
import {
  buttonMask,
  clampAxis,
  dpadMask,
  AXIS_LIMIT,
  DPAD_MASK,
  type Button,
  type PadState,
} from '../../core/input/pad';

/** Estado mutável do touch, lido a cada frame pelo laço de input (sem re-render por toque). */
export interface TouchState {
  buttons: number;
  x: number;
  y: number;
}

export const createTouchState = (): TouchState => ({ buttons: 0, x: 0, y: 0 });
export const readTouch = (state: TouchState): PadState => ({ ...state });

const STICK_RADIUS = 55;

// [rótulo, botão, right %, bottom %, tamanho px]. L e R ficam abaixo da barra do topo (nome, ping, ✨).
type ButtonSpec = readonly [string, Button, number, number, number];

/** Controle de N64: A, B, Z, Start, L, R e os quatro C. */
const N64_BUTTONS: readonly ButtonSpec[] = [
  ['A', 'A', 6, 18, 76],
  ['B', 'B', 20, 30, 64],
  ['Z', 'Z', 30, 10, 56],
  ['Start', 'START', 47, 4, 56],
  ['L', 'L', 88, 70, 52],
  ['R', 'R', 4, 70, 52],
  ['C▲', 'CUP', 12, 62, 40],
  ['C▼', 'CDOWN', 12, 44, 40],
  ['C◀', 'CLEFT', 19, 53, 40],
  ['C▶', 'CRIGHT', 5, 53, 40],
];

// [rótulo, botão, right %, bottom %, tamanho %], tudo relativo ao bloco de botões (que é quadrado).
type FaceSpec = readonly [string, Button, number, number, number];
type MenuSpec = readonly [string, Button];

interface RetroLayout {
  readonly face: readonly FaceSpec[];
  readonly menu: readonly MenuSpec[];
  readonly shoulders?: boolean;
}

// Os botões do app viram os do console pelo índice do RetroPad (ver systems.ts):
// A = 8, B = 0, C◀ = 1, C▲ = 9, L = 10, R = 11, Z = 2 (Select/Mode), START = 3.
const TWO_BUTTONS = (left: MenuSpec, right: MenuSpec): readonly FaceSpec[] => [
  [left[0], left[1], 52, 12, 44],
  [right[0], right[1], 2, 40, 44],
];

const SELECT_START: readonly MenuSpec[] = [
  ['Select', 'Z'],
  ['Start', 'START'],
];

const RETRO_LAYOUTS: Readonly<Record<Exclude<ControllerLayout, 'n64'>, RetroLayout>> = {
  snes: {
    face: [
      ['X', 'CUP', 33.5, 67, 33],
      ['A', 'A', 0, 33.5, 33],
      ['B', 'B', 33.5, 0, 33],
      ['Y', 'CLEFT', 67, 33.5, 33],
    ],
    menu: SELECT_START,
    shoulders: true,
  },
  nes: { face: TWO_BUTTONS(['B', 'B'], ['A', 'A']), menu: SELECT_START },
  gba: { face: TWO_BUTTONS(['B', 'B'], ['A', 'A']), menu: SELECT_START, shoulders: true },
  md: {
    face: [
      ['X', 'L', 68, 58, 30],
      ['Y', 'CUP', 35, 58, 30],
      ['Z', 'R', 2, 58, 30],
      ['A', 'CLEFT', 68, 18, 30],
      ['B', 'B', 35, 18, 30],
      ['C', 'A', 2, 18, 30],
    ],
    menu: [
      ['Mode', 'Z'],
      ['Start', 'START'],
    ],
  },
  sms: { face: TWO_BUTTONS(['1', 'B'], ['2', 'A']), menu: [['Pause', 'START']] },
  gg: { face: TWO_BUTTONS(['1', 'B'], ['2', 'A']), menu: [['Start', 'START']] },
  pce: {
    face: TWO_BUTTONS(['II', 'B'], ['I', 'A']),
    menu: [
      ['Select', 'Z'],
      ['Run', 'START'],
    ],
  },
};

/** No modo "só controle" a tela inteira é do controle, então os botões crescem. */
const LARGE_SCALE = 1.35;

interface TouchControlsProps {
  readonly state: TouchState;
  readonly large?: boolean;
  readonly layout?: ControllerLayout;
}

export function TouchControls({ state, large = false, layout = 'n64' }: TouchControlsProps) {
  // Segurar um botão não pode abrir o menu de contexto do navegador.
  const noMenu = (e: Event) => e.preventDefault();
  if (layout !== 'n64') {
    const { face, menu, shoulders } = RETRO_LAYOUTS[layout];
    return (
      <div class={`touch touch-retro${large ? ' large' : ''}`} onContextMenu={noMenu}>
        <Dpad state={state} />
        <div class="touch-face">
          {face.map(([label, button, right, bottom, size]) => (
            <PressButton
              key={button}
              {...{ label, button, state }}
              style={{
                right: `${right}%`,
                bottom: `${bottom}%`,
                width: `${size}%`,
                height: `${size}%`,
              }}
            />
          ))}
        </div>
        <div class="touch-menu">
          {menu.map(([label, button]) => (
            <PressButton key={button} {...{ label, button, state }} extraClass="pill-btn" />
          ))}
        </div>
        {shoulders && (
          <>
            <PressButton label="L" button="L" state={state} extraClass="pill-btn shoulder left" />
            <PressButton label="R" button="R" state={state} extraClass="pill-btn shoulder right" />
          </>
        )}
      </div>
    );
  }
  const scale = large ? LARGE_SCALE : 1;
  return (
    <div class="touch" onContextMenu={noMenu}>
      <Stick state={state} />
      {N64_BUTTONS.map(([label, button, right, bottom, size]) => {
        const px = Math.round(size * scale);
        return (
          <PressButton
            key={button}
            {...{ label, button, state }}
            style={{
              right: `${right}%`,
              bottom: `${bottom}%`,
              width: `${px}px`,
              height: `${px}px`,
              fontSize: `${Math.round(px / 3.2)}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Direcional em cruz: responde no toque, deixa deslizar entre as direções e aceita diagonais. */
function Dpad({ state }: { state: TouchState }) {
  const pointer = useRef<number | null>(null);
  const [active, setActive] = useState(0);

  const press = (e: PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const radius = rect.width / 2;
    const mask = dpadMask(
      (e.clientX - rect.left - radius) / radius,
      (e.clientY - rect.top - rect.height / 2) / radius,
    );
    state.buttons = (state.buttons & ~DPAD_MASK) | mask;
    setActive(mask);
  };
  const end = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    state.buttons &= ~DPAD_MASK;
    setActive(0);
  };

  return (
    <div
      class="touch-dpad"
      data-testid="dpad"
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = e.pointerId;
        press(e, e.currentTarget);
        navigator.vibrate?.(10);
      }}
      onPointerMove={(e) => {
        if (pointer.current === e.pointerId) press(e, e.currentTarget);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {(['DUP', 'DDOWN', 'DLEFT', 'DRIGHT'] as const).map((direction) => (
        <i
          key={direction}
          class={`arm ${direction.toLowerCase()}${active & buttonMask(direction) ? ' on' : ''}`}
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

interface PressButtonProps {
  readonly label: string;
  readonly button: Button;
  readonly state: TouchState;
  readonly style?: Readonly<Record<string, string>>;
  readonly extraClass?: string;
}

function PressButton({ label, button, state, style, extraClass }: PressButtonProps) {
  const [pressed, setPressed] = useState(false);
  const mask = buttonMask(button);
  const release = () => {
    state.buttons &= ~mask;
    setPressed(false);
  };
  return (
    <button
      class={`touch-btn${extraClass ? ` ${extraClass}` : ''}${pressed ? ' on' : ''}`}
      aria-label={label}
      style={style}
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
