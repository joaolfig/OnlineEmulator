# OnlineEmulator: plano do projeto

Emulador no navegador para jogar **multiplayer online com amigos** (foco: N64 / *Mario Party 2*), hospedado como **site estático no GitHub Pages**, com conexão **peer-to-peer via PeerJS** e **EmulatorJS** rodando o jogo.

> **Objetivo de UX:** o amigo recebe um link no WhatsApp, abre no celular ou no PC e já está jogando. Ele não instala nada, não baixa ROM e não configura nada.

---

## 1. Decisão principal: *streaming* do host, não emulação em cada aparelho

Existem duas formas de fazer netplay. A escolha entre elas define o projeto inteiro.

| | **A) Host faz streaming (recomendado)** | B) Lockstep (cada um emula) |
|---|---|---|
| Como funciona | Só o host roda o emulador. Ele transmite vídeo e áudio por WebRTC, e os convidados mandam só os comandos do controle. | Todos rodam o emulador e trocam inputs a cada frame. |
| ROM nos convidados | **Não precisa** | Precisa (todos com a mesma ROM) |
| Celular fraco como convidado | **Funciona** (só toca um vídeo) | N64 em WASM no celular é pesado |
| Dessincronização | **Impossível** (só existe um emulador) | Risco alto; N64 tem *savestates* de cerca de 16 MB, então rollback é inviável |
| Latência do convidado | ~60–150 ms (ok para party game) | Menor em teoria, mas com *input delay* fixo |
| Banda | Host precisa de ~3 Mbps de upload por convidado | Baixíssima |
| Complexidade | **Média** | Alta |

**Escolha: modo A.** Ele atende diretamente aos requisitos de "qualquer dispositivo" e "convidado não precisa da ROM". O *Mario Party 2* é majoritariamente por turnos, e os minigames toleram bem 100 ms. É o mesmo modelo do *Steam Remote Play Together* e do Parsec.

> O EmulatorJS tem um netplay nativo, mas ele depende de um servidor Node/socket.io próprio (`EJS_netplayServer`), e isso não roda no GitHub Pages. Por isso a camada de rede será nossa, com PeerJS, que usa o servidor de sinalização gratuito do PeerJS Cloud.

---

## 2. Arquitetura

```
┌──────────────────────── HOST (PC, Chrome/Edge) ────────────────────────┐
│  EmulatorJS (core mupen64plus_next, N64)                               │
│     │ canvas ──captureStream(60)──┐                                    │
│     │ áudio ──tap no AudioContext─┴─► MediaStream ──► PeerJS call ─────┼──► vídeo+áudio
│     ▲                                                                  │
│     └── gameManager.simulateInput(player, botão, valor) ◄── DataConn ◄─┼─── inputs
│  Lobby: slots P1..P4, nomes, ping, chat                                │
└────────────────────────────────────────────────────────────────────────┘
              ▲  sinalização (só para abrir a conexão): 0.peerjs.com
              ▼  STUN/TURN (atravessar NAT/4G)
┌──────── CONVIDADO (qualquer navegador: Android, iPhone, PC) ───────────┐
│  <video> em tela cheia + controle virtual (touch) / Gamepad / teclado  │
│  Envia estado do controle via DataConnection; recebe stream do host    │
└────────────────────────────────────────────────────────────────────────┘
```

- **Site 100% estático** (HTML/JS/CSS) no GitHub Pages.
- **Sinalização:** servidor público gratuito do PeerJS (`0.peerjs.com`), usado só para os peers se encontrarem.
- **Mídia e dados:** WebRTC direto entre host e cada convidado (topologia estrela: host no centro).
- **Host:** PC com Chrome ou Edge. É quem tem a ROM e roda o jogo.
- **Convidados:** só um player de vídeo com controle. Não carregam o EmulatorJS.

---

## 3. Fluxo do usuário

### Host
1. Abre `https://<usuario>.github.io/OnlineEmulator/`, clica em **Criar sala** e escolhe o jogo.
   - **Primeira vez:** seleciona o arquivo da ROM (`.z64/.n64/.v64`) do próprio computador. Ela fica salva no **IndexedDB** do navegador.
   - **Próximas vezes:** escolhe o jogo na **biblioteca local** (sem upload nenhum).
   - (Opcional) `?rom=<url>` para carregar de um link próprio e privado do host.
2. O jogo inicia e aparece a tela da sala com **código** (ex.: `K7QX2M`), **link** e **QR code**.
3. O host define quantos jogadores vão jogar **no próprio PC** (ex.: 3 no teclado e 1 num controle) e compartilha o link.
4. No lobby, o host vê as **4 portas do console (P1–P4)** e quem está em cada uma, com aparelho e ping. Ele pode arrastar jogadores entre portas.

