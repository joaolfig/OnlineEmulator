# OnlineEmulator

Jogue N64 online com amigos direto no navegador, sem instalar nada.

Só o **host** roda o emulador ([EmulatorJS](https://emulatorjs.org)) e transmite vídeo e áudio por WebRTC ([PeerJS](https://peerjs.com)). Os amigos abrem um link no celular ou no PC e mandam só os comandos do controle. O site é estático e fica hospedado no GitHub Pages.

O plano completo está em [`PLANO.md`](PLANO.md).

## Como jogar

1. **Host (PC com Edge ou Chrome):** abra o site, clique em **Criar sala**, adicione a ROM do seu jogo (ela fica salva só no seu navegador) e clique em **Jogar**.
2. Compartilhe o link ou o QR code da sala.
3. **Amigos:** abrem o link, digitam o nome e tocam em **Entrar**.

Controles no teclado: WASD/setas (Shift = meia força), K = A, J = B, L = Z, Enter = Start, Q/E = L/R, T/F/G/H = C-buttons. Controles USB ou Bluetooth também funcionam, e no celular aparecem botões na tela.

> **Mantenha a aba do host visível.** Em segundo plano, o navegador pausa o jogo para todos.

**ROMs não fazem parte deste projeto.** Cada host usa a cópia do próprio jogo, que nunca sai do computador dele.

## Desenvolvimento

Requer Node 22+.

```bash
npm install
npm run dev          # servidor local (acessível na rede local para testar no celular)
npm run check        # tipos + lint + formatação + testes
npm run test:e2e     # teste ponta a ponta com Playwright (usa o servidor público do PeerJS)
npm run build        # gera dist/
```

Para testar no celular durante o desenvolvimento, abra o host com `?lan=IP:porta`, por exemplo `http://localhost:5173/OnlineEmulator/host.html?lan=192.168.0.10:5173`, para o link da sala apontar para o IP do PC.

### Arquitetura

```
src/
├─ core/       lógica pura, sem DOM nem rede: protocolo, controles, estado da sala
├─ adapters/   integrações isoladas atrás de interfaces: EmulatorJS, PeerJS, mídia, IndexedDB
├─ app/        orquestração: HostSession, GuestSession, laço de input
├─ ui/         componentes Preact e textos
└─ entries/    pontos de entrada das páginas (index, host, play)
```

- `core/` não importa nenhuma outra camada, e o ESLint garante isso.
- Toda mensagem vinda da rede é validada (valibot e um codec binário com checagens) antes de ser usada.
- Testes: unitários e de integração com Vitest (host e convidados num transporte em memória) e ponta a ponta com Playwright (WebRTC real e um emulador falso, sem ROM).
- O CI roda todas as verificações, e o deploy no Pages só acontece se o CI passar.

A pasta `spike/` é o protótipo descartável da Fase 0, mantido como referência.

## Licença

GPL-3.0-or-later, por compatibilidade com o EmulatorJS e os cores do RetroArch.
