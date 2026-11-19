import {
  PROTOCOL_VERSION, PEER_PREFIX, EJS_DATA, ICE_SERVERS, MAX_GUEST_PORTS,
  N64, STICK, AXIS_MAX, BUTTON_BITS, emptyPad, samePad, isValidPad, isNewerSeq, randomCode, log,
} from './shared.js';
import { readKeyboard, readGamepads } from './input.js';

const $ = (id) => document.getElementById(id);

// ---------- Log visível na página ----------
function note(msg, cls = '') {
  log(msg);
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()} ${msg}`;
  if (cls) line.className = cls;
  $('log').prepend(line);
}
window.addEventListener('error', (e) => note(`Erro: ${e.message}`, 'err'));
window.addEventListener('unhandledrejection', (e) => note(`Erro: ${e.reason?.message ?? e.reason}`, 'err'));

// ---------- Plano B de áudio: interceptar AudioNode.connect (instalado antes do EmulatorJS) ----------
const audioTaps = new WeakMap();
let resolveTapStream;
const tapStream = new Promise((r) => (resolveTapStream = r));
{
  const original = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (...args) {
    const result = original.apply(this, args);
    if (args[0] instanceof AudioDestinationNode) {
      let tap = audioTaps.get(this.context);
      if (!tap) {
        tap = this.context.createMediaStreamDestination();
        audioTaps.set(this.context, tap);
        resolveTapStream(tap.stream);
      }
      original.call(this, tap);
    }
    return result;
  };
}

// ---------- Emuladores: EmulatorJS real ou falso (modo teste) ----------
function startEmulatorJS(file, disableDefaultControls) {
  return new Promise((resolve, reject) => {
    Object.assign(window, {
      EJS_player: '#game',
      EJS_core: 'n64',
      EJS_gameUrl: file, // o EmulatorJS aceita File direto
      EJS_gameName: file.name.replace(/\.[^.]+$/, ''),
      EJS_pathtodata: EJS_DATA,
      EJS_startOnLoaded: true,
      EJS_onGameStart: () => {
        const ejs = window.EJS_emulator;
        resolve({
          canvas: ejs.canvas,
          simulateInput: (port, index, value) => ejs.gameManager.simulateInput(port, index, value),
          ejs,
        });
      },
    });
    if (disableDefaultControls) {
      window.EJS_defaultControls = { 0: {}, 1: {}, 2: {}, 3: {} };
      window.EJS_disableLocalStorage = true; // senão os controles salvos sobrescrevem
    }
    const script = document.createElement('script');
    script.src = `${EJS_DATA}loader.js`;
    script.onerror = () => reject(new Error('Falha ao carregar o EmulatorJS do CDN'));
    document.body.append(script);
  });
}

function startFakeEmulator() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  $('game').append(canvas);
  canvas.style.width = '100%';
  const ctx = canvas.getContext('2d');
  const pressed = new Map(); // "porta:indice" → valor
  const players = [0, 1, 2, 3].map((p) => ({ x: 120 + p * 130, y: 240 }));
  const colors = ['#f0506e', '#5b8cff', '#f5a524', '#3ecf8e'];

  // Áudio: um tom que muda de nota quando qualquer porta aperta A.
  const audioCtx = new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.05;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();

  let frame = 0;
  (function draw() {
    frame++;
    ctx.fillStyle = '#101020';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText(`MODO TESTE  frame ${frame}`, 20, 34);
    let anyA = false;
    players.forEach((pl, p) => {
      const v = (i) => pressed.get(`${p}:${i}`) ?? 0;
      pl.x = Math.max(20, Math.min(620, pl.x + ((v(STICK.RIGHT) - v(STICK.LEFT)) / AXIS_MAX) * 5));
      pl.y = Math.max(60, Math.min(460, pl.y + ((v(STICK.DOWN) - v(STICK.UP)) / AXIS_MAX) * 5));
      const a = v(N64.A) > 0;
      anyA ||= a;
      ctx.fillStyle = colors[p];
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, a ? 26 : 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(`P${p + 1}`, pl.x - 14, pl.y - 30);
    });
    osc.frequency.value = anyA ? 660 : 220 + (frame % 120);
    requestAnimationFrame(draw);
  })();

  return {
    canvas,
    simulateInput: (port, index, value) => pressed.set(`${port}:${index}`, value),
    ejs: null,
  };
}

// ---------- Captura ----------
async function buildStream(emu, audioMode) {
  if (audioMode === 'ejs' && emu.ejs?.collectScreenRecordingMediaTracks) {
    const stream = emu.ejs.collectScreenRecordingMediaTracks(emu.canvas, 60);
    if (stream?.getAudioTracks().length) {
      note('Áudio capturado pela função do EmulatorJS', 'ok');
    } else {
      note('A função do EmulatorJS não retornou áudio. Tente o plano B.', 'warn');
    }
    return stream;
  }
  const stream = new MediaStream(emu.canvas.captureStream(60).getVideoTracks());
  const audio = await Promise.race([tapStream, new Promise((r) => setTimeout(() => r(null), 3000))]);
  if (audio) {
    audio.getAudioTracks().forEach((t) => stream.addTrack(t));
    note('Áudio capturado interceptando AudioNode', 'ok');
  } else {
    note('Nenhum áudio interceptado em 3 s', 'warn');
  }
  return stream;
}

// ---------- Aplicar inputs (só o que mudou) ----------
const lastPads = new Map(); // porta → pad
let emulator = null;

function applyPad(port, pad) {
  const prev = lastPads.get(port) ?? emptyPad();
  if (samePad(prev, pad)) return;
  BUTTON_BITS.forEach((name, bit) => {
    const was = (prev.buttons >> bit) & 1;
    const now = (pad.buttons >> bit) & 1;
    if (was !== now) {
      const index = N64[name];
      emulator.simulateInput(port, index, now ? (index >= 16 ? AXIS_MAX : 1) : 0);
    }
  });
  if (prev.x !== pad.x) {
    const v = Math.round((Math.abs(pad.x) / 127) * AXIS_MAX);
    emulator.simulateInput(port, STICK.RIGHT, pad.x > 0 ? v : 0);
    emulator.simulateInput(port, STICK.LEFT, pad.x < 0 ? v : 0);
  }
  if (prev.y !== pad.y) {
    const v = Math.round((Math.abs(pad.y) / 127) * AXIS_MAX);
    emulator.simulateInput(port, STICK.DOWN, pad.y > 0 ? v : 0);
    emulator.simulateInput(port, STICK.UP, pad.y < 0 ? v : 0);
  }
  lastPads.set(port, { ...pad });
}
const releaseAll = (port) => applyPad(port, emptyPad());

// ---------- Botões de teste do P2 ----------
function setupP2TestButtons() {
  const pad = emptyPad();
  const defs = [
    ['A', () => (pad.buttons |= 1 << BUTTON_BITS.indexOf('A')), () => (pad.buttons &= ~(1 << BUTTON_BITS.indexOf('A')))],
    ['B', () => (pad.buttons |= 1 << BUTTON_BITS.indexOf('B')), () => (pad.buttons &= ~(1 << BUTTON_BITS.indexOf('B')))],
    ['Start', () => (pad.buttons |= 1 << BUTTON_BITS.indexOf('START')), () => (pad.buttons &= ~(1 << BUTTON_BITS.indexOf('START')))],
    ['Z', () => (pad.buttons |= 1 << BUTTON_BITS.indexOf('Z')), () => (pad.buttons &= ~(1 << BUTTON_BITS.indexOf('Z')))],
    ['◀', () => (pad.x = -127), () => (pad.x = 0)],
    ['▲', () => (pad.y = -127), () => (pad.y = 0)],
    ['▼', () => (pad.y = 127), () => (pad.y = 0)],
    ['▶', () => (pad.x = 127), () => (pad.x = 0)],
  ];
  for (const [label, down, up] of defs) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('pointerdown', () => { down(); applyPad(1, pad); });
    for (const ev of ['pointerup', 'pointerleave']) b.addEventListener(ev, () => { up(); applyPad(1, pad); });
    $('p2buttons').append(b);
  }
}

// ---------- Saves ----------
function download(data, filename) {
  const url = URL.createObjectURL(new Blob([data]));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const today = () => new Date().toISOString().slice(0, 10);

function pickFile() {
  return new Promise((resolve) => {
    const input = $('saveFile');
    input.value = '';
    input.onchange = () => resolve(input.files[0] ?? null);
    input.click();
  });
}

function setupSaves(emu) {
  if (!emu.ejs) {
    $('savesPanel').querySelectorAll('button').forEach((b) => (b.disabled = true));
    return;
  }
  const gm = emu.ejs.gameManager;
  const name = window.EJS_gameName;
  $('exportSave').onclick = () => {
    const data = gm.getSaveFile();
    if (!data) return note('O jogo ainda não gravou save no cartucho', 'warn');
    const ext = gm.getSaveFilePath().split('.').pop();
    download(data, `${name} (${today()}).${ext}`);
    note(`Save exportado (${data.length} bytes)`, 'ok');
  };
  $('importSave').onclick = async () => {
    const file = await pickFile();
    if (!file) return;
    const path = gm.getSaveFilePath();
    let dir = '';
    for (const part of path.split('/').slice(0, -1)) {
      if (!part) continue;
      dir += `/${part}`;
      if (!gm.FS.analyzePath(dir).exists) gm.FS.mkdir(dir);
    }
    if (gm.FS.analyzePath(path).exists) gm.FS.unlink(path);
    gm.FS.writeFile(path, new Uint8Array(await file.arrayBuffer()));
    gm.loadSaveFiles();
    note(`Save importado: ${file.name}. Pode ser preciso reiniciar o jogo.`, 'ok');
  };
  $('exportState').onclick = () => {
    const data = gm.getState();
    download(data, `${name} (${today()}).state`);
    note(`Savestate exportado (${(data.length / 1024 / 1024).toFixed(1)} MB)`, 'ok');
  };
  $('importState').onclick = async () => {
    const file = await pickFile();
    if (!file) return;
    gm.loadState(new Uint8Array(await file.arrayBuffer()));
    note(`Savestate carregado: ${file.name}`, 'ok');
  };
}

// ---------- Sala (PeerJS) ----------
const guests = new Map(); // peerId → { conn, call, port, name, lastSeq, rtt, kbps }
let stream = null;
// O host também é um participante: joga pelo teclado/controle do PC numa porta escolhível.
const host = { id: 'host', name: 'Host (local)', port: 0, isHost: true };
let hostControlsLocked = false; // true quando os controles padrão do EmulatorJS estão ligados (presos ao P1)

const participants = () => [host, ...guests.values()].filter((p) => p.isHost || p.name);
const TOTAL_PORTS = MAX_GUEST_PORTS + 1;

function freePort() {
  const used = new Set(participants().map((p) => p.port));
  for (let p = 0; p < TOTAL_PORTS; p++) if (!used.has(p)) return p;
  return -1;
}

function notifyPort(p) {
  if (!p.isHost && p.conn.open) p.conn.send({ t: 'port', port: p.port });
}

// Move o participante para a porta pedida; se ela estiver ocupada, os dois trocam de lugar.
function setPort(who, newPort) {
  const oldPort = who.port;
  if (newPort === oldPort) return;
  const other = newPort >= 0 ? participants().find((p) => p !== who && p.port === newPort) : null;
  if ((who.isHost || other?.isHost) && hostControlsLocked) {
    note('O host está preso ao P1 porque os controles padrão do EmulatorJS estão ligados', 'warn');
    return renderPlayers();
  }
  if (oldPort >= 0) releaseAll(oldPort);
  if (newPort >= 0) releaseAll(newPort);
  who.port = newPort;
  if (other) other.port = oldPort;
  notifyPort(who);
  if (other) notifyPort(other);
  note(`${who.name} → ${newPort >= 0 ? `P${newPort + 1}` : 'espectador'}` +
    (other ? ` · ${other.name} → ${oldPort >= 0 ? `P${oldPort + 1}` : 'espectador'}` : ''), 'ok');
  renderPlayers();
}

// As linhas são mantidas entre renders para o <select> não fechar durante as atualizações de stats.
const rows = new Map(); // id → { tr, select, cells }
function renderPlayers() {
  const list = participants();
  for (const [id, row] of rows) {
    if (!list.some((p) => (p.isHost ? 'host' : p.conn.peer) === id)) {
      row.tr.remove();
      rows.delete(id);
    }
  }
  for (const p of list) {
    const id = p.isHost ? 'host' : p.conn.peer;
    let row = rows.get(id);
    if (!row) {
      const tr = document.createElement('tr');
      const select = document.createElement('select');
      for (let i = 0; i < TOTAL_PORTS; i++) select.add(new Option(`P${i + 1}`, String(i)));
      select.add(new Option('Espectador', '-1'));
      select.onchange = () => setPort(p, Number(select.value));
      const cells = [0, 1, 2].map(() => document.createElement('td'));
      const selectCell = document.createElement('td');
      selectCell.append(select);
      tr.append(selectCell, ...cells);
      $('players').append(tr);
      row = { tr, select, cells };
      rows.set(id, row);
    }
    if (document.activeElement !== row.select) row.select.value = String(p.port);
    row.select.disabled = p.isHost && hostControlsLocked;
    row.cells[0].textContent = p.name;
    row.cells[1].textContent = p.rtt != null ? `${p.rtt} ms` : '—';
    row.cells[2].textContent = p.kbps != null ? `${p.kbps} kbps · ${p.fps ?? '?'} fps` : '—';
  }
}

// Controles locais do host (teclado + gamepad) → porta atual do host.
function hostInputLoop() {
  if (!hostControlsLocked && host.port >= 0) {
    const pad = emptyPad();
    readKeyboard(pad);
    readGamepads(pad);
    applyPad(host.port, pad);
  }
  requestAnimationFrame(hostInputLoop);
}

async function tuneSender(pc) {
  const maxBitrate = Number($('bitrate').value);
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue;
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = maxBitrate;
    params.encodings[0].maxFramerate = Number($('streamFps').value);
    params.degradationPreference = 'maintain-framerate';
    try {
      await sender.setParameters(params);
    } catch (e) {
      note(`setParameters falhou: ${e.message}`, 'warn');
    }
  }
}

function handleMessage(guest, msg) {
  if (typeof msg !== 'object' || msg === null) return;
  switch (msg.t) {
    case 'hello': {
      if (msg.v !== PROTOCOL_VERSION) {
        guest.conn.send({ t: 'error', message: 'Versão diferente. Atualize a página.' });
        return guest.conn.close();
      }
      if (guest.name) return; // já entrou
      guest.name = String(msg.name ?? 'Jogador').slice(0, 20);
      guest.port = freePort();
      guest.conn.send({ t: 'welcome', port: guest.port });
      note(`${guest.name} entrou como ${guest.port >= 0 ? `P${guest.port + 1}` : 'espectador'}`, 'ok');
      guest.call = window.peer.call(guest.conn.peer, stream);
      const pc = guest.call.peerConnection;
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') tuneSender(pc);
      });
      renderPlayers();
      break;
    }
    case 'in':
      if (guest.port < 0 || !isValidPad(msg)) return;
      if (guest.lastSeq != null && !isNewerSeq(msg.seq, guest.lastSeq)) return;
      guest.lastSeq = msg.seq;
      applyPad(guest.port, { buttons: msg.b, x: msg.x, y: msg.y });
      break;
    case 'ping':
      guest.conn.send({ t: 'pong', ts: msg.ts });
      break;
    case 'rtt':
      if (Number.isFinite(msg.ms)) guest.rtt = Math.round(msg.ms);
      break;
  }
}

function openRoom(attempt = 0) {
  const code = randomCode();
  const peer = new Peer(PEER_PREFIX + code, { config: { iceServers: ICE_SERVERS } });
  window.peer = peer;
  peer.on('open', () => {
    $('roomStatus').textContent = 'Sala aberta. Compartilhe o link:';
    $('roomStatus').className = 'ok';
    $('roomInfo').hidden = false;
    $('roomCode').textContent = code;
    const params = new URLSearchParams(location.search);
    const base = params.get('lan')
      ? `${location.protocol}//${params.get('lan')}${location.pathname.replace(/host\.html$/, '')}`
      : location.href.replace(/host\.html.*$/, '');
    const link = `${base}guest.html?r=${code}`;
    $('guestLink').href = link;
    $('guestLink').textContent = link;
    $('copyLink').onclick = () => navigator.clipboard.writeText(link).then(() => note('Link copiado'));
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
    note(`Sala ${code} aberta`, 'ok');
  });
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id' && attempt < 3) {
      peer.destroy();
      return openRoom(attempt + 1);
    }
    $('roomStatus').textContent = `Erro de rede: ${err.type}`;
    $('roomStatus').className = 'err';
    note(`PeerJS: ${err.type} ${err.message}`, 'err');
  });
  peer.on('connection', (conn) => {
    const guest = { conn, call: null, port: -1, name: null, lastSeq: null, rtt: null };
    guests.set(conn.peer, guest);
    conn.on('data', (msg) => handleMessage(guest, msg));
    conn.on('close', () => {
      if (guest.port >= 0) releaseAll(guest.port);
      guest.call?.close();
      guests.delete(conn.peer);
      note(`${guest.name ?? conn.peer} saiu`);
      renderPlayers();
    });
  });
}