### Convidado
1. Abre `…/play.html?r=K7QX2M` (pelo link ou QR).
2. Digita o nome e toca em **Entrar**. O toque é necessário para liberar áudio e tela cheia no iOS e no Android.
3. Escolhe **quantos jogadores vão jogar naquele aparelho** e o controle de cada um (ver 5.6). O padrão é 1 jogador com o controle touch, então quem não quer configurar nada só toca em "Pronto".
4. Recebe uma porta livre para cada jogador local, e o vídeo e os controles aparecem.
5. Se as portas estiverem cheias, entra como **espectador** e pode pedir para entrar quando abrir vaga.

> **Sobre "não ter que baixar e colocar a ROM na hora":** no modo A, **só o host** precisa da ROM, e **só uma vez** (depois fica na biblioteca local). Os convidados nunca lidam com ROM.

---

## 4. Stack e estrutura do repositório

- **Vite + TypeScript** em modo `strict` (com `noUncheckedIndexedAccess`). Build estático em `dist/`.
- **Preact** (~4 KB) para a UI. Lobby com arrastar entre portas, tela de jogadores locais e remapeamento têm bastante estado; fazer isso em JS puro acabaria em código de re-renderização feito à mão.
- **PeerJS** (`peerjs` via npm).
- **EmulatorJS** carregado do CDN oficial **com versão fixada** (ex.: `https://cdn.emulatorjs.org/<versão>/data/`). Mais tarde dá para auto-hospedar a pasta `data/` no próprio Pages.
- **idb** (wrapper pequeno com Promises) para o IndexedDB, em vez da API crua baseada em callbacks.
- **nipplejs** para o analógico virtual no celular, e **qrcode** para o QR da sala.
- **Qualidade:** ESLint (`typescript-eslint`) + Prettier, **Vitest** (testes unitários) e **Playwright** (testes ponta a ponta).
- **GitHub Actions** rodando as verificações e fazendo deploy para o Pages.

### 4.1 Organização em camadas

A regra principal: **a lógica do jogo em rede não pode depender diretamente do EmulatorJS, do PeerJS nem do DOM.** Essas bibliotecas ficam atrás de interfaces pequenas (*adapters*). Isso traz três vantagens:
- Dá para testar a lógica sem navegador nem emulador.
- Se o EmulatorJS mudar a API interna (o `gameManager` não é documentado oficialmente), só um arquivo muda.
- Trocar o PeerJS por outra coisa no futuro não afeta o resto.

```
OnlineEmulator/
├─ index.html  host.html  play.html     # entradas (Vite multi-page)
├─ src/
│  ├─ config.ts            # constantes: versão do EJS, prefixo de IDs, bitrates, limites
│  ├─ core/                # PURO: sem DOM, sem rede, 100% testável com Vitest
│  │  ├─ protocol/         # tipos das mensagens, encode/decode, validação
│  │  ├─ input/            # estado do controle (bitmask + sticks), perfis, presets
│  │  ├─ room/             # estado da sala e reducer: entrar, sair, portas, revezar
│  │  └─ util/             # códigos de sala, comparação de seq, etc.
│  ├─ adapters/            # tudo que toca API externa, cada um atrás de uma interface
│  │  ├─ emulator/         # interface Emulator + implementação EmulatorJS + n64map
│  │  ├─ media/            # captura de vídeo e áudio, ajustes do RTCPeerConnection
│  │  ├─ net/              # interface Transport + implementação PeerJS, config ICE
│  │  ├─ input/            # leitura de teclado, Gamepad API, touch → core/input
│  │  └─ storage/          # biblioteca de ROMs, saves, preferências
│  ├─ app/                 # orquestração: liga core + adapters para cada página
│  │  ├─ host/
│  │  └─ guest/
│  └─ ui/                  # componentes Preact, CSS, textos em pt-BR num só lugar
├─ tests/
│  ├─ unit/                # Vitest (core/)
│  └─ e2e/                 # Playwright: host + convidado em 2 contextos de navegador
├─ public/                 # manifest.webmanifest, ícones
├─ .github/workflows/      # ci.yml (verificações) e deploy.yml
├─ .gitignore              # inclui *.z64 *.n64 *.v64 *.eep *.sav *.state
└─ vite.config.ts          # base: '/OnlineEmulator/'
```

