'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { stateAtStep, type FlowDefinition } from './flow.types';
import { LIGHT_THEME_VARS } from './lightTheme';

const sg = "var(--font-sans, sans-serif)";
const ORANGE = '#FF6A1A';
// Debajo de este ancho la "cámara" se acerca y sigue al elemento de cada paso
const SMALL_WIDTH = 600;
const ZOOM_SMALL = 1.75;

type Mode = 'demo' | 'practice';
type Point = { x: number; y: number };

interface FlowSimulatorProps<S> {
  flow: FlowDefinition<S>;
  renderScreen: (state: S) => React.ReactNode;
  label: string;
}

/**
 * Simulador animado de un flujo del panel. Dos modos:
 * - Demostración: un cursor recorre los pasos solo (se puede pausar y navegar).
 * - Práctica: el elemento del paso parpadea y el usuario debe tocarlo.
 * La pantalla (`renderScreen`) marca los elementos tocables con `data-flow-target`.
 */
export function FlowSimulator<S>({ flow, renderScreen, label }: FlowSimulatorProps<S>) {
  const scopeId = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>('demo');
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const [state, setState] = useState<S>(flow.initialState);
  const [hot, setHot] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [ripple, setRipple] = useState<(Point & { key: number }) | null>(null);
  const [nudge, setNudge] = useState(false);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0, height: flow.height, small: false });
  const focusRef = useRef<Point>({ x: flow.width / 2, y: flow.height / 2 });
  const practiceLock = useRef(false);

  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  // ── Escala y cámara ──
  const layout = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const vw = wrap.clientWidth || flow.width;
    const base = Math.min(1, vw / flow.width);
    const small = vw < SMALL_WIDTH;
    const scale = small ? Math.min(1, base * ZOOM_SMALL) : base;
    const height = small ? flow.height * base * 1.5 : flow.height * scale;
    const f = focusRef.current;
    const tx = small ? Math.min(0, Math.max(vw - flow.width * scale, vw / 2 - f.x * scale)) : Math.max(0, (vw - flow.width * scale) / 2);
    const ty = small ? Math.min(0, Math.max(height - flow.height * scale, height / 2 - f.y * scale)) : 0;
    setView({ scale, tx, ty, height, small });
  }, [flow.width, flow.height]);

  useEffect(() => {
    layout();
    if (typeof ResizeObserver === 'undefined' || !wrapRef.current) return;
    const ro = new ResizeObserver(layout);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [layout]);

  const findTarget = useCallback(
    (key: string) => stageRef.current?.querySelector<HTMLElement>(`[data-flow-target="${key}"]`) ?? null,
    []
  );

  // Centro del elemento en coordenadas internas de la pantalla simulada
  const centerOf = useCallback((el: HTMLElement): Point => {
    const stage = stageRef.current!;
    const a = el.getBoundingClientRect();
    const b = stage.getBoundingClientRect();
    const scale = b.width / flow.width || 1;
    return { x: (a.left - b.left + a.width / 2) / scale, y: (a.top - b.top + a.height / 2) / scale };
  }, [flow.width]);

  const focusOn = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    focusRef.current = centerOf(el);
    layout();
  }, [centerOf, layout]);

  const showRipple = (p: Point) => setRipple({ ...p, key: Date.now() });

  const goNext = useCallback(() => {
    if (index < flow.steps.length - 1) setIndex(index + 1);
    else { setFinished(true); setHot(null); setCursor(null); setPlaying(false); }
  }, [index, flow.steps.length]);

  // ── Motor de pasos ──
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<boolean>((r) => setTimeout(() => r(!cancelled), reduceMotion.current ? Math.min(ms, 250) : ms));
    const step = flow.steps[index];

    setFinished(false);
    setHot(null);
    setNudge(false);
    practiceLock.current = false;
    setState(stateAtStep(flow, index));

    (async () => {
      if (!(await wait(450))) return;

      if (step.auto) {
        if (mode === 'practice') setCursor(null);
        setState((s) => step.act(s));
        requestAnimationFrame(() => !cancelled && focusOn(findTarget(step.target)));
        if (mode === 'demo' && !playing) return;
        if (await wait(mode === 'demo' ? 2600 : 1800)) goNext();
        return;
      }

      const el = findTarget(step.target);
      if (mode === 'practice') {
        setCursor(null);
        setHot(step.target);
        focusOn(el);
        return;
      }

      // Demostración
      if (!el) return;
      focusOn(el);
      if (view.small && !(await wait(500))) return;
      const p = centerOf(el);
      setCursor(p);
      if (!playing) { setHot(step.target); return; }
      if (!(await wait(850))) return;
      setHot(step.target);
      if (!(await wait(450))) return;
      showRipple(p);
      setHot(null);
      setState((s) => step.act(s));
      if (await wait(2300)) goNext();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el motor se reinicia solo al cambiar paso, modo, reproducción o reinicio
  }, [index, mode, playing, run]);

  // ── Modo práctica: el usuario toca ──
  function handleStageClick(e: React.MouseEvent) {
    if (mode !== 'practice' || finished || practiceLock.current) return;
    const step = flow.steps[index];
    if (step.auto) return;
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-flow-target]');
    if (hit?.dataset.flowTarget === step.target) {
      practiceLock.current = true;
      showRipple(centerOf(hit));
      setHot(null);
      setState((s) => step.act(s));
      setTimeout(goNext, reduceMotion.current ? 250 : 1300);
    } else {
      setNudge(true);
      setTimeout(() => setNudge(false), 1600);
    }
  }

  function changeMode(m: Mode) {
    setMode(m);
    setPlaying(m === 'demo');
    setIndex(0);
    setRun((r) => r + 1);
  }
  function jump(i: number) {
    setPlaying(false);
    setIndex(i);
    setRun((r) => r + 1);
  }
  function restart() {
    setPlaying(mode === 'demo');
    setIndex(0);
    setRun((r) => r + 1);
  }
  function togglePlay() {
    if (finished) { restart(); return; }
    setPlaying((p) => !p);
  }

  const step = flow.steps[index];
  const progress = finished ? 100 : (index / (flow.steps.length - 1)) * 100;
  const btn: React.CSSProperties = {
    border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-1)',
    fontFamily: sg, fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <section
      aria-label={label}
      style={{ ...LIGHT_THEME_VARS, fontFamily: sg, background: 'var(--t-surface)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)', borderRadius: 20, padding: 14, margin: '20px 0', boxShadow: '0 10px 30px rgba(27,21,18,.10)' }}
    >
      {/* dangerouslySetInnerHTML: el texto de <style> se escapa distinto en servidor y cliente (error de hidratación) */}
      <style dangerouslySetInnerHTML={{ __html: `
        #${scopeId} [data-flow-target="${hot ?? '__none__'}"] {
          position: relative; z-index: 5; border-radius: 12px;
          box-shadow: 0 0 0 3px ${ORANGE}, 0 0 0 9px ${ORANGE}26 !important;
          animation: flowPulse 1.3s ease-in-out infinite;
        }
        #${scopeId}.practice [data-flow-target] { cursor: pointer; }
        @keyframes flowPulse { 50% { box-shadow: 0 0 0 3px ${ORANGE}, 0 0 0 14px transparent !important; } }
        @keyframes flowRipple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.6); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) {
          #${scopeId} * { animation: none !important; transition: none !important; }
        }
      ` }} />

      <div role="group" aria-label="Modo del simulador" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--t-surface-2)', borderRadius: 999, width: 'fit-content', marginBottom: 12 }}>
        {([['demo', '▶ Ver demostración'], ['practice', '👆 Practica tú']] as const).map(([m, text]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => changeMode(m)}
            style={{ border: 0, cursor: 'pointer', fontFamily: sg, fontWeight: 700, fontSize: 13, padding: '7px 14px', borderRadius: 999, background: mode === m ? 'var(--t-surface)' : 'transparent', color: mode === m ? 'var(--t-text-1)' : 'var(--t-text-2)', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}
          >
            {text}
          </button>
        ))}
      </div>

      <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: view.height, overflow: 'hidden', borderRadius: 14, background: '#F3ECE5' }}>
        <div
          ref={stageRef}
          id={scopeId}
          className={mode === 'practice' ? 'practice' : undefined}
          onClick={handleStageClick}
          data-testid="flow-stage"
          style={{
            position: 'absolute', top: 0, left: 0, width: flow.width, height: flow.height, overflow: 'hidden',
            transformOrigin: '0 0', transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transition: 'transform .6s cubic-bezier(.45,.05,.25,1)', userSelect: 'none', background: '#F3ECE5',
          }}
        >
          {renderScreen(state)}

          {ripple && (
            <span
              key={ripple.key}
              aria-hidden
              style={{ position: 'absolute', left: ripple.x - 17, top: ripple.y - 17, width: 34, height: 34, borderRadius: '50%', border: `3px solid ${ORANGE}`, zIndex: 9, pointerEvents: 'none', animation: 'flowRipple .55s ease-out forwards' }}
            />
          )}

          <svg
            aria-hidden
            viewBox="0 0 24 24"
            width={22}
            height={22}
            style={{
              position: 'absolute', top: 0, left: 0, zIndex: 10, pointerEvents: 'none',
              opacity: cursor ? 1 : 0, transform: cursor ? `translate(${cursor.x - 4}px, ${cursor.y - 3}px)` : undefined,
              transition: 'transform .75s cubic-bezier(.45,.05,.25,1), opacity .3s', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))',
            }}
          >
            <path d="M4 2l15 9.5-6.6 1.3 3.9 7.4-2.9 1.5-3.9-7.4L4 19z" fill="#fff" stroke="#1B1512" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>

          <div
            aria-hidden={!nudge}
            style={{ position: 'absolute', left: '50%', bottom: 14, transform: `translateX(-50%) translateY(${nudge ? 0 : 20}px)`, opacity: nudge ? 1 : 0, transition: 'opacity .25s, transform .25s', background: '#1B1512', color: '#fff', fontWeight: 700, fontSize: 12, padding: '7px 12px', borderRadius: 999, zIndex: 11, pointerEvents: 'none', whiteSpace: 'nowrap' }}
          >
            Toca el elemento que parpadea
          </div>
        </div>
      </div>

      {view.small && (
        <p style={{ margin: '8px 4px 0', fontSize: 12, color: 'var(--t-text-3)' }}>En el celular la cámara se acerca sola a cada paso.</p>
      )}

      <div aria-live="polite" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 4px 2px' }}>
        <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: finished ? '#059669' : ORANGE, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
          {finished ? '✓' : index + 1}
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{finished ? flow.doneTitle : step.title}</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--t-text-2)' }}>{finished ? flow.doneText[mode] : step.text}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 4px 2px' }}>
        <button type="button" style={btn} onClick={() => jump(Math.max(0, index - 1))} disabled={index === 0 && !finished}>‹ Anterior</button>
        {mode === 'demo' && (
          <button type="button" style={{ ...btn, background: ORANGE, borderColor: ORANGE, color: '#fff' }} onClick={togglePlay}>
            {playing && !finished ? '❚❚ Pausar' : '▶ Reproducir'}
          </button>
        )}
        <button type="button" style={btn} onClick={() => jump(Math.min(flow.steps.length - 1, index + 1))} disabled={index === flow.steps.length - 1}>Siguiente ›</button>
        <div aria-hidden style={{ flex: 1, minWidth: 120, height: 6, background: 'var(--t-surface-2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: ORANGE, transition: 'width .4s' }} />
        </div>
        <button type="button" style={btn} onClick={restart}>↺ Reiniciar</button>
      </div>

      <ol aria-label="Pasos" style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {flow.steps.map((s, i) => {
          const done = finished || i < index;
          const current = !finished && i === index;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={current ? 'step' : undefined}
                title={s.title}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${current ? ORANGE : 'var(--t-border)'}`, cursor: 'pointer',
                  background: current ? `${ORANGE}14` : 'var(--t-surface)', color: current ? 'var(--t-text-1)' : 'var(--t-text-2)',
                  fontFamily: sg, fontWeight: 600, fontSize: 12, padding: '5px 10px 5px 5px', borderRadius: 999,
                }}
              >
                <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800, background: done ? '#059669' : 'transparent', color: done ? '#fff' : current ? ORANGE : 'var(--t-text-3)', border: done ? 'none' : `2px solid ${current ? ORANGE : 'var(--t-border)'}` }}>
                  {done ? '✓' : i + 1}
                </span>
                {s.title}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
