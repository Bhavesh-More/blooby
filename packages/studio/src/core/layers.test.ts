import { it } from 'vitest';
import { check, near } from './testkit';
import { defaultProject } from './defaults';
import { compOf } from './comp';
import { buildScene, evaluateRig, sceneAt } from './scene';
import {
  copyLayers, duplicateLayer, groupLayers, pasteLayers, layerOrder, makeShapeLayer, removeLayer, reorderLayer, setAppearance,
  setAttachment, ungroupLayer, isInside,
} from './layers';
import { activeTimeline } from './types';
import type { Project } from './types';

const itemOf = (p: Project, id: string, t = 0) => buildScene(evaluateRig(p, t), compOf(p)).find((s) => s.id === id);

// --- one draw order, and it is zIndex ------------------------------------------
{
  const p = defaultProject();
  p.rig.nodes.star = { ...makeShapeLayer('star', { id: 'star' }), zIndex: 10 };
  const ids = () => layerOrder(p.rig).map((n) => n.id).join(',');
  const drawn = () => buildScene(evaluateRig(p, 0), compOf(p)).map((s) => s.id).join(',');
  it('the order is back to front by zIndex', check(ids() === 'body,face,eyeL,eyeR,star', ids()));
  it('and the stage paints in exactly that order', check(drawn() === ids().replace('face,', ''), drawn()));

  reorderLayer(p, 'star', 'back');
  it('send to back puts it first', check(ids() === 'star,body,face,eyeL,eyeR', ids()));
  it('so it is painted behind the body', check(drawn().startsWith('star,'), drawn()));
  reorderLayer(p, 'star', 'forward');
  it('forward moves exactly one step', check(ids() === 'body,star,face,eyeL,eyeR', ids()));
  reorderLayer(p, 'star', 'front');
  it('bring to front puts it last', check(ids().endsWith(',star'), ids()));
  reorderLayer(p, 'star', 'backward');
  it('backward moves exactly one step', check(ids() === 'body,face,eyeL,star,eyeR', ids()));
  reorderLayer(p, 'star', 0);
  it('a number is a position', check(ids().startsWith('star,'), ids()));
  it('zIndex stays dense and unique, so a step is always one layer', check(layerOrder(p.rig).every((n, i) => n.zIndex === i)));
}

// --- world ↔ mascot, keeping everything where it is on screen ---------------------
{
  const p = defaultProject();
  // a bare timeline: the default one keyframes the body's yaw, which would mask the pose
  // these checks set directly on the rig
  Object.assign(activeTimeline(p), { tracks: [], blocks: [], modifiers: [] });
  p.rig.nodes.hat = makeShapeLayer('pebble', { id: 'hat', surface: { yaw: 0, pitch: 0, mapped: false, flatOffset: { x: 30, y: -120 } } });
  const before = itemOf(p, 'hat')!;
  it('a new shape is a world layer', check(p.rig.nodes.hat.parentId === null && before.cx === 390 && before.cy === 240, `${before.cx},${before.cy}`));

  setAttachment(p, 'hat', 'mascot', undefined, 0);
  const on = itemOf(p, 'hat')!;
  it('attaching to the mascot keeps it where it was', check(near(on.cx, before.cx, 0.6) && near(on.cy, before.cy, 0.6), `${before.cx},${before.cy} -> ${on.cx.toFixed(2)},${on.cy.toFixed(2)}`));
  it('and it lands ON the sphere, placed by angle', check(p.rig.nodes.hat.parentId === 'body' && p.rig.nodes.hat.surface.mapped));

  p.rig.nodes.body.surface.flatOffset = { x: 50, y: 0 };
  it('it follows the mascot as it moves', check(near(itemOf(p, 'hat')!.cx, on.cx + 50, 0.6)));
  p.rig.nodes.body.surface.flatOffset = { x: 0, y: 0 };

  p.rig.nodes.body.surface.yaw = 30;
  const turned = itemOf(p, 'hat')!;
  it('a head turn carries it round the surface — sideways AND foreshortened', check(turned.cx > on.cx + 20 && turned.w < on.w, `${on.cx.toFixed(1)} -> ${turned.cx.toFixed(1)}`));
  p.rig.nodes.body.surface.yaw = 0;
  p.rig.nodes.body.surface.pitch = 25;
  it('a pitch carries it vertically round the surface', check(itemOf(p, 'hat')!.cy > on.cy + 10));
  p.rig.nodes.body.surface.pitch = 0;

  p.rig.nodes.body.transform.scale = { x: 1.5, y: 1.5 };
  const big = itemOf(p, 'hat')!;
  it('when the mascot scales, the attachment scales with it', check(near((big.cy - 360) / (on.cy - 360), 1.5, 0.03), String(((big.cy - 360) / (on.cy - 360)).toFixed(3))));
  p.rig.nodes.body.transform.scale = { x: 1, y: 1 };

  // the offset on a mapped layer is the attachment nudge now, and it rides the body
  p.rig.nodes.hat.surface.flatOffset = { x: 10, y: 0 };
  it('an offset on an attached layer nudges it in the body\'s frame', check(near(itemOf(p, 'hat')!.cx, on.cx + 10, 0.6)));
  p.rig.nodes.hat.surface.flatOffset = { x: 0, y: 0 };

  setAttachment(p, 'hat', 'world', undefined, 0);
  const back = itemOf(p, 'hat')!;
  it('detaching keeps it where it was too', check(near(back.cx, before.cx, 0.6) && near(back.cy, before.cy, 0.6), `${back.cx.toFixed(2)},${back.cy.toFixed(2)}`));
  p.rig.nodes.body.surface.flatOffset = { x: 50, y: 0 };
  it('and a world layer ignores the mascot', check(near(itemOf(p, 'hat')!.cx, back.cx, 1e-6)));

  // off the silhouette it cannot be on the sphere, so it attaches as a flat offset
  p.rig.nodes.far = makeShapeLayer('star', { id: 'far', surface: { yaw: 0, pitch: 0, mapped: false, flatOffset: { x: 260, y: 0 } } });
  const far0 = itemOf(p, 'far')!;
  setAttachment(p, 'far', 'mascot', undefined, 0);
  it('past the rim it attaches flat, still where it was', check(!p.rig.nodes.far.surface.mapped && near(itemOf(p, 'far')!.cx, far0.cx, 0.6)));
  it('a layer can never be attached inside itself', check(!setAttachment(p, 'body', 'mascot', 'hat', 0)));
}