**Direção das dependências:** `ui` → `app` → `core` e `adapters`. O `core` não importa nada das outras pastas. Uma regra do ESLint (`import/no-restricted-paths`) garante isso automaticamente.

**Rotas:** usar páginas separadas com *query string* (`play.html?r=CODE`) em vez de rotas SPA, porque o GitHub Pages não tem *fallback* de rotas.

### 4.2 Convenções

- **Sem `any`.** Os globais do EmulatorJS (`EJS_*`) ganham tipos num `emulatorjs.d.ts`, e usar `any` vira erro no lint.
- **Estado da sala com uma única fonte de verdade:** o host mantém o estado num *reducer* puro (`(estado, ação) → novo estado`) e envia *snapshots* aos convidados. Os convidados não têm lógica de sala, só exibem o que recebem.
- **Limpeza de recursos:** cada tela usa um `AbortController` para remover *listeners*. Ao sair, a tela fecha conexões, para as *tracks* de mídia e chama `URL.revokeObjectURL` nos blobs. Isso evita vazamento de memória em sessões longas.
- **Erros visíveis:** nada de `catch` vazio. Falhas de rede, de ROM ou de permissão viram uma mensagem clara na UI. Usar um *logger* com níveis, ativado por `?debug=1`.
- **Configuração centralizada:** nenhum número mágico espalhado (bitrate, timeouts, limites). Tudo fica em `config.ts`.
- **Textos da UI num só arquivo** (`ui/strings.ts`), o que facilita revisar e traduzir depois.
- **Acessibilidade básica:** botões de verdade (`<button>`), foco visível, contraste. O lobby também deve ser navegável pelo teclado.
- **Git:** `main` sempre implantável, trabalho em *branches* com PR, mensagens de commit no padrão *Conventional Commits* (`feat:`, `fix:`…). Dependabot para manter as dependências atualizadas.

---

## 5. Detalhes técnicos de cada peça

### 5.1 EmulatorJS no host

O resto do app só conhece esta interface:

```ts
// adapters/emulator/types.ts
export interface Emulator {
  start(rom: Blob, core: CoreId): Promise<HTMLCanvasElement>; // resolve quando o jogo inicia
  setInput(port: Port, state: PadState): void;                // aplica só o que mudou
  releaseAll(port: Port): void;
  exportSave(): Promise<Uint8Array>;
  importSave(data: Uint8Array): Promise<void>;
  exportState(): Promise<Uint8Array>;
  importState(data: Uint8Array): Promise<void>;
  destroy(): void;
}
```

A implementação com EmulatorJS define os globais e injeta o `loader.js` por código, em vez de usar `<script>` solto no HTML:

```ts
// adapters/emulator/emulatorjs.ts (resumo)
start(rom, core) {
  return new Promise((resolve, reject) => {
    const romUrl = URL.createObjectURL(rom);
    Object.assign(window, {
      EJS_player: '#game',
      EJS_core: core,                              // 'n64' → mupen64plus_next
      EJS_gameUrl: romUrl,
      EJS_pathtodata: config.ejsDataUrl,           // versão fixada em config.ts
      EJS_startOnLoaded: true,
      EJS_onGameStart: () => resolve(findCanvas()),
    });
    const s = document.createElement('script');
    s.src = `${config.ejsDataUrl}loader.js`;
    s.onerror = () => reject(new EmulatorLoadError());
    document.body.append(s);
    this.cleanup.push(() => URL.revokeObjectURL(romUrl));
  });
}
```

- Internamente, `window.EJS_emulator.gameManager.simulateInput(player, index, value)` injeta inputs. `player` vai de 0 a 3. **Esse acesso fica só dentro do adapter.**
- `setInput` compara com o último estado da porta e só chama `simulateInput` para os botões que mudaram.
- Os índices seguem o RetroPad do EmulatorJS: `0 B, 1 Y, 2 Select, 3 Start, 4 Up, 5 Down, 6 Left, 7 Right, 8 A, 9 X, 10 L, 11 R, 12 L2, 13 R2, 16–19 analógico esquerdo, 20–23 analógico direito`. Analógico usa valores de 0 a `0x7fff` por direção.
- **Mapeamento N64 confirmado no código do EmulatorJS 4.2.3:** A = 0, B = 1, Start = 3, D-pad = 4–7, L = 10, R = 11, Z = 12, analógico = 16 (dir.), 17 (esq.), 18 (baixo), 19 (cima), C-buttons = 20 (dir.), 21 (esq.), 22 (baixo), 23 (cima).
- **Áudio:** o EmulatorJS 4.2.3 tem `collectScreenRecordingMediaTracks(canvas, fps)`, que já devolve vídeo e áudio juntos. Se funcionar bem no spike, ele substitui o *monkey-patch* da seção 5.3, que fica como plano B.
- Save do cartucho (EEPROM do MP2) e savestates: o EmulatorJS já persiste no IndexedDB do host. A exportação e importação em arquivo estão descritas em 5.8.
- **Desligar os controles padrão do EmulatorJS** (via `EJS_defaultControls` vazio ou equivalente, a validar no spike). Assim, todo input, inclusive o dos jogadores no PC do host, passa pela nossa camada (5.6) e não há conflito de teclas.
- **Não usar `EJS_threads`.** Ele exige `SharedArrayBuffer` e headers COOP/COEP, que o GitHub Pages não permite configurar. Se algum dia for necessário, existe o *workaround* `coi-serviceworker`.

