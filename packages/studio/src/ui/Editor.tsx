import { useEffect, useRef, useState } from 'react';
import { useEditor, type RailTab } from '../core/store';
import { packProject } from '../core/presetRefs';
import { Stage } from './Stage';
import { Layers } from './Layers';
import { Presets, Expressions, OtherTimelines } from './Presets';
import { NodeInspector, CameraPanel, ClipInspector } from './Inspector';
import { EyePanel } from './EyePanel';
import { Effects } from './Effects';
import { Collapsible } from './Collapsible';
import { Timeline, DurationField } from './Timeline';
import { Copilot } from './Copilot';
import { McpPanel } from './McpPanel';
import { ExportBar } from './ExportBar';
import { Split } from './Resizable';
import { TimelineTabs } from './TimelineTabs';
import { Gallery, openGallery } from './Gallery';
import { CompositionDialog, openComposition } from './CompositionDialog';
import { ensureFonts } from '../core/fonts';
import { compOf } from '../core/comp';
import { importDotLottie } from '../export/dotlottie';
import { StateMachine } from './StateMachine';
import { looksLikeSvg } from '../core/svg';
import { LAYERS_MARK, makeSvgLayer } from '../core/layers';
import { activeTimeline } from '../core/types';
import { startTourWhenReady } from '../kit/tour';
import { GITHUB_URL, GithubMark, TourMenu } from '../kit/TourMenu';
import { WhatsNewButton } from '../kit/WhatsNew';
import { EDITOR_TOURS, INTRO_TOUR } from './tours';
import { Icon, useDismiss, type IconName } from './bits';
import { Tooltips } from './Tooltips';
import type { ReactNode } from 'react';
import type { Project } from '../core/types';



/** The whole editor UI — apps/web renders it with no onSave (local-file Save/Open only),
 * apps/admin's Preset Publisher passes onSave/saveLabel to add a second save destination
 * (a cloud table) alongside the local JSON download, which always stays available.
 *
 * `cloudBar` is whatever owns persisting this project — a save state and a save button.
 * It sits inside this header rather than in a strip above it: a second bar carrying one
 * button and a title the editor already shows is a row of chrome for nothing. */
