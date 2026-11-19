import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RomLibrary, type RomMeta } from '../adapters/storage/romLibrary';
import { startInputLoop } from '../app/inputLoop';
import { splitGameName } from '../core/catalog/thumbnails';
import { EXPERIMENTS, findExperiment } from './experiments';
import type { Experiment } from './experiments/types';
import { LabStage } from './stage';
import { createDemoSource, createRomSource, type LabSource } from './sources';

const IDEA_LABEL = {
  ref: 'Referência',
  '1': 'Ideia 1 · 3D',
  '2': 'Ideia 2 · Shader',
  combo: 'Combo',
} as const;

const initialParams = (experiment: Experiment) =>
  Object.fromEntries(experiment.params.map((p) => [p.key, p.value]));

/**
 * Laboratório de efeitos visuais. Página separada (lab.html), sem link na tela principal:
 * nada daqui afeta o jogo de verdade.
 */
export function LabApp() {
  const query = useMemo(() => new URLSearchParams(location.search), []);
  const [experiment, setExperiment] = useState(() => findExperiment(query.get('exp')));
  const [params, setParams] = useState<Record<string, number>>(() => initialParams(experiment));
  const [fps, setFps] = useState(0);
  const [pixelated, setPixelated] = useState(true);
  const [roms, setRoms] = useState<RomMeta[]>([]);
  const [romSource, setRomSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const originalEl = useRef<HTMLDivElement>(null);
  const emulatorEl = useRef<HTMLDivElement>(null);
  const stage = useRef<LabStage | null>(null);
  const source = useRef<LabSource | null>(null);
  // Objeto mutável compartilhado com a experiência: mexer no controle deslizante não recria a cena.
  const liveParams = useRef<Record<string, number>>(params);

  // Palco 3D + controles (teclado/gamepad) + fonte demo.
  useEffect(() => {
    if (!stageEl.current) return;
    const s = new LabStage(stageEl.current, setFps);
    stage.current = s;
    s.start();
    const demo = createDemoSource();
    source.current = demo;
    originalEl.current?.replaceChildren(demo.original);
    void s.setSource(demo.stream);
    const stopInput = startInputLoop((pad) => {
      s.setPad(pad);
      source.current?.setPad(pad);
    });
    new RomLibrary()
      .list()
      .then(setRoms)
      .catch(() => setRoms([]));
    return () => {
      stopInput();
      source.current?.dispose();
      s.dispose();
    };
  }, []);

  // Troca de experiência: recria a cena com os valores padrão dela.
  useEffect(() => {
    const fresh = initialParams(experiment);
    liveParams.current = fresh;
    setParams(fresh);
    stage.current?.setExperiment(experiment, fresh);
    const url = new URL(location.href);
    url.searchParams.set('exp', experiment.id);
    history.replaceState(null, '', url);
  }, [experiment]);

  useEffect(() => stage.current?.setPixelated(pixelated), [pixelated]);

  const setParam = (key: string, value: number) => {
    liveParams.current[key] = value;
    setParams({ ...liveParams.current });
  };

  const loadRom = async (rom: RomMeta) => {
    if (!emulatorEl.current || !stage.current) return;
    setError(null);
    setRomSource(splitGameName(rom.catalogName ?? rom.name).title);
    try {
      const file = await new RomLibrary().load(rom.id);
      source.current?.dispose();
      // Nome separado: o save do cartucho no laboratório não mistura com o jogo de verdade.
      const romSrc = await createRomSource(file, `${rom.name} (lab)`, emulatorEl.current);
      source.current = romSrc;
      originalEl.current?.replaceChildren();
      await stage.current.setSource(romSrc.stream);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div class="lab">
      <aside class="lab-sidebar stack">
        <header>
          <h1>Laboratório de visual</h1>
          <p class="muted small">
            Testes das ideias de efeitos. Fica fora do jogo de verdade: nada aqui muda a sala nem os saves.
          </p>
        </header>

        <section class="stack tight">
          <h2>Fonte da imagem</h2>
          <div class="row">
            <button class={romSource ? '' : 'primary'} disabled={!!romSource} title="Cena de teste">
              Cena demo
            </button>
            {roms.map((rom) => (
              <button key={rom.id} disabled={!!romSource} onClick={() => void loadRom(rom)}>
                {splitGameName(rom.catalogName ?? rom.name).title}
              </button>
            ))}
          </div>
          {romSource ? (
            <p class="muted small">Rodando {romSource}. Para voltar à cena demo, recarregue a página.</p>
          ) : (
            roms.length === 0 && (
              <p class="muted small">Adicione ROMs na biblioteca do host para testar com jogos de verdade.</p>
            )
          )}
          {error && <p class="err small">{error}</p>}
          <p class="muted small">Controles: WASD/setas para andar, K = A (pular), ou um controle.</p>
        </section>

        <section class="stack tight">
          <h2>Efeitos</h2>
          <ul class="lab-list">
            {EXPERIMENTS.map((e) => (
              <li key={e.id}>
                <button
                  class={e.id === experiment.id ? 'primary' : ''}
                  aria-pressed={e.id === experiment.id}
                  onClick={() => setExperiment(e)}
                >
                  <span class="lab-tag">{IDEA_LABEL[e.idea]}</span> {e.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section class="stack tight">
          <h2>{experiment.name}</h2>
          <p class="small">{experiment.summary}</p>
          <p class="warn small">⚠ {experiment.caveat}</p>
          {experiment.params.map((p) => (
            <label key={p.key} class="lab-slider">
              <span class="row spread small">
                <span>{p.label}</span>
                <span class="mono">{params[p.key]}</span>
              </span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={params[p.key]}
                onInput={(e) => setParam(p.key, Number(e.currentTarget.value))}
              />
            </label>
          ))}
          <label class="check small">
            <input
              type="checkbox"
              checked={pixelated}
              onChange={(e) => setPixelated(e.currentTarget.checked)}
            />
            Pixels nítidos (sem suavizar)
          </label>
        </section>

        <section class="stack tight">
          <h2>Original (sem efeito)</h2>
          <div ref={originalEl} class="lab-original" />
          <div ref={emulatorEl} class="lab-original" hidden={!romSource} />
        </section>
      </aside>

      <main class="lab-main">
        <div ref={stageEl} class="lab-stage" data-testid="lab-stage" />
        <span class="pill mono lab-fps" data-testid="lab-fps">
          {fps} fps
        </span>
      </main>
    </div>
  );
}