### 5.2 Captura de vídeo

O canvas vem da Promise de `Emulator.start()`, então não é preciso procurá-lo no DOM com `!`.

```ts
// adapters/media/capture.ts
export function captureVideo(canvas: HTMLCanvasElement): MediaStreamTrack {
  const [track] = canvas.captureStream(config.captureFps).getVideoTracks();
  if (!track) throw new CaptureError('canvas sem track de vídeo');
  track.contentHint = 'motion';
  return track;
}
```

### 5.3 Captura de áudio (a parte mais delicada)

O EmulatorJS (Emscripten/OpenAL) cria o próprio `AudioContext`. A solução é **interceptar `AudioNode.connect` antes de carregar o `loader.js`** e duplicar tudo o que vai para os alto-falantes num `MediaStreamDestination`.

Por ser um *monkey-patch* global, ele fica isolado num módulo com três garantias:
- é **idempotente** (instalar duas vezes não duplica o áudio);
- pode ser **desinstalado**;
- entrega o stream por uma **Promise**, sem variável global.

```ts
// adapters/media/audioTap.ts
const taps = new WeakMap<BaseAudioContext, MediaStreamAudioDestinationNode>();
let original: typeof AudioNode.prototype.connect | undefined;
let resolveStream!: (s: MediaStream) => void;
export const audioStream = new Promise<MediaStream>((r) => (resolveStream = r));

export function installAudioTap(): () => void {
  if (original) return uninstall;
  const orig = (original = AudioNode.prototype.connect);
  AudioNode.prototype.connect = function (this: AudioNode, ...args: Parameters<typeof orig>) {
    const result = orig.apply(this, args);
    if (args[0] instanceof AudioDestinationNode) {
      let tap = taps.get(this.context);
      if (!tap) {
        tap = this.context.createMediaStreamDestination();
        taps.set(this.context, tap);
        resolveStream(tap.stream);
      }
      orig.call(this, tap);
    }
    return result;
  } as typeof orig;
  return uninstall;
}

function uninstall() {
  if (original) AudioNode.prototype.connect = original;
  original = undefined;
}
```

Depois: `new MediaStream([videoTrack, ...(await audioStream).getAudioTracks()])`, com um *timeout* para o caso de o jogo não ter áudio.

### 5.4 Rede (PeerJS)

- **IDs:** use um prefixo do app para não colidir no servidor público: `onlemu-v1-K7QX2M`. O código tem 6 caracteres de um alfabeto sem ambíguos (sem 0/O/1/I).
- **Host:** `new Peer('onlemu-v1-' + code, { config: { iceServers } })`. Se o ID já estiver em uso (`unavailable-id`), sortear outro código.
- **Convidado:** abre **dois canais de dados** com o host, cada um com a configuração certa para o seu tipo de mensagem:
  - `control` (confiável e ordenado, JSON): entrar, lobby, chat, saves;
  - `input` (**não confiável e sem ordem**, binário): estado dos controles. Um pacote perdido não deve atrasar os seguintes, e o próximo snapshot já corrige.

  Depois que o host aceita, o **host chama o convidado** com `peer.call(guestId, stream)`, e o convidado responde com `call.answer()` sem stream.
- **Tudo isso fica atrás de uma interface `Transport`** (`adapters/net/`). O resto do app só vê `onMessage`, `send`, `onStream` e `close`. Nos testes, uma implementação em memória substitui o PeerJS.
- **Reconexão** com *backoff* exponencial (1 s, 2 s, 4 s… até um limite). O host guarda a porta do convidado por ~30 s para ele voltar ao mesmo lugar.
- **Ajustes de latência** (via `call.peerConnection`):
  - sender de vídeo: `maxBitrate` ~2,5–4 Mbps, `maxFramerate: 60`, `degradationPreference: 'maintain-framerate'`
  - receiver: `jitterBufferTarget = 0` (Chrome) / `playoutDelayHint = 0`
  - preferir H.264 (decodificação por hardware em celular) com `setCodecPreferences`, e VP8 como fallback
