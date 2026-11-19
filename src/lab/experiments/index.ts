import { combo } from './combo';
import { crt, flat, tabletop, tilt } from './projection';
import { bloom, extrude, relief } from './shaders';
import type { Experiment } from './types';

export const EXPERIMENTS: readonly Experiment[] = [flat, tilt, tabletop, crt, relief, extrude, bloom, combo];

export const findExperiment = (id: string | null): Experiment => EXPERIMENTS.find((e) => e.id === id) ?? flat;
