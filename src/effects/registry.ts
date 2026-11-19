// Efeitos do laboratório: os mesmos do jogo (sozinhos e combinados), mais a referência sem efeito.

import { createComposite, RELIEF_PARAMS } from './composite';
import type { Experiment } from './types';

const none = { tilt: false, crt: false, relief: false };

export const flat: Experiment = {
  id: 'flat',
  name: 'Referência (sem efeito)',
  idea: 'ref',
  summary: 'O jogo puro, num plano reto. Serve para comparar com os outros efeitos.',
  caveat: 'Nenhum.',
  params: [],
  create: (ctx) => createComposite(ctx, none),
};

export const tilt: Experiment = {
  id: 'tilt',
  name: 'Inclinação dinâmica',
  idea: '1',
  summary:
    'A tela gira alguns graus para o lado em que você anda e inclina para trás quando pula (A), como se a câmera acompanhasse o movimento.',
  caveat: 'Com ângulo alto pode dar enjoo; com movimento constante (corrida) a tela fica sempre torta.',
  params: [
    { key: 'maxAngle', label: 'Ângulo máximo (°)', min: 0, max: 25, step: 1, value: 8 },
    { key: 'smoothing', label: 'Rapidez da resposta', min: 1, max: 20, step: 1, value: 6 },
  ],
  create: (ctx) => createComposite(ctx, { ...none, tilt: true }),
};

export const crt: Experiment = {
  id: 'crt',
  name: 'TV de tubo 3D + Ambilight',
  idea: '1',
  summary:
    'O jogo numa TV antiga curva, num quarto escuro. Os pixels se misturam como no feixe da TV de tubo (sem quadradinhos duros) e a luz atrás da TV muda de cor conforme a imagem (Ambilight).',
  caveat: 'Fica mais fiel em jogos 2D de 240 linhas (SNES, Mega Drive, NES).',
  // Sem controles: a TV tem uma configuração fixa, escolhida nos testes.
  params: [],
  create: (ctx) => createComposite(ctx, { ...none, crt: true }),
};

export const relief: Experiment = {
  id: 'relief',
  name: 'Relevo com luz (normal map automático)',
  idea: '2',
  summary:
    'Cada borda de contraste ganha sombra e brilho, como se os sprites fossem de plástico ou metal. A luz pode sair das partes claras do jogo, seguir o controle, girar sozinha ou ficar fixa.',
  caveat: 'Textos brancos também ganham relevo; com força alta a imagem fica "suja".',
  params: RELIEF_PARAMS,
  create: (ctx) => createComposite(ctx, { ...none, relief: true }),
};

export const allTogether: Experiment = {
  id: 'all',
  name: 'Os três juntos',
  idea: 'combo',
  summary: 'Inclinação + TV de tubo + relevo com luz ao mesmo tempo, como dá para ligar no jogo.',
  caveat: 'É a combinação mais carregada visualmente.',
  params: RELIEF_PARAMS,
  create: (ctx) => createComposite(ctx, { tilt: true, crt: true, relief: true }),
};

export const EXPERIMENTS: readonly Experiment[] = [flat, tilt, crt, relief, allTogether];

export const findExperiment = (id: string | null): Experiment => EXPERIMENTS.find((e) => e.id === id) ?? flat;