- **STUN/TURN:** só com STUN, conexões 4G e CGNAT falham com frequência. Planejar TURN desde o início:
  - Fase 1: STUN do Google e um TURN de tier gratuito (ex.: Metered/Open Relay).
  - Fase 3: **Cloudflare TURN** (tier gratuito generoso) com um **Cloudflare Worker** gratuito que gera credenciais temporárias, para não expor a chave no site estático.
- **Plano B para sinalização:** o PeerJS Cloud é gratuito mas às vezes fica instável. Deixar a URL do PeerServer configurável para poder apontar para um próprio no futuro.

### 5.5 Protocolo de mensagens (canal de dados)

| Mensagem | Direção | Conteúdo |
|---|---|---|
| `hello` | C→H | nome do aparelho, versão do protocolo |
| `players` | C→H | lista de jogadores locais (nome de cada um, tipo de controle) |
| `assign` | H→C | porta de cada jogador local (P1–P4 ou espectador), jogo, configurações |
| `lobby` | H→todos | portas, quem está em cada uma, aparelho, ping |
| `input` | C→H | binário, no canal `input` (formato abaixo) |
| `ping`/`pong` | ambos | timestamp, para mostrar a latência |
| `chat` | ambos | texto curto |
| `kick` / `swap` | H→C | gerenciar portas |
| `save-offer` | H→C | arquivo de save enviado a um convidado (5.8) |

- **Mensagens de controle** são uma *union* discriminada em TypeScript, com envelope versionado: `{ v: 1, type: 'hello', ... }`. Mudar o protocolo de forma incompatível aumenta o `v`, e o host recusa versões diferentes com a mensagem "atualize a página".
- **O host não confia em nada que chega.** Cada mensagem é validada com um *schema* (ex.: **valibot**, ~1 KB) antes de ser usada. Mensagens inválidas, grandes demais ou rápidas demais (*rate limit*) são descartadas e registradas.
- **Formato binário do `input`** (`DataView`, *little-endian*):

  ```
  [u8 versão][u16 seq][u8 qtd] + qtd × ( [u8 jogadorLocal][u16 botões][i8 stickX][i8 stickY] )
  ```

  São 5 bytes por jogador. Encode e decode ficam em `core/protocol/` com testes de ida e volta.
- **Inputs como snapshot completo do estado**, nunca como evento ("apertou A"). Assim, se um pacote se perder, o próximo corrige sozinho. O convidado envia sempre que algo muda e também a cada ~50 ms (heartbeat). O host descarta pacotes com `seq` antigo, usando **comparação com volta** (*wraparound*) porque o `u16` recomeça do zero depois de 65535.
- **Um único pacote leva todos os jogadores daquele aparelho.** O convidado manda o índice local, e o **host traduz para a porta**. Assim, o host pode trocar portas sem o convidado precisar saber.
- Se um convidado desconectar, o host **solta todos os botões** das portas daquele aparelho, para evitar personagem andando sozinho.

### 5.6 Controles: vários jogadores por aparelho, em qualquer aparelho

O host e os convidados usam **o mesmo sistema de controles**. A diferença é só o destino: no host, os inputs vão direto para `simulateInput`; no convidado, vão pelo canal de dados.

**Modelo:**

```
Sala (N64 = 4 portas: P1..P4)
 ├─ Aparelho "PC do João" (host)
 │   ├─ Jogador local 1 → Teclado perfil "WASD"    → P1
 │   ├─ Jogador local 2 → Teclado perfil "Setas"   → P2
 │   └─ Jogador local 3 → Gamepad #0 (Xbox)        → P3
 └─ Aparelho "Celular da Ana"
     └─ Jogador local 1 → Touch                    → P4
```

- Cada aparelho tem de **1 a 4 jogadores locais**, e cada um é ligado a **uma fonte de input**:
  - **Teclado, dividido em perfis:** um mesmo teclado vira vários controles. Perfis prontos: *WASD + F/G/H*, *Setas + K/L/;*, *IJKL + U/O*, *Numpad*. Todos podem ser editados.
  - **Cada gamepad conectado** (USB ou Bluetooth), identificado por `gamepad.index` e `gamepad.id`. Funciona também no celular com controle Bluetooth.
  - **Touch:** um por aparelho. Fica como fonte padrão no celular.
