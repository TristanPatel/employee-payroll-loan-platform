#!/usr/bin/env node
// Build Richmond-branded PDFs of every Markdown file in docs/launch/ using
// Playwright's bundled Chromium (already in the monorepo for E2E). No
// extra heavyweight deps: marked for MD → HTML; Playwright for HTML → PDF.
//
// Output goes to docs/launch/dist/<name>.pdf. The dist/ dir is gitignored
// so each build is reproducible without polluting the repo with binaries.
//
// Run:  pnpm run build:docs
//   or: node scripts/build-docs.mjs

import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const docsDir  = join(repoRoot, 'docs', 'launch');
const distDir  = join(docsDir, 'dist');
const tmplDir  = join(docsDir, '_template');
const cssPath  = join(tmplDir, 'document.css');
const logoPath = join(repoRoot, 'apps', 'web', 'public', 'richmond-logo.png');

const DOCS = [
  { md: 'staff-introduction-email.md',
    title: 'Staff introductory email',
    subtitle: 'Richmond Finance Employee Payroll Loan Portal' },
  { md: 'staff-handbook-v1.md',
    title: 'Staff Handbook',
    subtitle: 'Richmond Finance Employee Payroll Loan Portal · Version 1.0' },
];

async function fileExists(p) { try { await stat(p); return true; } catch { return false; } }

async function buildOne({ md, title, subtitle }) {
  const mdPath = join(docsDir, md);
  if (!(await fileExists(mdPath))) {
    console.warn(`skip: ${md} not found`);
    return;
  }
  const mdSrc = await readFile(mdPath, 'utf8');
  const css   = await readFile(cssPath, 'utf8');
  const logoB64 = (await readFile(logoPath)).toString('base64');

  // Render Markdown → HTML.
  const bodyHtml = marked.parse(mdSrc, { mangle: false, headerIds: true });

  // Today's date in Lusaka.
  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Africa/Lusaka', day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} — Richmond Finance</title>
  <style>${css}</style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="band"></div>
      <img class="logo" src="data:image/png;base64,${logoB64}" alt="Richmond Finance"/>
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
    </div>
    <div class="meta">
      Confidential · Richmond Finance Limited · ${escapeHtml(today)}
    </div>
  </section>
  ${bodyHtml}
</body>
</html>`;

  await mkdir(distDir, { recursive: true });
  const htmlOut = join(distDir, basename(md, '.md') + '.html');
  await writeFile(htmlOut, html, 'utf8');
  console.log(`✓ ${basename(htmlOut)}`);

  // HTML is always produced. PDF requires Playwright's Chromium; if that
  // download is unavailable (offline / sandboxed), tell the user how to
  // unblock and continue with the next doc instead of failing the whole run.
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.warn(
      `  skip PDF for ${md} — Chromium not installed.\n` +
      `  Run \`pnpm exec playwright install chromium\` once, then re-run \`pnpm run build:docs\`.\n` +
      `  (${err.message.split('\n')[0]})`
    );
    return;
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfOut = join(distDir, basename(md, '.md') + '.pdf');
    await page.pdf({
      path: pdfOut,
      format: 'A4',
      printBackground: true,
      margin: { top: '22mm', right: '18mm', bottom: '22mm', left: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;padding:0 18mm;font-family:'Lato',Arial,sans-serif;font-size:8pt;color:#5b6770;display:flex;justify-content:space-between;">
          <span>Richmond Finance Limited · Confidential</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    });
    console.log(`✓ ${basename(pdfOut)}`);
  } finally {
    await browser.close();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

(async () => {
  if (!existsSync(cssPath)) {
    console.error(`Missing stylesheet: ${cssPath}`); process.exit(1);
  }
  if (!existsSync(logoPath)) {
    console.error(`Missing logo: ${logoPath}`); process.exit(1);
  }
  // Allow optional positional args to build only specific files.
  const wanted = process.argv.slice(2);
  const list = wanted.length
    ? DOCS.filter(d => wanted.some(w => d.md.includes(w)))
    : DOCS;
  for (const d of list) await buildOne(d);
})().catch(err => { console.error(err); process.exit(1); });