// --- appearance ranges ------------------------------------------------------------
{
  const p = defaultProject();
  p.rig.nodes.hi = makeShapeLayer('star', { id: 'hi' });
  const at = (t: number) => sceneAt(p, t, compOf(p)).find((s) => s.id === 'hi');
  setAppearance(p, 'hi', { startMs: 500, endMs: 1200 }, 0);
  it('a layer is not there before its range', check(!at(300)));
  it('it is there inside it', check(!!at(800)));
  it('and gone after it', check(!at(1300)));

  setAppearance(p, 'hi', { fadeInMs: 200 }, 800);
  it('a fade-in ramps its opacity', check((at(550)?.alpha ?? 1) < 0.5 && (at(800)?.alpha ?? 0) > 0.99, `${at(550)?.alpha} / ${at(800)?.alpha}`));
  it('without shrinking it — the range is about existing, not size', check(near(at(550)!.w, at(800)!.w, 1e-6)));
  const v = compOf(p);
  const a1 = JSON.stringify(sceneAt(p, 650, v));
  sceneAt(p, 1100, v);
  it('scrubbing back gives exactly the same frame', check(JSON.stringify(sceneAt(p, 650, v)) === a1));

  p.rig.nodes.hi.ranged = true;
  setAppearance(p, 'hi', null, 0);
  const mine = () => (activeTimeline(p).appearances ?? []).filter((a) => a.nodeId === 'hi');
  const end = activeTimeline(p).timelineDurationMs;
  it('Reset puts a ranged layer back for the whole clip, rather than off screen everywhere', check(!!at(0) && !!at(800) && !!at(end - 5)));
  it('as one open-ended range', check(mine().length === 1 && mine()[0].startMs === undefined && mine()[0].endMs === undefined, JSON.stringify(mine())));
  activeTimeline(p).appearances = [];
  it('a ranged layer with no range at all is never there', check(!at(300) && !at(800)));
  p.rig.nodes.hi.ranged = false;
  it('and an unranged one with no range is always there', check(!!at(300) && !!at(1300)));

  // a range dragged to the clip's edges is the whole clip — and stays so when the timeline grows
  {
    p.rig.nodes.hi.ranged = true;
    const tl0 = activeTimeline(p);
    const len = tl0.timelineDurationMs;
    setAppearance(p, 'hi', { startMs: 0, endMs: len }, 0);
    const e = mine()[0];
    it('a range reaching both ends is stored open-ended', check(e.startMs === undefined && e.endMs === undefined, JSON.stringify(e)));
    tl0.timelineDurationMs = len + 2000;
    it('so a longer timeline still shows the layer to its end', check(!!at(len + 1500)));
    tl0.timelineDurationMs = len;
    setAppearance(p, 'hi', { startMs: 300, endMs: len }, 0);
    it('a range starting later keeps its start and stays open at the end', check(mine()[0].startMs === 300 && mine()[0].endMs === undefined, JSON.stringify(mine()[0])));
    p.rig.nodes.hi.ranged = false;
  }

  // a range that came with a clip stays relative to the clip
  const tl = activeTimeline(p);
  tl.appearances = [{ id: 'x', nodeId: 'hi', blockId: tl.blocks[1].id, startMs: 100, endMs: 300 }];
  const start = tl.blocks[0].durationMs;
  it('a clip-scoped range runs inside its clip', check(!at(start + 50) && !!at(start + 200) && !at(start + 400)));
}