- **"Aperte qualquer botão para entrar":** na tela de jogadores locais, cada pessoa aperta um botão do controle ou teclado que vai usar, e o sistema detecta a fonte e cria o jogador automaticamente. É o jeito mais fácil de montar 3 no teclado + 1 controle sem mexer em menus.
- **Remapeamento por fonte:** a tela "aperte o botão para A…, para B…" funciona para teclado e gamepad, com uma *deadzone* configurável no analógico. Os perfis ficam salvos no `localStorage` de cada aparelho e são carregados sozinhos na próxima vez (para gamepads, pelo `id` do controle).
- **Analógico no teclado:** a tecla direcional dá inclinação total, e segurar uma tecla modificadora dá meia inclinação (útil em alguns minigames).
- **Teclado por `KeyboardEvent.code`, não por `key`.** O `code` identifica a posição física da tecla, então os perfis funcionam igual em teclado ABNT2, americano etc. A tecla `;` e o `Ç`, por exemplo, mudam de lugar entre layouts.
- **Soltar tudo ao perder o foco** (`blur`, `visibilitychange`). Sem isso, uma tecla segurada durante um Alt+Tab fica "presa" apertada.
- **Gamepads são lidos por *polling*** num único laço de `requestAnimationFrame`, porque a Gamepad API não gera eventos de botão. Teclado, gamepad e touch convertem tudo para o mesmo `PadState` do `core/input`.
- **Limite de 4 portas é do console**, não do site. Pode haver mais aparelhos e pessoas conectadas que portas. Quem sobra fica como **espectador**, e o host pode **revezar** (passar uma porta de um jogador para outro entre minigames ou partidas).
- **Touch (celular):** layout N64 em paisagem, com analógico (nipplejs) à esquerda, A/B grandes à direita, Z como gatilho, Start no centro, L/R no topo e C-buttons compactos (pouco usados no MP2). Vibração (`navigator.vibrate`) no toque. O layout pode ser editado (tamanho e posição dos botões) e mudar por jogo (4.ª fase).
- **Indicador na tela** de cada aparelho mostrando a cor e a porta de cada jogador local ("Você é o P3 🟡"), para ninguém se perder.
- **Tela cheia + travar paisagem** (`screen.orientation.lock('landscape')` no Android) e *Wake Lock* para a tela não apagar.
- **iOS:** `<video playsinline>`. O áudio só toca após o toque em "Entrar".

> **Atenção com teclado para 3+ pessoas:** muitos teclados baratos têm *ghosting*, ou seja, não registram várias teclas apertadas ao mesmo tempo. Os perfis padrão devem usar teclas em regiões diferentes do teclado, e a tela de configuração terá um **teste de teclas** para cada um ver se as combinações funcionam.

### 5.7 Biblioteca de ROMs e armazenamento

- A ROM fica no **IndexedDB**, que é armazenamento em disco. Não ocupa RAM nem deixa o navegador lento enquanto não está jogando. O Mario Party 2 tem ~32 MB.
- **Biblioteca com tamanho de cada jogo** e botão **"Remover"**, além do total usado (`navigator.storage.estimate()`).
- Pedir **armazenamento persistente** com `navigator.storage.persist()` ao salvar a primeira ROM, para o navegador não apagar os dados se o disco encher. Mostrar um aviso se o pedido for negado. O Safari apaga dados de sites que não são abertos há ~7 dias, mas o host deve estar no Chrome ou Edge.

### 5.8 Saves em arquivo

O save continua automático no navegador do host. Os arquivos são uma **opção extra**, para backup ou para levar o progresso a outro computador.

- **Exportar / importar o save do cartucho** (a EEPROM do MP2, onde ficam os minigames liberados e as estrelas). Usa a API de save do EmulatorJS (`gameManager.getSaveFile()` / carregar o arquivo de volta; nomes exatos a validar no spike). Arquivo: `Mario Party 2 (2026-11-18).eep`.
- **Exportar / importar savestate**, que é uma "foto" da partida no meio de um tabuleiro (`gameManager.getState()` / `loadState()`). Arquivo: `.state`.
- **Pacote completo** opcional: um `.zip` com save, savestates e o hash da ROM. Na importação, o site confere o hash e avisa se o save for de outra versão do jogo.
- **Backup automático opcional:** ao fechar a sala, oferecer o download do save atualizado.
- **Mandar o save para um convidado:** o host pode enviar o arquivo pelo canal de dados (`save-offer`). Assim, outra pessoa consegue ser o host da próxima vez e continuar o mesmo progresso. O save tem poucos KB, então isso é instantâneo. O convidado precisa **aceitar** antes de receber, e há um limite de tamanho.
- Usar a *File System Access API* (`showSaveFilePicker`) quando existir, para o usuário escolher a pasta. Onde ela não existir (Firefox, Safari), cair no download normal (`<a download>`).

