import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { panelTime, useEditor } from '../core/store';
import { Collapsible } from './Collapsible';
import { PROP_RANGE } from '../core/props';
import { activeTimeline } from '../core/types';
import { PROP_LABEL } from '../core/props';
import { activeTrackFor, valueAt } from '../core/scene';

/**
 * Thin-stroke icons for the layer panel, the stage and the inspector — scanned faster
 * than words in a dense rail. Drawn in currentColor at 1.6px on a 24 grid, so they sit
 * with the type rather than on top of it.
 */
const ICONS = {
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z',
  eyeOff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9 M6.5 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.5-1.6 M9.9 9.9a2.8 2.8 0 0 0 4 4',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  plus: 'M12 5v14 M5 12h14',
  pin: 'M12 16v6 M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z',
  shape: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z',
  svg: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16',
  hand: 'M5 18c3-2 5-5 6-9 M11 9c1-3 3-4 5-3 M16 6c2 0 3 2 2 4-.8 1.6-2.4 2-4 1.6',
  leg: 'M9 3c-1 5 1 8 4 11 M13 14c1 2 .5 4-1 5 M12 19h6',
  group: 'M4 7h6l2 2h8v10H4z',
  front: 'M12 4v12 M7 9l5-5 5 5 M5 20h14',
  back: 'M12 20V8 M7 15l5 5 5-5 M5 4h14',
  up: 'M12 19V5 M6 11l6-6 6 6',
  down: 'M12 5v14 M6 13l6 6 6-6',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  world: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z',
  anchor: 'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M12 8v13 M5 14a7 7 0 0 0 14 0 M8 11h8',
  points: 'M5 19l5-12 5 8 4-6 M5 19h.01 M10 7h.01 M15 15h.01 M19 9h.01',
  play: 'M8 5l11 7-11 7z',
  text: 'M5 7V5h14v2 M12 5v14 M9 19h6',
  pen: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.6 7.6 M11 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  cursor: 'M5 3l6.5 17 2.4-7.1L21 10.5z',
  pan: 'M18 11V6a2 2 0 0 0-4 0v5 M14 10V4a2 2 0 0 0-4 0v6 M10 10.5V6a2 2 0 0 0-4 0v8 M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15',
  turn: 'M20 12a8 8 0 1 1-2.6-5.9 M20 4v5h-5',
  mascot: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M9.5 10v2.5 M14.5 10v2.5',
  grid: 'M4 4h16v16H4z M4 12h16 M12 4v16',
  centre: 'M3 12h4 M17 12h4 M12 3v4 M12 17v4 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  expand: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  curve: 'M3 18c4 0 5-12 9-12s5 12 9 12',
  undo: 'M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  more: 'M12 4.8a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z M12 11.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z M12 17.4a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z',
  sliders: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4',
  sparkle: 'M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8L12 3Z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  flow: 'M6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M6 8v3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3',
  bot: 'M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z M12 4v4 M9.5 13v1 M14.5 13v1',
  plug: 'M9 3v5 M15 3v5 M6 8h12v3a6 6 0 0 1-12 0V8Z M12 17v4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M9.6 9.2a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.6 M12 17h.01',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  upload: 'M12 20V9 M7 14l5-5 5 5 M5 4h14',
  cloud: 'M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5H7Z',
  gallery: 'M4 5h7v7H4z M13 5h7v4h-7z M13 11h7v8h-7z M4 14h7v5H4z',
  file: 'M6 3h8l4 4v14H6z M14 3v4h4 M12 11v6 M9 14h6',
  shield: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z M9 12l2 2 4-4',
  doc: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  close: 'M6 6l12 12 M18 6L6 18',
  pause: 'M8 5v14 M16 5v14',
  prev: 'M18 6l-8 6 8 6z M6 5v14',
  next: 'M6 6l8 6-8 6z M18 5v14',
  loop: 'M17 2l3 3-3 3 M4 11V9a4 4 0 0 1 4-4h12 M7 22l-3-3 3-3 M20 13v2a4 4 0 0 1-4 4H4',
  layers: 'M12 3l9 5-9 5-9-5 9-5Z M3 13l9 5 9-5',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21a7 7 0 0 1 14 0 M17 3.5a4 4 0 0 1 0 7.5 M22 21a7 7 0 0 0-4.5-6.5',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.3l1-6.2L3 9.7l6.2-.9L12 3Z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z M4 19a2 2 0 0 1 2-2h13',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  splash: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 3a9 9 0 0 0 0 18Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4',
  grid4: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 14, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Panel({ title, actions, children, flush, fold }: {
  title: string; actions?: ReactNode; children: ReactNode; flush?: boolean;
  /** a panel you only sometimes need folds away, remembering whether it was open */
  fold?: { storageKey: string; defaultOpen?: boolean };
}) {
  if (fold) return <Collapsible title={title} storageKey={fold.storageKey} defaultOpen={fold.defaultOpen} actions={actions}>{children}</Collapsible>;
  return (
    <section className={flush ? 'panel flush' : 'panel'}>
      <header className="panel-head">
        <h2 className="panel-title">{title}</h2>
        <span className="spacer" />
        {actions}
      </header>
      {flush ? children : <div className="panel-body">{children}</div>}
    </section>
  );
}

/** Number input that only commits on blur/Enter, so typing "-" doesn't snap to 0. */
/**
 * A number you can type, or scrub by dragging across it — the convention every other
 * motion tool uses, and the reason nobody types a value they only want to nudge.
 *
 * A drag only starts once the pointer has actually moved, so a plain click still puts the
 * caret in the field and typing keeps working.
 */
export function NumberField({ value, onChange, step = 1, className = 'prop-num' }: { value: number; onChange: (v: number) => void; step?: number; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const shown = draft ?? fmtNum(value);

  const startScrub = (down: React.PointerEvent<HTMLInputElement>) => {
    if (down.button !== 0) return;
    const from = value;
    const x0 = down.clientX;
    let moved = false;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) < 3) return;      // a click is not a drag
      if (!moved) { moved = true; setScrubbing(true); }
      // shift for fine, alt for coarse — the same modifiers these tools always use
      const scale = e.shiftKey ? 0.1 : e.altKey ? 10 : 1;
      const next = from + dx * step * scale;
      // snap to the step's own precision, so dragging by 0.1 does not produce 0.30000004
      const places = Math.max(0, Math.ceil(-Math.log10(step * scale)));
      onChange(Number(next.toFixed(Math.min(6, places))));
    };
    const up = () => {
      setScrubbing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const flush = () => {
    if (draft === null) return;
    const n = parseFloat(draft);
    if (Number.isFinite(n)) onChange(n);
    setDraft(null);
  };
  return (
    <input className={`${className} scrubbable${scrubbing ? ' scrubbing' : ''}`} value={shown} inputMode="decimal" step={step}
      onPointerDown={startScrub}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={flush}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { flush(); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') setDraft(null);
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
          onChange(Math.round((value + d) * 1000) / 1000);
        }
      }} />
  );
}

