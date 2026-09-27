import { it } from 'vitest';
import { check, near } from './testkit';
import { defaultProject } from './defaults';
import { valueAt } from './scene';
import { makeCurveLayer, makeGroup, makeLimb, makeShapeLayer, makeTextLayer } from './layers';
import { useEditor } from './store';
import { activeTimeline, type KeyValue } from './types';

// Copy and paste the way a person does it: layers made and keyed in the editor — in a project
// with clips on the strip, so keys land inside them — then pasted into another project.
const ed = () => useEditor.getState();
const same = (a: KeyValue | undefined, b: KeyValue | undefined) =>
  typeof a === 'number' && typeof b === 'number' ? near(a, b, 0.01) : JSON.stringify(a) === JSON.stringify(b);

ed().loadProject(defaultProject());
useEditor.setState({ autoKey: true });
it('the source project has clips under the playhead, so keys are sealed into them', check(activeTimeline(ed().project).blocks.length > 1));

const curve = makeCurveLayer([{ x: -80, y: 0 }, { x: 0, y: -60 }, { x: 80, y: 0 }], { name: 'Swoosh' })!;
const star = makeShapeLayer('star', { name: 'Star' });
const words = makeTextLayer('Hello', { name: 'Words' });
const group = makeGroup(null, { name: 'Pack' });
const inside = makeShapeLayer('blob', { name: 'Inside', parentId: group.id });
const arm = makeLimb('arm', 1, 'body', { name: 'Extra arm' });
ed().addLayer([curve, star, words, group, inside, arm]);

/** [layer, property, value at 300ms, value at 1500ms] */
const keyed: [string, string, KeyValue, KeyValue][] = [
  [curve.id, 'trim.end', 0.2, 1], [curve.id, 'stroke.width', 3, 12], [curve.id, 'transform.rotation', 0, 45],
  [star.id, 'color', { r: 255, g: 0, b: 0, a: 1 }, { r: 0, g: 0, b: 255, a: 1 }], [star.id, 'transform.scale.x', 1, 2],
  [words.id, 'text.size', 30, 80], [inside.id, 'transform.rotation', 10, 90], [arm.id, 'limb.bend', 0, 1],
];
for (const [id, prop, a, b] of keyed) {
  ed().setPlayhead(300); ed().setValue(id, prop, a);
  ed().setPlayhead(1500); ed().setValue(id, prop, b);
}
ed().addModifier({ nodeId: star.id, kind: 'shake', amount: 100, frequency: 2, amplitude: 10 });
const mod = activeTimeline(ed().project).modifiers.find((m) => m.nodeId === star.id)!;
ed().setPlayhead(300); ed().setValue(mod.id, 'fx.amount', 50);
ed().setPlayhead(1500); ed().setValue(mod.id, 'fx.amount', 150);

const src = ed().project;
const before = (id: string, prop: string, t: number) => valueAt(src, id, prop, t);
it('the keys went into the clips', check(activeTimeline(src).tracks.filter((t) => t.nodeId === curve.id).every((t) => !!t.blockId)));

ed().select([curve.id, star.id, words.id, group.id, arm.id]);
const text = ed().copyLayers();

ed().loadProject(defaultProject());
ed().select(['body']);
const made = ed().pasteLayers(text);
const dst = ed().project;
const byName = (name: string) => Object.values(dst.rig.nodes).find((n) => n.name === name)!;
it('every layer arrives — a curve, a shape, text, a group with its child, a limb', check(made.length === 5
  && ['Swoosh', 'Star', 'Words', 'Pack', 'Inside', 'Extra arm'].every((n) => !!byName(n)), made.join()));
it('with its own properties — the curve keeps its outline and points', check(JSON.stringify(byName('Swoosh').curve) === JSON.stringify(src.rig.nodes[curve.id].curve)
  && byName('Swoosh').shapePath === src.rig.nodes[curve.id].shapePath));
it('the child stays in its group, the limb on the mascot', check(byName('Inside').parentId === byName('Pack').id && byName('Extra arm').parentId === 'body'));
for (const [id, prop] of keyed) {
  const name = src.rig.nodes[id].name, now = byName(name).id;
  for (const t of [300, 900, 1500]) {
    it(`${name} ${prop} plays the same at ${t}ms`, check(same(valueAt(dst, now, prop, t), before(id, prop, t)), `${JSON.stringify(valueAt(dst, now, prop, t))} vs ${JSON.stringify(before(id, prop, t))}`));
  }
}
const mod2 = activeTimeline(dst).modifiers.find((m) => m.nodeId === byName('Star').id);
it('an effect comes with the layer, and its keys with it', check(!!mod2 && [300, 1500].every((t) => same(valueAt(dst, mod2.id, 'fx.amount', t), before(mod.id, 'fx.amount', t)) && typeof before(mod.id, 'fx.amount', t) === 'number'),
  JSON.stringify(mod2 && [valueAt(dst, mod2.id, 'fx.amount', 300), valueAt(dst, mod2.id, 'fx.amount', 1500), before(mod.id, 'fx.amount', 1500)])));