### 5.9 Experiência "qualquer dispositivo"

- **PWA:** com o manifest, o amigo pode adicionar à tela inicial e o site abre como um app em tela cheia.
- **QR code** na tela do host: quem está na mesma sala física aponta a câmera e entra.
- **Mistura local + online:** qualquer combinação funciona, por exemplo P1 e P2 no sofá do host e P3 e P4 pelo celular (ver 5.6).

### 5.10 Segurança

O link da sala pode ser repassado, então qualquer pessoa com ele consegue se conectar. Os cuidados:
- **Validação de toda mensagem recebida** (5.5); o host é a única autoridade sobre o estado da sala.
- **Nunca inserir texto vindo da rede como HTML:** nomes e chat são renderizados como texto (o Preact já faz isso por padrão; proibir `dangerouslySetInnerHTML` no lint). Nomes e mensagens também têm limite de tamanho.
- **Opção "aprovar quem entra"** no host, além de expulsar (`kick`).
- **Nada de segredos no código do site.** Tudo que vai para o Pages é público, e é por isso que o TURN definitivo usa credenciais temporárias geradas por um Worker (5.4).
- **Content-Security-Policy** via `<meta>`, permitindo só os domínios necessários (CDN do EmulatorJS, servidor PeerJS, TURN). O GitHub Pages não deixa configurar headers, mas a `<meta>` funciona. O EmulatorJS precisa de `'wasm-unsafe-eval'` e `blob:`, o que deve ser validado no spike.

---

## 6. Deploy no GitHub Pages

1. Criar o repositório `OnlineEmulator` no GitHub.
2. `vite.config.ts` com `base: '/OnlineEmulator/'` e as três páginas como entradas do build.
3. Workflow **`ci.yml`** em todo PR e push: `npm ci`, `tsc --noEmit`, `eslint`, `prettier --check`, `vitest run`, `playwright test` e `vite build`. Proteger a `main` para só aceitar merge com tudo verde.
4. Workflow **`deploy.yml`**, só na `main` e depois do CI passar: `actions/upload-pages-artifact` (pasta `dist`) e `actions/deploy-pages`. As actions ficam fixadas por versão.
5. Em *Settings → Pages*, escolher **Source: GitHub Actions**.
6. (Opcional) domínio próprio via `CNAME`.

### 6.1 Estratégia de testes

| Nível | Ferramenta | O que cobre |
|---|---|---|
| Unitário | Vitest | `core/`: encode/decode do protocolo, *reducer* da sala (entrar, sair, trocar e revezar portas), perfis de teclado, comparação de `seq`, validação de mensagens maliciosas |
| Integração | Vitest + `Transport` em memória | Host e convidados trocando mensagens sem rede real; reconexão; convidado caindo e soltando botões |
| Ponta a ponta | Playwright (Chromium) | Host e convidado em 2 contextos do navegador com WebRTC de verdade. Usa um **emulador falso** (canvas animado + tom de áudio) no lugar do EmulatorJS, para não precisar de ROM no CI |
| Manual | Checklist por release | Celular Android, iPhone, 4G, controle físico, 4 jogadores reais |

A lógica em `core/` deve ter boa cobertura de testes. As partes que dependem de hardware e do EmulatorJS ficam no checklist manual.

O HTTPS do Pages é **obrigatório** e já vem pronto: WebRTC, Gamepad e tela cheia exigem contexto seguro.

---

## 7. Roadmap

> **Status (2026-11-19):** Fase 0 concluída e validada com o jogo de verdade. Fase 1 implementada: os testes unitários, de integração e ponta a ponta passam, e o deploy no GitHub Pages está configurado. Notas da implementação: o controle touch foi feito à mão (~100 linhas) em vez de usar o nipplejs, e o estado da UI usa `@preact/signals`.

### Fase 0: Spike técnico (validar os riscos antes de tudo)
> O código do spike é **descartável**: serve só para tirar as dúvidas. O que for aprendido vira os adapters da Fase 1, já com testes e tipos.
- [ ] EmulatorJS rodando *Mario Party 2* a partir de arquivo local numa página simples.
- [ ] `captureStream` do canvas exibido num `<video>` na mesma página.
- [ ] Tap de áudio funcionando (ouvir o áudio vindo do `MediaStream`).
- [ ] `simulateInput(1, …)` pelo console controlando o **P2**. Confirmar o mapa de botões N64 e do analógico.
- [ ] Desligar os controles padrão do EmulatorJS sem quebrar nada.
- [ ] Confirmar as funções de exportar e importar save e savestate.
- [ ] Medir CPU do host com o jogo rodando e 3 encodes simultâneos.
- [ ] Testar a CSP (`'wasm-unsafe-eval'`, `blob:`) com o EmulatorJS.

