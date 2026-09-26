/**
 * Puts the seven Sailors projects (packages/studio core/sailorsPresets.ts) into one account.
 *
 *   pnpm --filter @blooby/api seed:sailors <email> [--out <dir>] [--replace] [--only home,streak-broken]
 *
 * Each project is a timeline per state and a dotLottie state machine driven by one String
 * input, `state`. A project the account already has by that name is LEFT ALONE unless
 * `--replace` is given — the bucket keeps no versions, so an overwrite cannot be undone, and a
 * name like "home" may well be the person's own work. With `--replace` it is rewritten in place
 * (a new version, same id and link). `--out` also writes each project's `.lottie` there, every
 * state in one file. `--only` limits the run to the projects named.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAILORS_PROJECTS, buildDotLottie, packProject, sailorsProject } from '@blooby/studio/engine';
import { prisma } from '../src/config/prisma.js';
import { projectsService } from '../src/services/projects.service.js';
import { putProjectJson } from '../src/services/storage.service.js';

const args = process.argv.slice(2);
const email = args[0];
const replace = args.includes('--replace');
const outAt = args.indexOf('--out');
const outDir = outAt > 0 ? args[outAt + 1] : undefined;
const onlyAt = args.indexOf('--only');
const only = onlyAt > 0 ? new Set(args[onlyAt + 1]?.split(',')) : undefined;
if (!email || email.startsWith('--') || (outAt > 0 && !outDir) || (onlyAt > 0 && !only?.size)) {
  console.error('usage: seed-sailors <email> [--out <dir>] [--replace] [--only a,b]');
  process.exit(1);
}

const users = await prisma.$queryRaw<{ id: string }[]>`select id from auth.users where lower(email) = lower(${email}) limit 1`;
if (!users[0]) {
  console.error(`No account for ${email}.`);
  process.exit(1);
}
const userId = users[0].id;
if (outDir) mkdirSync(outDir, { recursive: true });

for (const spec of SAILORS_PROJECTS) {
  if (only && !only.has(spec.name)) continue;
  const project = sailorsProject(spec);
  // built-in presets go out as references, exactly as the editor's autosave writes them
  const stored = packProject(project);
  const existing = await prisma.project.findFirst({ where: { userId, name: spec.name }, orderBy: { createdAt: 'asc' } });
  let id: string;
  if (existing && !replace) {
    console.log(`skipped ${spec.name}: the account already has a project by that name (${existing.id}, v${existing.currentVersion}) — --replace overwrites it`);
    id = existing.id;
  } else if (existing) {
    const put = await putProjectJson(userId, existing.id, stored);
    await prisma.project.update({
      where: { id: existing.id },
      data: { s3Key: put.key, s3Bucket: put.bucket, sizeBytes: put.sizeBytes, checksum: put.checksum, currentVersion: { increment: 1 } },
    });
    id = existing.id;
  } else {
    id = (await projectsService.create(userId, { name: spec.name, project: stored as unknown as Record<string, unknown> })).id;
  }
  const states = project.timelines.map((t) => `${t.name} ${t.timelineDurationMs}ms`).join(', ');
  if (!existing || replace) console.log(`${existing ? 'replaced' : 'created'} ${spec.name} (${id}) — ${states}`);
  if (outDir) {
    const built = await buildDotLottie(project, { background: null });
    writeFileSync(join(outDir, `${spec.name}.lottie`), Buffer.from(await built.blob.arrayBuffer()));
  }
}
await prisma.$disconnect();
// the Redis clients (optional, and retrying if it is down) would keep the process alive
process.exit(0);
