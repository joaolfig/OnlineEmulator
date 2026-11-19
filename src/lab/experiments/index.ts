import { crt, flat, tilt } from './projection';
import { relief } from './shaders';
import type { Experiment } from './types';

/** Efeitos aprovados para continuar testando (modo mesa, extrusão, bloom e combo foram descartados). */
export const EXPERIMENTS: readonly Experiment[] = [flat, tilt, crt, relief];

export const findExperiment = (id: string | null): Experiment => EXPERIMENTS.find((e) => e.id === id) ?? flat;