### Fase 1: MVP (host + 1 convidado)
- [ ] Base do projeto: Vite + TS strict, ESLint/Prettier, Vitest, Playwright, `ci.yml`, `.gitignore` bloqueando ROMs e saves.
- [ ] Interfaces `Emulator` e `Transport` com implementações reais e falsas (para testes).
- [ ] Protocolo v1 com validação e testes.
- [ ] Biblioteca de ROMs no IndexedDB, com tamanho, botão de remover e `storage.persist()`.
- [ ] Criar sala com código e link; convidado entra por `play.html?r=`.
- [ ] Vídeo e áudio chegando; teclado do convidado controla o P2.
- [ ] Deploy no GitHub Pages funcionando.

### Fase 2: Mario Party jogável com 4
- [ ] Portas P1–P4, lobby, nomes, espectadores, troca e revezamento de portas.
- [ ] Vários jogadores por aparelho: perfis de teclado, gamepads, "aperte para entrar".
- [ ] Remapeamento de controles salvo por aparelho; teste de teclas.
- [ ] Controle touch, tela cheia e paisagem.
- [ ] Exportar e importar save e savestate em arquivo.
- [ ] Ping na tela; liberar inputs ao desconectar; reconexão automática.

### Fase 3: Qualidade de rede
- [ ] TURN via Cloudflare Worker.
- [ ] Ajuste de bitrate por convidado (lendo `getStats()`), seletor "qualidade × latência".
- [ ] Painel de estatísticas (RTT, fps recebidos, perda de pacotes).

### Fase 4: Polimento
- [ ] PWA e ícones, QR code, chat rápido e emojis.
- [ ] "Pausar para todos"; pacote `.zip` de saves; enviar save para um convidado.
- [ ] Editor do layout touch (tamanho e posição dos botões).
- [ ] Presets por jogo (identificado pelo hash da ROM): layout touch e botões visíveis.
- [ ] Suporte a outros consoles (SNES, GBA, PS1). A arquitetura não muda, só o `EJS_core`.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Aba do host em segundo plano pausa o emulador (`requestAnimationFrame` é suspenso) | Jogo trava para todos | Avisar na UI ("mantenha esta aba visível"); host em PC; Wake Lock |
| NAT restritivo / 4G sem TURN | Convidado não conecta | TURN desde a Fase 1; mensagem de erro clara |
| Upload fraco do host (3 convidados × ~3 Mbps) | Vídeo travando | Bitrate adaptativo; opção 480p; teste de velocidade no lobby |
| Tap de áudio quebrar numa versão nova do EmulatorJS | Sem som | **Fixar a versão** do EmulatorJS; teste no spike |
| Mapeamento N64 diferente do esperado | Botões trocados | Validar na Fase 0; tabela em `n64map.ts` |
| PeerJS Cloud instável | Não cria sala | URL do PeerServer configurável; retry |
| Host em Safari ou celular | Performance ruim | Recomendar Chrome/Edge no PC para o host; convidado pode ser qualquer um |
| *Ghosting* com 3+ pessoas no mesmo teclado | Teclas "somem" quando apertadas juntas | Perfis padrão em regiões separadas; teste de teclas na configuração |
| Navegador apagar a biblioteca ou o save | Perde ROM ou progresso | `storage.persist()`; exportar save em arquivo |

---

## 9. Licença e questões legais

- **Nunca commitar ROMs no repositório.** O repo é público, distribuir ROMs comerciais é infração de direitos autorais e o GitHub remove por DMCA. Cada host usa o próprio dump, que fica só no navegador dele.
- No modo A, a ROM **nunca sai do computador do host**: só vídeo e áudio são transmitidos.
- O EmulatorJS e os cores do RetroArch são **GPL-3.0**. Licenciar o projeto como GPL-3.0 evita problemas.

---

## 10. Próximo passo concreto

Começar pela **Fase 0**: uma página `spike.html` que carrega o MP2 de um arquivo local, mostra o próprio stream num `<video>` ao lado e permite mover o P2 pelo console. Se as verificações da Fase 0 passarem, o resto do projeto é engenharia sem grandes incógnitas.