// Estatísticas de envio por convidado
const lastBytes = new Map();
setInterval(async () => {
  for (const [id, g] of guests) {
    const pc = g.call?.peerConnection;
    if (!pc) continue;
    const stats = await pc.getStats();
    stats.forEach((s) => {
      if (s.type === 'outbound-rtp' && s.kind === 'video') {
        const prev = lastBytes.get(id) ?? s.bytesSent;
        g.kbps = Math.round(((s.bytesSent - prev) * 8) / 1000);
        g.fps = s.framesPerSecond;
        lastBytes.set(id, s.bytesSent);
      }
    });
  }
  renderPlayers();
}, 1000);

$('bitrate').onchange = $('streamFps').onchange = () =>
  guests.forEach((g) => g.call?.peerConnection && tuneSender(g.call.peerConnection));

// ---------- Início ----------
let listening = false;
$('toggleListen').onclick = () => {
  listening = !listening;
  $('preview').muted = !listening;
  $('toggleListen').textContent = listening ? '🔇 Parar de ouvir' : '🔈 Ouvir áudio capturado';
};

$('rom').onchange = () => ($('startRom').disabled = !$('rom').files.length);

async function start(useFake) {
  $('setup').querySelectorAll('button, input').forEach((el) => (el.disabled = true));
  $('main').hidden = false;
  const audioMode = document.querySelector('input[name=audioMode]:checked').value;
  note(useFake ? 'Iniciando modo teste…' : 'Carregando EmulatorJS e o core de N64…');
  emulator = useFake
    ? startFakeEmulator()
    : await startEmulatorJS($('rom').files[0], $('noDefaultControls').checked);
  note('Jogo iniciado', 'ok');
  hostControlsLocked = !useFake && !$('noDefaultControls').checked;
  renderPlayers();
  requestAnimationFrame(hostInputLoop);
  stream = await buildStream(emulator, useFake ? 'tap' : audioMode);
  $('preview').srcObject = stream;
  setupP2TestButtons();
  setupSaves(emulator);
  openRoom();
}

// O preview só serve para conferir a captura; desligado, o PC não gasta nada desenhando um segundo vídeo.
$('showPreview').onchange = () => {
  const show = $('showPreview').checked;
  $('previewBox').hidden = !show;
  $('preview').srcObject = show ? stream : null;
};

$('startRom').onclick = () => start(false);
$('startFake').onclick = () => start(true);
window.addEventListener('beforeunload', (e) => {
  if (guests.size) e.preventDefault();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && emulator) note('Aba em segundo plano: o emulador pode pausar para todos!', 'warn');
});
