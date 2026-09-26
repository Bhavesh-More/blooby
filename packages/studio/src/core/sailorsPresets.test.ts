import { it } from 'vitest';
import { check } from './testkit';
import { SAILORS_PROJECTS, sailorsPresets, sailorsProject, sample, spline } from './sailorsPresets';
import { builtinPresets } from './defaults';
import { validateMachine } from './stateMachine';
import { asTimeline } from './types';
import { bakeLottie } from '../export/lottie';
import type { Keyframe, Preset } from './types';

const lib = sailorsPresets();
const all = builtinPresets();

it('every state is in the library', check(lib.length === 18 && lib.every((p) => all.some((x) => x.id === p.id)), lib.map((p) => p.id).join()));

// the sampler: a key where the curve needs one, and the curve between keys is the curve
{
  const f = spline([[0, 0], [400, 10], [900, -4], [1500, 0]], 1500);
  const keys = sample(f, 1500, 'flatOffset.x');
  it('a smooth loop samples to a handful of keys', check(keys.length > 2 && keys.length < 20, String(keys.length)));
  it('with no linear segments', check(keys.every((k) => k.easingOut.type !== 'linear')));
  it('and a constant to one key', check(sample(() => 3, 1000, 'opacity').length === 1));
}

// a loop has no seam: every character track ends on the value it starts with, moving the same way
const CHARACTER = /^(body|face|eyeL|eyeR|armL|armR|legL|legR|frontArm[LR]|arc[LR]|mitten[LR])$/;
const slope = (ks: Keyframe[], end: boolean) => {
  const [a, b] = end ? [ks.at(-2)!, ks.at(-1)!] : [ks[0], ks[1]];
  const dv = (b.value as number) - (a.value as number), dt = b.time - a.time;
  const e = a.easingOut;
  if (e.type !== 'bezier' || Math.abs(dv) < 1e-6) return 0;
  return end ? ((1 - e.p2.y) * 3 * dv) / dt : (e.p1.y * 3 * dv) / dt;
};
const seams = (p: Preset) => p.tracks.filter((t) => CHARACTER.test(t.nodeId) && t.keyframes.length > 1 && typeof t.keyframes[0].value === 'number').filter((t) => {
  const ks = t.keyframes;
  return Math.abs((ks[0].value as number) - (ks.at(-1)!.value as number)) > 1e-3 || Math.abs(slope(ks, false) - slope(ks, true)) > 0.02;
}).map((t) => `${p.name}.${t.nodeId}.${t.property}`);
it('every state loops with no seam', check(lib.every((p) => seams(p).length === 0), lib.flatMap(seams).join(', ')));
it('every loop is 2–4 s (4.2 for reading, which turns a page)', check(lib.every((p) => p.durationMs >= 2000 && p.durationMs <= 4200), lib.map((p) => `${p.name} ${p.durationMs}`).join()));

// the base character's limbs, and legs with no knee
const limbs = lib.flatMap((p) => (p.layers ?? []).filter((l) => l.limb));
it('no leg has a knee', check(limbs.filter((l) => l.limb!.type === 'leg').every((l) => !l.limb!.c)
  && lib.every((p) => !p.tracks.some((t) => /^limb\.c\./.test(t.property)))));
it('arms are the base arms: ink, 39 thick', check(limbs.filter((l) => l.limb!.type === 'arm').every((l) => l.limb!.thickness === 39 && l.color.r === 20)));
it('legs are the base legs: ink, 38 thick, a 35-wide foot', check(limbs.filter((l) => l.limb!.type === 'leg').every((l) => l.limb!.thickness === 38 && l.limb!.foot?.width === 35)));

// the projects: a timeline per state, named as the app asks, and a machine driven by `state`
for (const spec of SAILORS_PROJECTS) {
  const p = sailorsProject(spec);
  const m = p.stateMachine!;
  const names = p.timelines.map((t) => t.name);
  it(`${spec.name}: its timelines are the states the app asks for`, check(names.join() === spec.states.map((s) => s[0]).join(), names.join()));
  it(`${spec.name}: its machine is named after it, with one String input "state"`, check(m.id === spec.name && m.inputs.length === 1 && m.inputs[0].name === 'state' && m.inputs[0].type === 'String'));
  it(`${spec.name}: every state is reached by its own name`, check(p.timelines.every((tl) => m.transitions.some((tr) => tr.to === tl.id && tr.conditions[0]?.value === tl.name))));
  const errors = validateMachine(p).filter((i) => i.level === 'error');
  it(`${spec.name}: the machine validates`, check(errors.length === 0, errors.map((e) => e.message).join('; ')));
  it(`${spec.name}: at ${spec.composition.width}×${spec.composition.height}, 60 fps`, check(p.composition!.width === spec.composition.width && p.fps === 60));
  // app-ready: everything it draws goes into the .lottie
  const lost = p.timelines.flatMap((tl) => {
    const baked = bakeLottie(asTimeline(p, tl.id), { background: null, name: tl.name });
    return [...baked.warnings, ...baked.skipped].map((w) => `${tl.name}: ${w}`);
  });
  it(`${spec.name}: every state exports to Lottie with nothing lost`, check(lost.length === 0, lost.join('\n')));
}