// --- duplicate, delete, group -------------------------------------------------------
{
  const p = defaultProject();
  const tl = activeTimeline(p);
  p.rig.nodes.s = makeShapeLayer('star', { id: 's' });
  tl.tracks.push({ id: 'ts', nodeId: 's', property: 'transform.rotation', keyframes: [
    { id: 'k1', time: 0, value: 0, easingOut: { type: 'linear' } }, { id: 'k2', time: 500, value: 90, easingOut: { type: 'linear' } }] });
  tl.appearances = [{ id: 'ap', nodeId: 's', startMs: 0, endMs: 900 }];
  const copy = duplicateLayer(p, 's')!;
  it('duplicate makes a new layer', check(!!p.rig.nodes[copy] && copy !== 's' && p.rig.nodes[copy].name === 'Star copy'));
  it('with its own copy of the animation', check(tl.tracks.some((t) => t.nodeId === copy) && tl.tracks.find((t) => t.nodeId === copy)!.keyframes[0].id !== 'k1'));
  it('and of its appearance range', check(tl.appearances.some((a) => a.nodeId === copy)));
  it('placed just above the original', check(p.rig.nodes[copy].zIndex === p.rig.nodes.s.zIndex + 1));
  removeLayer(p, copy);
  it('delete takes the layer, its tracks and its ranges with it', check(!p.rig.nodes[copy] && !tl.tracks.some((t) => t.nodeId === copy) && !tl.appearances.some((a) => a.nodeId === copy)));
  it('the body can never be deleted', check(removeLayer(p, 'body').size === 0 && !!p.rig.nodes.body));

  p.rig.nodes.a = makeShapeLayer('star', { id: 'a', surface: { yaw: 0, pitch: 0, mapped: false, flatOffset: { x: 200, y: 0 } } });
  p.rig.nodes.b = makeShapeLayer('blob', { id: 'b', surface: { yaw: 0, pitch: 0, mapped: false, flatOffset: { x: 260, y: 60 } } });
  const pos = () => ['a', 'b'].map((id) => itemOf(p, id)!);
  const [a0, b0] = pos();
  const g = groupLayers(p, ['a', 'b'], 0)!;
  const [a1, b1] = pos();
  it('grouping moves nothing', check(near(a0.cx, a1.cx, 0.01) && near(a0.cy, a1.cy, 0.01) && near(b0.cx, b1.cx, 0.01) && near(b0.cy, b1.cy, 0.01)));
  it('and both are inside the group', check(p.rig.nodes.a.parentId === g && p.rig.nodes.b.parentId === g));
  p.rig.nodes[g].transform.rotation = 180;
  const [a2, b2] = pos();
  it('turning the group turns its children about the group centre', check(near(a2.cx, b0.cx, 0.6) && near(a2.cy, b0.cy, 0.6) && near(b2.cx, a0.cx, 0.6), `${a2.cx.toFixed(1)},${a2.cy.toFixed(1)}`));
  p.rig.nodes[g].transform.rotation = 0;
  p.rig.nodes[g].transform.scale = { x: 2, y: 2 };
  it('scaling the group scales its children', check(near(pos()[0].w, a0.w * 2, 0.01)));
  p.rig.nodes[g].transform.scale = { x: 1, y: 1 };
  ungroupLayer(p, g, 0);
  const [a3, b3] = pos();
  it('ungrouping moves nothing either, and the group is gone', check(!p.rig.nodes[g] && near(a3.cx, a0.cx, 0.01) && near(b3.cy, b0.cy, 0.01)));
}