export function Editor({ onSave, saveLabel, cloudBar, projectId }: {
  onSave?: (project: Project) => void; saveLabel?: string; cloudBar?: ReactNode;
  /** the cloud project open here, so the MCP tab can show what AI apps are doing to it */
  projectId?: string;
} = {}) {
  // first visit only; skipping counts as seen, and the ? button replays it
  useEffect(() => { startTourWhenReady('editor', INTRO_TOUR); }, []);
  const project = useEditor((s) => s.project);
  const playing = useEditor((s) => s.playing);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const loop = useEditor((s) => s.loop);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const selection = useEditor((s) => s.selection);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const deleteNode = useEditor((s) => s.deleteNode);
  const duplicateLayer = useEditor((s) => s.duplicateLayer);
  const commit = useEditor((s) => s.commit);
  const loadProject = useEditor((s) => s.loadProject);
  const resetProject = useEditor((s) => s.resetProject);
  const tab = useEditor((s) => s.railTab);
  const setTab = useEditor((s) => s.setRailTab);
  const file = useRef<HTMLInputElement>(null);
  // the faces this project's text uses, fetched as it needs them — never all of Google Fonts
  useEffect(() => { void ensureFonts(project); }, [project]);

  // playback: wall-clock driven so a slow frame doesn't slow the animation down
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const state = useEditor.getState();
      const { playhead, project: p, pendingStateChange } = state;
      const duration = activeTimeline(p).timelineDurationMs;
      let t = playhead + (now - last);
      last = now;
      // a scheduled state.enableState(name, {at}) fires the instant playback reaches it
      if (pendingStateChange && t >= pendingStateChange.atMs) {
        state.setState(pendingStateChange.timelineId, { duration: pendingStateChange.durationMs, easing: pendingStateChange.easing });
        raf = requestAnimationFrame(tick);
        return;
      }
      if (t >= duration) {
        if (loop) t = t % duration;
        else { setPlayhead(duration); setPlaying(false); return; }
      }
      setPlayhead(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, setPlayhead, setPlaying]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 'd' && selection[0]) { e.preventDefault(); duplicateLayer(selection[0]); return; }
      if (e.key === ' ') { e.preventDefault(); setPlaying(!useEditor.getState().playing); }
      if (e.key === 'Home') setPlayhead(0);
      if (e.key === 'Escape') useEditor.getState().setEditPoints(false);
      if ((e.key === 'Backspace' || e.key === 'Delete') && selection.length) {
        const rig = useEditor.getState().project.rig;
        for (const id of selection) if (!rig.nodes[id]?.locked) deleteNode(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, setPlaying, setPlayhead, selection, deleteNode, duplicateLayer]);

  /**
   * Paste an SVG anywhere — the stage, the timeline, the rails — and it becomes a layer,
   * starting at the playhead. Text fields keep their own paste (the shape editor's path
   * field turns an SVG into an outline instead), and anything that is not SVG markup is
   * left for the timeline's keyframe paste.
   */
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const text = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text/html') || '';
      // layers or a mascot copied here or in another project — before the timeline's keyframe paste
      if (text.startsWith(LAYERS_MARK)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const made = useEditor.getState().pasteLayers(text);
        setPasteNote(made.length ? `Pasted ${made.length === 1 ? `"${useEditor.getState().project.rig.nodes[made[0]]?.name}"` : `${made.length} layers`}.` : 'That copy could not be pasted.');
        setTimeout(() => setPasteNote(null), 4000);
        return;
      }
      if (!looksLikeSvg(text)) return;
      const made = makeSvgLayer(text);
      if (!made) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const { addLayer: add, playhead } = useEditor.getState();
      add(made.node, { appearAt: playhead });
      setPasteNote(made.warnings.length ? `Pasted "${made.node.name}". Not carried over: ${made.warnings.join('; ')}.` : `Pasted "${made.node.name}".`);
      setTimeout(() => setPasteNote(null), 4000);
    };
    // capture, so it is decided here before the timeline's keyframe paste sees it
    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
  }, []);

  /** ⌘C with layers selected copies them — a mascot with its parts, keys and clips — as text,
   *  so ⌘V pastes them here, in another state, or in another project's tab. Keys selected in the
   *  timeline win (its capture-phase copy runs first and claims the event). */
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))) return;
      if (window.getSelection()?.toString()) return; // selected words on the page copy as words
      const text = useEditor.getState().copyLayers();
      if (!text) return;
      e.clipboardData?.setData('text/plain', text);
      e.preventDefault();
    };
    window.addEventListener('copy', onCopy);
    return () => window.removeEventListener('copy', onCopy);
  }, []);

  const importProject = async (f: File) => {
    // §12: a .lottie brings its state machine in — inputs, states, transitions,
    // conditions, timing and the initial state — rather than being treated as opaque.
    if (f.name.toLowerCase().endsWith('.lottie')) {
      try {
        const { project: next, states, inputs, warnings } = await importDotLottie(f, useEditor.getState().project);
        loadProject(next);
        alert([`Imported ${states} state${states === 1 ? '' : 's'} and ${inputs} input${inputs === 1 ? '' : 's'}.`, ...warnings].join('\n'));
      } catch (e) { alert(e instanceof Error ? e.message : 'That .lottie could not be read.'); }
      return;
    }
    try { loadProject(JSON.parse(await f.text()) as Project); }
    catch { alert('That file is not a blooby project.'); }
  };

  const saveProject = () => {
    const blob = new Blob([JSON.stringify(packProject(project), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.blooby.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark" aria-label="blooby"><span className="dot" /><span className="wordmark-word">blooby</span></span>
        <input className="proj-name" value={project.name} aria-label="Project name" title="Rename the project"
          onChange={(e) => commit((p) => { p.name = e.target.value; }, 'projname')} />
        {cloudBar}
        <span className="topbar-group" role="group" aria-label="History">
          <button className="btn ghost icon" onClick={undo} title="Undo (⌘Z)" aria-label="Undo"><Icon name="undo" size={17} /></button>
          <button className="btn ghost icon" onClick={redo} title="Redo (⇧⌘Z)" aria-label="Redo"><Icon name="redo" size={17} /></button>
        </span>
        <span className="spacer" />
        <DurationField />
        <button className="btn ghost sm comp-chip" onClick={openComposition} title="Composition — size, frame rate, length and backdrop">
          {compOf(project).width} × {compOf(project).height}
        </button>
        <input ref={file} type="file" accept=".json,.lottie" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ''; }} />
        <WhatsNewButton surface="editor" />
        <TourMenu tours={EDITOR_TOURS} label="Show me around" />
        <MoreMenu project={project} items={[
          { icon: 'folder', label: 'Open a file…', hint: 'A .blooby.json project, or a .lottie to import its state machine', onSelect: () => file.current?.click() },
          { icon: 'download', label: 'Download project file', hint: 'Saves a .blooby.json you can open again', onSelect: saveProject },
          ...(onSave ? [{ icon: 'cloud' as const, label: saveLabel ?? 'Save to cloud', onSelect: () => onSave(project) }] : []),
          { icon: 'gallery', label: 'Gallery', hint: 'Projects saved in this browser', onSelect: openGallery },
          { icon: 'file', label: 'Start over', hint: 'Back to the default mascot', danger: true,
            onSelect: () => { if (confirm(`Reset "${project.name}"?\n\nThe rig, every timeline, the state machine and all keyframes go back to the default mascot. This cannot be undone — save or export first if you want to keep it.`)) resetProject(); } },
        ]} />
        <span data-tour="export"><ExportBar /></span>
      </header>

      <div className="body-split">
        <Split direction="column" storageKey="vertical" flexIndex={0} panes={[
          { content: (
            <Split direction="row" storageKey="main" flexIndex={1} panes={[
              { min: 190, max: 460, content: (
                <div className="rail rail-left" data-tour="rail-left">
                  <Layers />
                  <Presets />
                  <OtherTimelines />
                  <Expressions />
                </div>
              ) },
              { min: 320, content: <div className="stage" data-tour="stage"><Stage /></div> },
              { min: 240, max: 560, content: (
                <div className="rail rail-right" data-tour="rail-right">
                  <nav className="tabs" aria-label="Panels">
                    {(['node', 'fx', 'eyes', 'states', 'ai'] as RailTab[]).map((t) => (
                      <button key={t} data-tour={`tab-${t}`} aria-pressed={tab === t || (t === 'ai' && tab === 'mcp')} onClick={() => setTab(t)}
                        title={TAB_HELP[t]}>
                        <span className="tab-ico"><Icon name={TAB_ICON[t]} size={17} /></span>
                        <span className="tab-label">{t === 'node' && selectedBlockId ? 'Clip' : TAB_LABEL[t]}</span>
                      </button>
                    ))}
                  </nav>
                  <div className="rail-tab-body">
                    {/* folds rather than a split, for the same reason as the Effects tab:
                        the inspector is the section you are working in, so it gets the height */}
                    {tab === 'node' && (
                      selectedBlockId ? <ClipInspector /> : (
                        <>
                          <NodeInspector />
                          <Collapsible title="Camera" storageKey="node-camera" defaultOpen={false}>
                            <CameraPanel bare />
                          </Collapsible>
                        </>
                      )
                    )}
                    {tab === 'eyes' && <EyePanel />}
                    {/* folds, not a split: a split gives every section a share of the
                        height whether or not it has anything in it, so the one you are
                        working in never gets enough */}
                    {tab === 'fx' && (
                      <>
                        <Effects />
                        <Collapsible title="Camera" storageKey="camera" defaultOpen={false}>
                          <CameraPanel bare />
                        </Collapsible>
                      </>
                    )}
                    {tab === 'states' && <StateMachine />}
                    {(tab === 'ai' || tab === 'mcp') && (
                      <div className="seg sub-tabs" role="tablist" aria-label="AI">
                        <button role="tab" aria-pressed={tab === 'ai'} aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>Copilot</button>
                        <button role="tab" data-tour="tab-mcp" aria-pressed={tab === 'mcp'} aria-selected={tab === 'mcp'} onClick={() => setTab('mcp')}>Connect AI apps</button>
                      </div>
                    )}
                    {tab === 'ai' && <Copilot />}
                    {tab === 'mcp' && <McpPanel projectId={projectId} />}
                  </div>
                </div>
              ) },
            ]} />
          ) },
          // the timeline's first height scales with the window, so a laptop screen still
          // leaves the stage room; a dragged height is remembered after that
          { min: 220, max: 780, default: Math.round(Math.min(420, Math.max(260, window.innerHeight * 0.4))), content: (
            <div className="timeline-pane" data-tour="timeline">
              <TimelineTabs />
              <Timeline onOpenEffects={() => setTab('fx')} />
            </div>
          ) },
        ]} />
      </div>
      <Gallery />
      <CompositionDialog />
      <Tooltips />
      {pasteNote && <div className="toast" role="status">{pasteNote}</div>}
    </div>
  );
}

