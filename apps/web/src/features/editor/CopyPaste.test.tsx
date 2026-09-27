import { expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { Editor, defaultProject, useEditor } from '@blooby/studio';

/** jsdom has no ClipboardEvent.clipboardData — a stand-in the handlers can read and write. */
function clip(type: 'copy' | 'paste', text = '') {
  const data = new Map([['text/plain', text]]);
  const e = new Event(type, { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', { value: { getData: (k: string) => data.get(k) ?? '', setData: (k: string, v: string) => data.set(k, v) } });
  act(() => { document.body.dispatchEvent(e); });
  return data.get('text/plain') ?? '';
}

it('⌘C a mascot in one project, ⌘V it into another — a new mascot with its keys and clips', () => {
  render(<Editor />);
  const a = defaultProject();
  act(() => { useEditor.getState().loadProject(a); useEditor.getState().select(['body']); });
  const text = clip('copy');
  expect(text.startsWith('blooby-layers:')).toBe(true);

  act(() => { useEditor.getState().loadProject(defaultProject()); });
  const before = Object.values(useEditor.getState().project.rig.nodes).filter((n) => n.kind === 'body').length;
  const tracksBefore = useEditor.getState().project.timelines[0].tracks.length;
  clip('paste', text);
  const s = useEditor.getState();
  const bodies = Object.values(s.project.rig.nodes).filter((n) => n.kind === 'body');
  expect(bodies.length).toBe(before + 1);
  const made = s.selection[0];
  expect(s.project.rig.nodes[made].kind).toBe('body');
  const tl = s.project.timelines.find((t) => t.id === s.project.activeTimelineId)!;
  expect(tl.tracks.length).toBeGreaterThan(tracksBefore);
  expect(tl.blocks.some((b) => b.mascotId === made)).toBe(true);
  // one undo takes the whole paste back
  act(() => { useEditor.getState().undo(); });
  expect(Object.values(useEditor.getState().project.rig.nodes).filter((n) => n.kind === 'body').length).toBe(before);
}, 30_000); // mounting the whole editor takes ~10s when the workspace's suites run side by side
