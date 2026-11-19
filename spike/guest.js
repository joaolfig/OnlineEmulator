import { PROTOCOL_VERSION, PEER_PREFIX, ICE_SERVERS, HEARTBEAT_MS, emptyPad, samePad, log } from './shared.js';
import { bit, readKeyboard, readGamepads } from './input.js';

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
$('code').value = (params.get('r') ?? '').toUpperCase();
$('name').value = localStorage.getItem('onlemu-name') ?? '';
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

const portLabel = (port) => (port >= 0 ? `Você é o P${port + 1}` : 'Espectador');

// ---------- Touch ----------
const touch = { buttons: 0, x: 0, y: 0 };
function buildTouch() {
  const root = $('touch');
  const stick = Object.assign(document.createElement('div'), { className: 'stick' });
  const knob = Object.assign(document.createElement('div'), { className: 'knob' });
  const dot = document.createElement('i');
  knob.append(dot);
  stick.append(knob);
  root.append(stick);
  const RADIUS = 55;
  let origin = null;
  stick.addEventListener('pointerdown', (e) => {
    stick.setPointerCapture(e.pointerId);
    origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
    const r = stick.getBoundingClientRect();
    Object.assign(knob.style, { display: 'block', left: `${e.clientX - r.left}px`, top: `${e.clientY - r.top}px` });
  });
  stick.addEventListener('pointermove', (e) => {
    if (!origin || e.pointerId !== origin.id) return;
    let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
    dot.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.x = Math.round((dx / RADIUS) * 127);
    touch.y = Math.round((dy / RADIUS) * 127);
  });
  const end = (e) => {
    if (!origin || e.pointerId !== origin.id) return;
    origin = null;
    touch.x = touch.y = 0;
    dot.style.transform = '';
    knob.style.display = 'none';
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);

  // [rótulo, botão, right%, bottom%, tamanho px]
  const layout = [
    ['A', 'A', 6, 18, 76], ['B', 'B', 20, 30, 64], ['Z', 'Z', 30, 10, 56],
    ['Start', 'START', 47, 4, 56], ['L', 'L', 88, 82, 52], ['R', 'R', 4, 82, 52],
    ['C▲', 'CUP', 12, 62, 40], ['C▼', 'CDOWN', 12, 44, 40], ['C◀', 'CLEFT', 19, 53, 40], ['C▶', 'CRIGHT', 5, 53, 40],
  ];
  for (const [label, name, right, bottom, size] of layout) {
    const b = Object.assign(document.createElement('div'), { className: 'tbtn', textContent: label });
    Object.assign(b.style, { right: `${right}%`, bottom: `${bottom}%`, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 3.2)}px` });
    const on = (e) => { e.preventDefault(); touch.buttons |= bit(name); b.classList.add('on'); navigator.vibrate?.(10); };
    const off = () => { touch.buttons &= ~bit(name); b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    root.append(b);
  }
}

function readTouch(pad) {
  pad.buttons |= touch.buttons;
  if (touch.x || touch.y) { pad.x = touch.x; pad.y = touch.y; }
}

// ---------- Rede ----------
let conn = null;
let seq = 0;
let lastSent = emptyPad();
let lastSentAt = 0;

function inputLoop() {
  const pad = emptyPad();
  readKeyboard(pad);
  readGamepads(pad);
  readTouch(pad);
  const now = performance.now();
  if (conn?.open && (!samePad(pad, lastSent) || now - lastSentAt > HEARTBEAT_MS)) {
    seq = (seq + 1) & 0xffff;
    conn.send({ t: 'in', seq, b: pad.buttons, x: pad.x, y: pad.y });
    lastSent = pad;
    lastSentAt = now;
  }
  requestAnimationFrame(inputLoop);
}

function status(text, cls = 'muted') {
  $('status').textContent = text;
  $('status').className = cls;
}

function lowLatencyReceivers(pc) {
  for (const r of pc.getReceivers()) {
    if ('jitterBufferTarget' in r) r.jitterBufferTarget = 0;
    else if ('playoutDelayHint' in r) r.playoutDelayHint = 0;
  }
}

function join() {
  const code = $('code').value.trim().toUpperCase();
  const name = $('name').value.trim() || 'Jogador';
  if (code.length !== 6) return status('Digite o código de 6 letras da sala.', 'err');
  localStorage.setItem('onlemu-name', name);
  $('enter').disabled = true;
  status('Conectando…');

  const peer = new Peer({ config: { iceServers: ICE_SERVERS } });
  peer.on('error', (err) => {
    log(err);
    status(err.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.' : `Erro de rede: ${err.type}`, 'err');
    $('enter').disabled = false;
  });
  peer.on('open', () => {
    conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    conn.on('open', () => conn.send({ t: 'hello', v: PROTOCOL_VERSION, name }));
    conn.on('data', (msg) => {
      if (msg.t === 'welcome') {
        $('join').hidden = true;
        $('stage').hidden = false;
        $('who').textContent = msg.port >= 0 ? portLabel(msg.port) : 'Espectador (sala cheia)';
      } else if (msg.t === 'port') {
        $('who').textContent = portLabel(msg.port);
      } else if (msg.t === 'pong') {
        const rtt = performance.now() - msg.ts;
        conn.send({ t: 'rtt', ms: rtt });
        $('net').dataset.rtt = Math.round(rtt);
      } else if (msg.t === 'error') {
        status(msg.message, 'err');
      }
    });
    conn.on('close', () => {
      $('who').textContent = 'Desconectado do host';
      status('Desconectado do host.', 'err');
    });
  });
  peer.on('call', (call) => {
    call.answer();
    call.on('stream', (stream) => {
      const video = $('video');
      video.srcObject = stream;
      video.play().catch(() => {
        video.muted = true; // fallback se o navegador bloquear áudio
        video.play();
      });
      lowLatencyReceivers(call.peerConnection);
      watchStats(call.peerConnection);
    });
  });
}

function watchStats(pc) {
  setInterval(async () => {
    const stats = await pc.getStats();
    let fps = '?';
    stats.forEach((s) => {
      if (s.type === 'inbound-rtp' && s.kind === 'video') fps = Math.round(s.framesPerSecond ?? 0);
    });
    $('net').textContent = `ping ${$('net').dataset.rtt ?? '?'} ms · ${fps} fps`;
  }, 1000);
  setInterval(() => conn?.open && conn.send({ t: 'ping', ts: performance.now() }), 1000);
}

$('enter').onclick = join;
$('code').addEventListener('keydown', (e) => e.key === 'Enter' && join());
$('name').addEventListener('keydown', (e) => e.key === 'Enter' && join());
$('fs').onclick = async () => {
  try {
    await document.documentElement.requestFullscreen();
    await screen.orientation?.lock?.('landscape');
  } catch { /* iOS não suporta; ignorar */ }
};

buildTouch();
requestAnimationFrame(inputLoop);
