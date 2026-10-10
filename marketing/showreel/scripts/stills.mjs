// Render individual frames without re-bundling per frame.
//   node scripts/stills.mjs <Vertical|Square|Wide> [frame ...]   → renders/stills/<Comp>-<frame>.png
// With no frames, renders the one-frame-per-beat contact frames from public/timeline.json.
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [comp = 'Vertical', ...args] = process.argv.slice(2);
const timeline = JSON.parse(readFileSync(path.join(ROOT, 'public/timeline.json'), 'utf8'));
const frames = args.length ? args.map(Number) : Object.values(timeline.contactFrames);
const outDir = path.join(ROOT, 'renders/stills');
mkdirSync(outDir, { recursive: true });

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.tsx') });
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable });
for (const frame of frames) {
  const output = path.join(outDir, `${comp}-${String(frame).padStart(3, '0')}.png`);
  await renderStill({ composition, serveUrl, frame, output, browserExecutable });
  console.log(output);
}