/* the right rail, in the order people reach for it: the selected thing, how it moves,
   its face, the state machine, then help from AI (the copilot, or an outside app over MCP) */
const TAB_LABEL: Record<RailTab, string> = { node: 'Design', fx: 'Effects', eyes: 'Eyes', states: 'States', ai: 'AI', mcp: 'AI' };
const TAB_ICON: Record<RailTab, IconName> = { node: 'sliders', fx: 'sparkle', eyes: 'eye', states: 'flow', ai: 'bot', mcp: 'plug' };
const TAB_HELP: Record<RailTab, string> = {
  node: 'Design — position, size, colour and everything else about what is selected',
  fx: 'Effects — shake, float, particles and other motion on the selected layer or clip',
  eyes: 'Eyes — where the mascot looks, and blinks',
  states: 'States — the state machine that switches between your timelines',
  ai: 'AI — ask the copilot, or connect Claude, ChatGPT or Cursor',
  mcp: 'AI — ask the copilot, or connect Claude, ChatGPT or Cursor',
};

interface MoreItem { icon: IconName; label: string; hint?: string; danger?: boolean; onSelect: () => void }

/**
 * Everything about the project FILE — open, download, the local gallery, starting over —
 * plus the links nobody needs every day. One menu instead of six buttons in the header,
 * so what is left up there is what you actually use while animating.
 */