// --- eyes in a group still follow the gaze ----------------------------------------
{
  const p = defaultProject();
  const at = (id: string) => itemOf(p, id)!;
  const [l0, r0] = [at('eyeL'), at('eyeR')];
  const g = groupLayers(p, ['eyeL', 'eyeR'], 0)!;
  const [l1, r1] = [at('eyeL'), at('eyeR')];
  it('grouping the eyes moves nothing', check(near(l0.cx, l1.cx, 0.01) && near(l0.cy, l1.cy, 0.01) && near(r0.cx, r1.cx, 0.01), `${l0.cx},${l1.cx}`));
  it('and they stay on the sphere', check(p.rig.nodes.eyeL.surface.mapped && p.rig.nodes.eyeR.surface.mapped));
  p.rig.nodes.eyeL.surface.yaw += 20;
  it('so the gaze still moves them', check(at('eyeL').cx > l1.cx + 5, `${l1.cx} -> ${at('eyeL').cx}`));
  p.rig.nodes.eyeL.surface.yaw -= 20;
  ungroupLayer(p, g, 0);
  it('ungrouping keeps them on the sphere, where they were', check(p.rig.nodes.eyeL.surface.mapped && near(at('eyeL').cx, l0.cx, 0.01) && near(at('eyeL').cy, l0.cy, 0.01)));
}

// --- copy / paste: a mascot or a part, into this project or another ----------------
{
  const a = defaultProject(), b = defaultProject();
  const tl = activeTimeline(a);
  for (const x of [tl, activeTimeline(b)]) { x.blocks = []; x.tracks = []; x.modifiers = []; }
  tl.blocks = [{ id: 'bk', presetId: 'p_neutral', name: 'Hop', durationMs: 1000 }];
  tl.tracks.push({ id: 'tb', nodeId: 'eyeL', property: 'transform.rotation', blockId: 'bk', keyframes: [
    { id: 'k1', time: 0, value: 0, easingOut: { type: 'linear' } }, { id: 'k2', time: 800, value: 40, easingOut: { type: 'linear' } }] });
  a.rig.nodes.hat = makeShapeLayer('star', { id: 'hat', name: 'Hat', parentId: 'body' });
  tl.tracks.push({ id: 'th', nodeId: 'hat', property: 'transform.rotation', keyframes: [
    { id: 'k3', time: 200, value: 10, easingOut: { type: 'linear' } }] });

  // through the clipboard, as text — exactly what a paste in another tab gets
  const clip = JSON.parse(JSON.stringify(copyLayers(a, ['body', 'eyeL'])));
  it('a copied mascot carries its parts once, its keys and its clips', check(clip.nodes.length === Object.keys(a.rig.nodes).length && clip.blocks.length === 1 && clip.tracks.length === 2, clip));
  const [m] = pasteLayers(b, clip);
  const tb = activeTimeline(b);
  const eye = Object.values(b.rig.nodes).find((n) => n.role === 'eyeL' && n.id !== 'eyeL' && isInside(b.rig, n.id, m));
  it('lands as a NEW mascot beside the one there', check(!!m && m !== 'body' && b.rig.nodes[m].kind === 'body' && !!b.rig.nodes.body && b.rig.nodes[m].name === 'Mascot 2', b.rig.nodes[m]?.name));
  it('with its parts, still playing their roles', check(!!eye && eye.parentId !== null));
  const lane = tb.blocks.find((x) => x.mascotId === m);
  it('its clips in its own lane', check(!!lane && tb.blocks.length === 1, JSON.stringify(tb.blocks)));
  const key = tb.tracks.find((t) => t.nodeId === eye?.id);
  it('its keys on its own eye, in its own clip, at the same times', check(!!key && key.blockId === lane?.id && key.keyframes[1].time === 800 && key.keyframes[0].id !== 'k1', JSON.stringify(key)));
  it('and they play', check(near(evaluateRig(b, 800).nodes[eye!.id].transform.rotation, 40, 0.01)));
  it('the source is untouched', check(Object.keys(a.rig.nodes).length === 5 && tl.tracks.length === 2));

  // a part: onto the same part of whichever mascot is picked
  const [h] = pasteLayers(b, copyLayers(a, ['hat'])!, m);
  it('a pasted part hangs on the picked mascot', check(b.rig.nodes[h]?.parentId === m, String(b.rig.nodes[h]?.parentId)));
  it('with its keys', check(tb.tracks.some((t) => t.nodeId === h && t.keyframes[0].value === 10)));
  // pasted twice = two, and back into its own project it steps off the original
  const [h2] = pasteLayers(a, copyLayers(a, ['hat'])!);
  it('pasted where it came from it is a new layer, nudged off, named apart', check(h2 !== 'hat' && a.rig.nodes[h2].parentId === 'body'
    && a.rig.nodes[h2].name === 'Hat copy' && (a.rig.nodes[h2].surface.yaw !== a.rig.nodes.hat.surface.yaw || a.rig.nodes[h2].surface.flatOffset?.x !== a.rig.nodes.hat.surface.flatOffset?.x)));
  it('a clip that is not coming along is unscoped, keeping its moments', check(copyLayers(a, ['eyeL'])!.tracks.every((t) => !t.blockId)));
  it('garbage pastes nothing', check(pasteLayers(b, {} as never).length === 0));
}