const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/**
 * Stopwatch + slider + number. The only way a numeric property is ever edited.
 * `nodeId` can be an array — every write applies to every id in it, so selecting both
 * eyes and dragging one slider moves both, in lock-step, as one undo step.
 */
export function PropRow({ nodeId, property, label, linkTo }: {
  nodeId: string | string[]; property: string; label?: string;
  /** another property that moves with this one, keeping their ratio — scale X with scale Y */
  linkTo?: string;
}) {
  const setValue = useEditor((s) => s.setValue);
  const toggleKeyframe = useEditor((s) => s.toggleKeyframe);
  const selectTrack = useEditor((s) => s.selectTrack);

  const ids = Array.isArray(nodeId) ? nodeId : [nodeId];
  const primary = ids[0];
  // selected, not subscribed whole: a row re-renders when ITS value or driver changes, not
  // on every edit and every frame anywhere in the project
  const v = useEditor((s) => valueAt(s.project, primary, property, panelTime(s)));
  const driver = useEditor((s) => {
    const track = activeTrackFor(activeTimeline(s.project), primary, property, panelTime(s));
    return track ? (track.blockId ? 'clip' : 'keyframes') : 'base';
  });
  if (typeof v !== 'number') return null;
  const [min, max, step] = PROP_RANGE[property] ?? [-100, 100, 1];

  const writeAll = (n: number) => {
    const { project, playhead } = useEditor.getState();
    for (const id of ids) {
      if (linkTo) {
        // the partner keeps its proportion to this one; from 0 it simply follows
        const mine = valueAt(project, id, property, playhead), other = valueAt(project, id, linkTo, playhead);
        if (typeof mine === 'number' && typeof other === 'number') {
          setValue(id, linkTo, Math.round((Math.abs(mine) > 1e-6 ? other * (n / mine) : n) * 1000) / 1000, `multi.${property}`);
        }
      }
      setValue(id, property, n, `multi.${property}`);
    }
  };
  const toggleAll = () => { for (const id of ids) toggleKeyframe(id, property); };

  return (
    <div className="prop" data-driver={driver}>
      <KeyNav nodeId={primary} property={property} onToggle={() => { toggleAll(); selectTrack(null); }} />
      <label className="prop-label"><span className="t">{label ?? PROP_LABEL[property] ?? property}</span>
        <input type="range" min={min} max={max} step={step} value={v}
          style={{ ['--fill' as string]: `${Math.min(100, Math.max(0, ((v - min) / (max - min || 1)) * 100))}%` }}
          onChange={(e) => writeAll(parseFloat(e.target.value))} />
      </label>
      <NumberField value={v} step={step} onChange={(n) => writeAll(clampTo(n, min, max))} />
    </div>
  );
}