function MoreMenu({ project, items }: { project: Project; items: MoreItem[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [btn, pop]);
  const tl = activeTimeline(project);
  return (
    <span className="more-menu">
      <button ref={btn} className="btn ghost icon" data-tour="more-menu" aria-label="More" aria-haspopup="menu" aria-expanded={open}
        title="Open, download, gallery and more" onClick={() => setOpen((v) => !v)}><Icon name="more" size={18} /></button>
      {open && (
        <div ref={pop} className="menu-pop" role="menu">
          <div className="menu-head">
            {Object.keys(project.rig.nodes).length} layers · {tl.tracks.length} tracks · {tl.blocks.length} clips
          </div>
          {items.map((it) => (
            <button key={it.label} role="menuitem" className="menu-item" data-danger={it.danger || undefined}
              onClick={() => { setOpen(false); it.onSelect(); }}>
              <Icon name={it.icon} size={17} />
              <span className="menu-text"><span>{it.label}</span>{it.hint && <small>{it.hint}</small>}</span>
            </button>
          ))}
          <div className="menu-divider" />
          <a role="menuitem" className="menu-item" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <GithubMark size={16} /><span className="menu-text"><span>View on GitHub</span></span>
          </a>
          <div className="menu-links">
            <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
            <span aria-hidden>·</span>
            <a href="/terms" target="_blank" rel="noopener">Terms</a>
          </div>
        </div>
      )}
    </span>
  );
}
