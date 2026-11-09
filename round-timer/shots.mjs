// Look at the artwork without playing a timer.
//
// The sixteen surprise animals are deliberately hard to see: the only way to
// one in the app is to finish a run and be given it, and the collection hides
// the names of the ones you haven't found. That is right for an eight-year-old
// and wrong for anyone editing anBlobfish(). This renders any of them straight
// to a PNG.
//
//   node shots.mjs Fox Cat        render those animals, large
//   node shots.mjs                render all sixteen
//   node shots.mjs --grid         the whole collection sheet, at real tile size
//   node shots.mjs --compare Fox  this file vs git HEAD, side by side
//
//   --compare=REV   compare against some other revision (default HEAD)
//   --out-dir=DIR   where the PNGs go (default: the current directory)
//   --prefix=STR    prepended to each filename
//   --size=N        pixels per animal, for the large renders (default 512)
//
//   APP=/path/to/index.html      render a different copy of the app entirely
//   PLAYWRIGHT_CHROMIUM_PATH=…   browser binary, if the package and the
//                                pre-installed browser revision disagree
//
// Needs playwright: npm i -D playwright, or NODE_PATH=/path/to/global/node_modules.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Cannot find "playwright". Install it (npm i -D playwright) or set NODE_PATH.'); process.exit(2); }

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};
if (flag('help')) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).join('\n')); process.exit(0); }

const APP     = process.env.APP || join(HERE, 'index.html');
const OUT_DIR = resolve(String(flag('out-dir', process.cwd())));
const PREFIX  = flag('prefix', '') === true ? '' : String(flag('prefix', ''));
const SIZE    = Number(flag('size', 512)) || 512;
const COMPARE = flag('compare', false);
const names   = args.filter(a => !a.startsWith('--'));

const launchOpts = { headless: true, args: ['--no-sandbox'] };
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

// Locked tiles hide their names on purpose, so the roster comes from the
// source's own ANIMALS table rather than from the DOM.
const roster = (appPath) =>
  [...readFileSync(appPath, 'utf8').matchAll(/\{name:'([^']+)',\s*fn:an/g)].map(m => m[1]);

const slug = n => n.toLowerCase().replace(/[^a-z0-9]/g, '');
const writePng = (file, dataUrl) => {
  writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  console.log(file);
};

// A page with every animal already unlocked, so the collection will open any
// of them.
async function unlockedPage(browser, appPath, opts = {}) {
  const page = await browser.newPage(opts);
  await page.goto('file://' + appPath);
  await page.evaluate(ns => {
    localStorage.setItem('revealTimer.animals.v1', JSON.stringify({ found: ns }));
  }, roster(appPath));
  await page.reload();
  return page;
}

// openZoom() draws at zoomCanvas.width, so widening the element first gets a
// genuine high-resolution drawing rather than a 250px one scaled up.
async function renderAnimals(browser, appPath, want, size) {
  const page = await unlockedPage(browser, appPath);
  const out = new Map();
  for (const name of want) {
    const dataUrl = await page.evaluate(({ name, size }) => {
      const zoom = document.getElementById('zoomCanvas');
      zoom.width = zoom.height = size;
      document.getElementById('collectionBtn').click();
      const item = [...document.querySelectorAll('.collection-item')]
        .find(i => i.querySelector('span').textContent === name);
      if (!item) return null;
      item.click();
      // The app shows these through a circular window (CSS border-radius on the
      // canvas), so mask the corners off rather than handing back a square the
      // kids never see.
      const zctx = zoom.getContext('2d');
      zctx.globalCompositeOperation = 'destination-in';
      zctx.beginPath(); zctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); zctx.fill();
      zctx.globalCompositeOperation = 'source-over';
      const url = zoom.toDataURL('image/png');
      document.getElementById('zoomBack').click();
      document.getElementById('collectionClose').click();
      return url;
    }, { name, size });
    if (!dataUrl) console.error(`no such animal: ${name}`);
    else out.set(name, dataUrl);
  }
  await page.close();
  return out;
}

const browser = await chromium.launch(launchOpts);

if (flag('grid')) {
  // Real tile size, magnified for looking at: 62px is where these drawings are
  // smallest, and small is where a redrawn one tends to fall apart.
  const page = await unlockedPage(browser, APP, { deviceScaleFactor: 3 });
  await page.evaluate(() => document.getElementById('collectionBtn').click());
  const file = join(OUT_DIR, PREFIX + 'collection.png');
  await page.locator('#collectionGrid').screenshot({ path: file });
  console.log(file);
  await page.close();
} else if (COMPARE) {
  const rev = COMPARE === true ? 'HEAD' : COMPARE;
  let oldApp;
  try {
    const rel = 'round-timer/index.html';
    const src = execFileSync('git', ['show', `${rev}:${rel}`], { cwd: HERE, maxBuffer: 1 << 26 });
    oldApp = join(mkdtempSync(join(tmpdir(), 'shots-')), 'index.html');
    writeFileSync(oldApp, src);
  } catch (e) {
    console.error(`cannot read ${rev}:round-timer/index.html from git — ${e.message.trim().split('\n')[0]}`);
    await browser.close();
    process.exit(2);
  }
  const want = names.length ? names : roster(APP);
  const [before, after] = await Promise.all([
    renderAnimals(browser, oldApp, want, SIZE),
    renderAnimals(browser, APP, want, SIZE),
  ]);
  // Compose each pair in a throwaway page; nothing here needs an image library.
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const name of want) {
    if (!before.has(name) || !after.has(name)) continue;
    await page.setViewportSize({ width: SIZE * 2 + 36, height: SIZE + 52 });
    await page.setContent(`<body style="margin:0;background:#0f172a;font:600 15px system-ui,sans-serif;color:#cbd5e1">
      <div style="display:flex;gap:12px;padding:12px">
        <figure style="margin:0"><img src="${before.get(name)}" width="${SIZE}">
          <figcaption style="padding-top:8px;text-align:center">${rev}</figcaption></figure>
        <figure style="margin:0"><img src="${after.get(name)}" width="${SIZE}">
          <figcaption style="padding-top:8px;text-align:center">working tree</figcaption></figure>
      </div></body>`);
    const file = join(OUT_DIR, `${PREFIX}${slug(name)}-compare.png`);
    await page.locator('body > div').screenshot({ path: file });
    console.log(file);
  }
  await page.close();
} else {
  const rendered = await renderAnimals(browser, APP, names.length ? names : roster(APP), SIZE);
  for (const [name, dataUrl] of rendered) writePng(join(OUT_DIR, PREFIX + slug(name) + '.png'), dataUrl);
}

await browser.close();