const clampTo = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * The stopwatch, and the chevrons for walking this property's keyframes.
 *
 * Lit means "there is a keyframe HERE", not "this property is animated somewhere" — the
 * old meaning stayed on after the playhead moved off the keyframe, so a second click
 * looked like it would add one and instead deleted the whole track. Every panel with a
 * stopwatch uses this, so none of them can drift back to the old behaviour.
 */
export function KeyNav({ nodeId, property, onToggle }: {
  nodeId: string; property: string; onToggle: () => void;
}) {
  const setPlayhead = useEditor((s) => s.setPlayhead);

  // across whichever clips animate it: navigating should walk the property, not stop at
  // the edge of the clip that happens to own the keyframe under the playhead. Selected
  // shallowly, so the stopwatch re-renders when one of these changes, not every frame.
  const { any, here, prev, next } = useEditor(useShallow((s) => {
    const playhead = panelTime(s);
    const times = [...new Set(
      activeTimeline(s.project).tracks
        .filter((t) => t.nodeId === nodeId && t.property === property)
        .flatMap((t) => t.keyframes.map((k) => Math.round(k.time))),
    )].sort((a, b) => a - b);
    return {
      any: times.length > 0,
      here: times.some((t) => Math.abs(t - playhead) < 1),
      prev: [...times].reverse().find((t) => t < playhead - 1),
      next: times.find((t) => t > playhead + 1),
    };
  }));
  const secs = (t: number) => `${(t / 1000).toFixed(2)}s`;

  return (
    <span className="keynav">
      {/* only once there is something to walk to, so an un-animated property keeps the
          row it always had */}
      {any && (
        <button className="keychev" disabled={prev === undefined} aria-label="Previous keyframe"
          title={prev === undefined ? 'No earlier keyframe' : `Go to ${secs(prev)}`}
          onClick={() => prev !== undefined && setPlayhead(prev)}>‹</button>
      )}
      <button className="stopwatch" aria-pressed={here}
        title={here ? 'Keyframe here — click to remove it' : 'Add a keyframe here'}
        onClick={onToggle} />
      {any && (
        <button className="keychev" disabled={next === undefined} aria-label="Next keyframe"
          title={next === undefined ? 'No later keyframe' : `Go to ${secs(next)}`}
          onClick={() => next !== undefined && setPlayhead(next)}>›</button>
      )}
    </span>
  );
}

/**
 * Close an open menu, popover or tray when the pointer goes down anywhere outside it, or on
 * Escape. `inside` is every element that counts as the menu — its trigger too, so a click on
 * the trigger toggles it rather than closing and reopening. Capture phase, so a canvas that
 * stops propagation still closes it.
 */
export function useDismiss(open: boolean, close: () => void, inside: RefObject<Element | null>[]) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!inside.some((r) => r.current?.contains(t))) latest.current();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') latest.current(); };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
