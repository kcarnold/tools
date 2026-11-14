// Headless-Chromium checks for the Reveal Timer app.
//
//   npm i -D playwright   (or: NODE_PATH=/path/to/global/node_modules)
//   node test.mjs
//
// Covers: all preset artworks render (no blank/broken canvases), background
// swatches toggle light/dark text contrast correctly, and the timer reaches
// its "done" state with a visibly-drawn celebration animation across several
// completions (each completion picks one of the animations at random).
//
// Plus the categories: one surprise tile per category (and "Anything"), each
// dealing only from its own category; everything in every category draws;
// and saves from before categories existed still load.
//
// Plus, once the collection is complete: the surprise deals from a shuffled
// deck rather than rolling a die, and the mask that hides the picture is one of
// four patterns, each of which still covers the fraction of the picture that
// matches the time left.
//
// Plus the refinements: settings survive a reload, the preset strip wraps
// instead of scrolling sideways, the two swatch rows hold visibly distinct
// colours, the countdown's digits don't change width, press-and-hold can't
// start a text selection, a single chime plays on start (a longer one on
// finish), and the celebration ink flips to stay legible on a light artwork.
//
// Sections run in parallel across several Chromium pages (each browser.newPage()
// is its own context, so localStorage never leaks between them) and each one
// buffers its output, so the report reads exactly as if they had run in order.
// Set TEST_CONCURRENCY to change how many run at once; 1 makes it sequential
// again, which is the thing to try first if a check ever looks flaky.
//
// If the sandbox's Playwright package doesn't match its pre-installed
// browser revision, point PLAYWRIGHT_CHROMIUM_PATH at the browser binary:
//   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-XXXX/chrome-linux/chrome node test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Cannot find "playwright". Install it (npm i -D playwright) or set NODE_PATH.'); process.exit(2); }

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = 'file://' + join(HERE, 'index.html');
const launchOpts = { headless: true, args: ['--no-sandbox'] };
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const CONCURRENCY = Math.max(1, Number(process.env.TEST_CONCURRENCY) || 6);

// ---------------------------------------------------------------------------
// Sections: declared here, run by a small worker pool, printed in declaration
// order. A section gets its own `t` to record checks on, so two sections
// finishing at the same moment can't interleave their lines.
// ---------------------------------------------------------------------------
let failures = 0;
class Checks {
  constructor(name) { this.name = name; this.lines = []; }
  ok(cond, msg) { this.lines.push((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; }
  eq(a, b, msg) { this.ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }
}
const SECTIONS = [];
// `slow: true` starts a section ahead of the queue. It only affects scheduling,
// never the printed order — the long poles want a head start or they end up
// being the last thing everyone waits on.
const section = (name, fn, opts = {}) => SECTIONS.push({ name, fn, slow: !!opts.slow });

// ---------------------------------------------------------------------------
// Page setup shared by every section.
// ---------------------------------------------------------------------------

// The shortest duration the dropdown offers is 30 seconds, and running the fake
// clock through 30s of requestAnimationFrame is ~1800 redraws of the artwork —
// by far the dominant cost of this suite, and enough of a memory load to kill
// the renderer if you complete twenty timers on one page. The app reads
// durationSelect.value directly, so appending a 1-second option drives exactly
// the same code path in a thirtieth of the frames. Anything asserting on the
// dropdown's own contents (section 4) still uses the real options.
const RUN_S = 1;
const shortDuration = page => page.evaluate((s) => {
  const sel = document.getElementById('durationSelect');
  const opt = document.createElement('option');
  opt.value = String(s); opt.textContent = s + 's';
  sel.appendChild(opt); sel.value = String(s);
}, RUN_S);
// Comfortably past the duration, so the last tick lands on onDone().
const finish = page => page.clock.runFor(RUN_S * 1000 + 100);

// The countdown and the celebration both redraw the whole artwork on every
// animation frame, and at 60fps a one-second run is 60 redraws — 280ms of
// headless software rasterising, repeated for every run in the suite. Nothing
// here asserts on frame rate: the checks look at what is on the canvas at a
// given instant, and the app's own clock is Date.now(), not a frame count. So
// each page gets a requestAnimationFrame that ticks 20 times a second instead
// of 60, which is still smooth enough to sample an animation and cuts the
// redraws — the suite's single biggest cost — by two thirds.
const RAF_STEP_MS = 50;
const throttleFrames = (step) => {
  window.requestAnimationFrame = function (cb) {
    return setTimeout(function () { cb(Date.now()); }, step);
  };
  window.cancelAnimationFrame = function (id) { clearTimeout(id); };
};

let browser;
// clock: install the fake clock (needed by anything that runs a timer).
// init:  extra init scripts, applied before the frame throttle.
async function openPage({ clock = false, init = [], viewport } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.errors = errors;
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
  if (viewport) await page.setViewportSize(viewport);
  for (const [fn, arg] of init) await page.addInitScript(fn, arg);
  // page.clock.install() installs its own requestAnimationFrame, so the
  // throttle has to be registered after it to be the one that survives.
  if (clock) await page.clock.install({ time: 0 });
  await page.addInitScript(throttleFrames, RAF_STEP_MS);
  await page.goto(INDEX);
  return page;
}

// The two blocks of in-page scratch code that more than one section needs.
const BLOCK_LOCALSTORAGE = () => {
  Object.defineProperty(window, 'localStorage', {
    get() { throw new Error('SecurityError: localStorage is disabled'); },
  });
};
// Variance of pixel luminance: near zero means nothing was drawn.
const CANVAS_VARIANCE = (id) => {
  const c = document.getElementById(id);
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0, sumSq = 0, n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += lum; sumSq += lum * lum;
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
};

// The setup screen's tiles, in order: one surprise per category, "Anything" first.
const TILE = { any: 0, animal: 1, food: 2, word: 3, pattern: 4 };
const TILE_LABELS = ['Anything!', 'An animal', 'Food', 'A word', 'A pattern'];

// Pick a surprise tile (the animal one unless told otherwise), shorten the run,
// silence the chime — the opening move of most of the animal sections.
const armSurprise = async (page, tile = TILE.animal) => {
  await page.locator('.art-thumb-wrap').nth(tile).click();
  await shortDuration(page);
  await page.evaluate(() => { document.getElementById('soundToggle').checked = false; });
};

// Put one specific thing on the setup screen. Patterns are no longer tiles of
// their own — like everything else they're found first and then picked from
// the collection — so this marks it found, reloads, and picks it there.
const pickFound = async (page, name) => {
  await page.evaluate(n => {
    const k = 'revealTimer.animals.v1';
    const v = JSON.parse(window.localStorage.getItem(k) || '{}');
    v.found = (v.found || []).concat([n]);
    window.localStorage.setItem(k, JSON.stringify(v));
  }, name);
  await page.reload();
  await page.evaluate(n => {
    document.getElementById('collectionBtn').click();
    [...document.querySelectorAll('.collection-item.found')]
      .find(i => i.querySelector('span').textContent === n).click();
    document.getElementById('zoomSelect').click();
  }, name);
};

// A 2x2 PNG, for the upload checks.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');

// ---- 1. every surprise tile actually draws something (thumbnails) ----
section('surprise tiles', async (t) => {
  const page = await openPage();
  const thumbs = await page.evaluate(() => {
    const wraps = document.querySelectorAll('.art-thumb-wrap');
    return [...wraps].map(w => {
      const c = w.querySelector('canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, sumSq = 0, n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        sum += lum; sumSq += lum * lum;
      }
      const mean = sum / n;
      return { name: w.querySelector('span').textContent, variance: sumSq / n - mean * mean };
    });
  });
  t.eq(JSON.stringify(thumbs.map(x => x.name)), JSON.stringify(TILE_LABELS), 'one surprise tile per category, "Anything" first');
  const blank = thumbs.filter(t2 => t2.variance < 50);
  t.ok(blank.length === 0, blank.length ? `tiles with near-blank thumbnails: ${blank.map(b => b.name).join(', ')}` : 'no tile rendered blank/broken');
  t.eq(new Set(thumbs.map(x => Math.round(x.variance))).size, thumbs.length, 'the tiles all look different');
  t.ok(page.errors.length === 0, `no page errors while building thumbnails${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
});

// ---- 2. light background swatches flip text contrast ----
section('background swatches', async (t) => {
  const page = await openPage();
  const darkSwatch = await page.evaluate(() => {
    document.body.style.transition = 'none'; // skip the 0.25s fade for this check
    return getComputedStyle(document.body).color;
  });
  await page.locator('.bg-swatch[data-light="1"]').first().click();
  const after = await page.evaluate(() => ({
    bodyClass: document.body.className,
    bg: getComputedStyle(document.body).backgroundColor,
    fg: getComputedStyle(document.body).color,
  }));
  t.eq(after.bodyClass, 'light-bg', 'body gets light-bg class when a light swatch is selected');
  t.ok(after.fg !== darkSwatch, `text color flips for contrast on light background (was ${darkSwatch}, now ${after.fg})`);
  await page.close();
});

// ---- 3. timer completion + celebration animation ----
section('timer completion + celebration animation', async (t) => {
  const trial = async (n) => {
    const page = await openPage({ clock: true });
    await page.locator('.art-thumb-wrap').nth(n % TILE_LABELS.length).click();
    await shortDuration(page);
    await page.evaluate(() => { document.getElementById('soundToggle').checked = false; });
    await page.locator('#startBtn').click();
    await finish(page);
    await page.waitForTimeout(30);
    const doneClass = await page.locator('#timeDisplay').getAttribute('class');
    await page.clock.runFor(1200); // partway through the 5s celebration
    await page.waitForTimeout(30);
    const variance = await page.evaluate(CANVAS_VARIANCE, 'canvas');
    const errors = page.errors.slice();
    await page.close();
    return { doneClass, variance, errors };
  };
  const results = await Promise.all([0, 1, 2, 3, 4, 5].map(trial));
  const seen = new Set();
  results.forEach((r, n) => {
    t.ok(r.doneClass === 'time-display done', `trial ${n}: reaches done state`);
    t.ok(r.variance > 50, `trial ${n}: celebration animation is visibly drawing (variance ${r.variance.toFixed(0)})`);
    t.ok(r.errors.length === 0, `trial ${n}: no page errors${r.errors.length ? ': ' + r.errors.join(' | ') : ''}`);
    seen.add(Math.round(r.variance));
  });
  t.ok(seen.size > 1, `celebration animation varies across completions (${seen.size} distinct variance samples across 6 trials)`);
}, { slow: true });

// ---- 4. settings survive a reload ----
section('saved settings', async (t) => {
  const page = await openPage();
  const artName = await page.evaluate(() =>
    document.querySelectorAll('.art-thumb-wrap')[2].querySelector('span').textContent);
  await page.locator('.art-thumb-wrap').nth(2).click();
  await page.locator('.bg-swatch[data-light="1"]').nth(3).click();
  await page.selectOption('#durationSelect', '600');
  await page.locator('label[for="soundToggle"]').click(); // the checkbox itself is visually hidden
  const savedBg = await page.evaluate(() =>
    document.querySelector('.bg-swatch.selected').getAttribute('data-bg'));

  await page.reload();
  const after = await page.evaluate(() => ({
    art: (document.querySelector('.art-thumb-wrap.selected') || {}).textContent,
    bg: (document.querySelector('.bg-swatch.selected') || {}).getAttribute?.('data-bg'),
    bodyClass: document.body.className,
    duration: document.getElementById('durationSelect').value,
    sound: document.getElementById('soundToggle').checked,
    startEnabled: !document.getElementById('startBtn').disabled,
    canvasHasArt: (() => {
      const c = document.getElementById('previewCanvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    })(),
  }));
  t.eq(after.art, artName, 'the same preset comes back selected');
  t.eq(after.bg, savedBg, 'the same background comes back selected');
  t.eq(after.bodyClass, 'light-bg', 'a restored light background re-applies light-bg');
  t.eq(after.duration, '600', 'duration is restored');
  t.eq(after.sound, false, 'sound toggle is restored');
  t.ok(after.startEnabled, 'restored preset leaves Start enabled');
  t.ok(after.canvasHasArt, 'restored preset is re-rendered into the preview');
  await page.close();

  // A blocked/throwing localStorage (Safari private mode) must not break the app.
  const blocked = await openPage({ init: [[BLOCK_LOCALSTORAGE]] });
  await blocked.locator('.art-thumb-wrap').nth(1).click();
  const enabled = await blocked.evaluate(() => !document.getElementById('startBtn').disabled);
  t.ok(enabled && blocked.errors.length === 0,
    `app still works when localStorage throws${blocked.errors.length ? ': ' + blocked.errors.join(' | ') : ''}`);
  await blocked.close();
});

// ---- 5. the surprise tiles fit one row; nothing scrolls sideways ----
section('layout', async (t) => {
  const page = await openPage({ viewport: { width: 390, height: 844 } }); // iPhone-ish
  const layout = await page.evaluate(() => {
    const row = document.getElementById('artRow');
    const tops = [...row.children].map(c => c.offsetTop);
    return {
      rows: new Set(tops).size,
      overflowsSideways: row.scrollWidth > row.clientWidth + 1,
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      swatchRows: document.querySelectorAll('.bg-row').length,
      perRow: [...document.querySelectorAll('.bg-row')].map(r => r.querySelectorAll('.bg-swatch').length),
    };
  });
  t.eq(layout.rows, 1, 'all five surprise tiles fit in one row on a phone');
  t.ok(!layout.overflowsSideways, 'the tile strip has no sideways scroll');
  t.ok(!layout.pageOverflows, 'page has no horizontal scroll');
  t.eq(layout.swatchRows, 2, 'backgrounds are split into two rows');
  t.eq(JSON.stringify(layout.perRow), JSON.stringify([6, 6]), 'six swatches in each row');
  await page.close();
});

// ---- 5b. everything you need is on screen on a phone, either way up ----
// iPhone 15: Safari's visible area is ~393x659 upright and ~852x323 on its
// side. Upright, Start used to sit ~200px below the fold; on its side the
// countdown and half the picture were off-screen while the timer ran.
section('fits a phone screen', async (t) => {
  const inView = (id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5;
  };
  for (const [label, viewport] of [['upright', { width: 393, height: 659 }], ['on its side', { width: 852, height: 323 }]]) {
    const page = await openPage({ viewport });
    t.ok(await page.evaluate(inView, 'startBtn'), `${label}: Start is on screen without scrolling`);
    await page.locator('.art-thumb-wrap').nth(1).click();
    await page.locator('#startBtn').click();
    const seen = await page.evaluate((ids) => ids.map(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return [id, r.top >= 0 && r.bottom <= innerHeight + 0.5];
    }), ['timeDisplay', 'canvas', 'pauseBtn', 'resetBtn']);
    const off = seen.filter(([, ok]) => !ok).map(([id]) => id);
    t.ok(off.length === 0, `${label}: countdown, picture and buttons all on screen${off.length ? ' (off: ' + off.join(', ') + ')' : ''}`);
    t.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), `${label}: the running timer doesn't scroll`);
    await page.close();
  }
});

// ---- 6. swatch colours are actually distinguishable ----
section('background palette', async (t) => {
  const page = await openPage();
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.bg-row')].map(r =>
      [...r.querySelectorAll('.bg-swatch')].map(s => ({
        bg: s.getAttribute('data-bg'),
        mask: s.getAttribute('data-mask'),
        light: s.getAttribute('data-light') === '1',
      }))));
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

  for (const [ri, row] of rows.entries()) {
    let min = Infinity, pair = '';
    for (let i = 0; i < row.length; i++) {
      for (let j = i + 1; j < row.length; j++) {
        const d = dist(row[i].bg, row[j].bg);
        if (d < min) { min = d; pair = `${row[i].bg}/${row[j].bg}`; }
      }
    }
    t.ok(min >= 40, `row ${ri}: closest pair is still distinguishable (${pair}, distance ${min.toFixed(0)})`);
  }
  t.ok(rows[0].every(s => !s.light), 'first row is the dark set');
  t.ok(rows[1].every(s => s.light), 'second row is the light set');
  t.ok(rows[1].some(s => s.bg === '#e0f2fe'), 'the light blue is left exactly as it was');
  const badMask = rows.flat().find(s => s.mask !== rgb(s.bg).join(','));
  t.ok(!badMask, badMask ? `mask colour disagrees with swatch for ${badMask.bg}` : 'every mask colour matches its swatch');
  await page.close();
});

// ---- 7. countdown digits keep a fixed width ----
section('time display', async (t) => {
  const page = await openPage();
  const widths = await page.evaluate(() => {
    const el = document.getElementById('timeDisplay');
    el.parentElement.className = 'timer-view active';
    const out = {};
    for (const s of ['00:00', '11:11', '88:88', '10:59']) {
      el.textContent = s;
      out[s] = el.getBoundingClientRect().width;
    }
    return out;
  });
  const vals = Object.values(widths);
  const spread = Math.max(...vals) - Math.min(...vals);
  t.ok(spread < 0.5, `all-digit strings render at one fixed width (spread ${spread.toFixed(2)}px: ${JSON.stringify(widths)})`);
  await page.close();
});

// ---- 8. press-and-hold can't start a text selection ----
section('touch handling', async (t) => {
  const page = await openPage();
  const sel = await page.evaluate(() => {
    const pick = q => {
      const el = document.querySelector(q);
      const cs = getComputedStyle(el);
      return cs.webkitUserSelect || cs.userSelect;
    };
    return {
      start: pick('#startBtn'), pause: pick('#pauseBtn'), reset: pick('#resetBtn'),
      swatch: pick('.bg-swatch'), thumb: pick('.art-thumb-wrap'), upload: pick('.upload-btn'),
      select: pick('#durationSelect'),
    };
  });
  for (const [name, v] of Object.entries(sel)) {
    if (name === 'select') continue;
    t.eq(v, 'none', `${name} is not text-selectable on press-and-hold`);
  }
  t.ok(sel.select === 'text' || sel.select === 'auto', `form fields stay selectable (got ${sel.select})`);
  await page.close();
});

// ---- 9. one chime on start, a longer one on finish ----
section('chimes', async (t) => {
  const fakeAudio = () => {
    window.__notes = [];
    const param = () => ({
      setValueAtTime() { return this; },
      linearRampToValueAtTime() { return this; },
      exponentialRampToValueAtTime() { return this; },
    });
    window.AudioContext = window.webkitAudioContext = function () {
      this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100;
      this.destination = {};
      this.resume = function () {};
      this.createOscillator = function () {
        return { type: '', frequency: { value: 0 }, connect() {}, stop() {},
                 start(t) { window.__notes.push(t); } };
      };
      this.createGain = function () { return { gain: param(), connect() {} }; };
      this.createBuffer = function () { return {}; };
      this.createBufferSource = function () { return { buffer: null, connect() {}, start() {} }; };
    };
  };
  const page = await openPage({ clock: true, init: [[fakeAudio]] });
  await page.locator('.art-thumb-wrap').first().click();
  await shortDuration(page);
  await page.locator('#startBtn').click();
  const onStart = await page.evaluate(() => window.__notes.slice());
  t.eq(onStart.length, 4, 'starting the timer plays the chime exactly once (4 notes)');

  await finish(page);
  await page.waitForTimeout(30);
  const all = await page.evaluate(() => window.__notes.slice());
  const done = all.slice(4);
  t.ok(done.length >= 16, `finish chime repeats more than it used to (${done.length} notes, was 12)`);
  const span = Math.max(...done) - Math.min(...done);
  t.ok(span > 5, `finish chime keeps ringing for a while (${span.toFixed(1)}s of note onsets, was ~4.6s)`);
  await page.close();
});

// ---- 10. celebration stays legible on a light artwork ----
// Every effect should darken a pale artwork and brighten a dark one. Before the
// contrast fix, Sparkle and Pulse were plain white and did neither on a light
// image (0 darkened pixels — they were invisible).
//
// Ten independent (artwork x effect) pairs, one section each so the pool can
// spread them out; together they used to be more than half the suite's runtime.
{
  const CELEBS = ['Rings', 'Confetti', 'Sparkle', 'Fireworks', 'Pulse'];
  for (const [art, expect] of [['Terrazzo', 'darker'], ['Mandala', 'brighter']]) {
    for (let ci = 0; ci < CELEBS.length; ci++) {
      const effect = CELEBS[ci], pin = ci / CELEBS.length + 0.05;
      section(`celebration contrast: ${art} + ${effect}`, async (t) => {
        // Pin the random pick so each effect gets exercised.
        const page = await openPage({ clock: true, init: [[v => { Math.random = () => v; }, pin]] });
        await pickFound(page, art);
        await page.evaluate(() => { document.getElementById('soundToggle').checked = false; });
        await shortDuration(page);
        await page.locator('#startBtn').click();
        await finish(page);
        await page.waitForTimeout(20);
        await page.evaluate(() => { window.__snaps = []; });
        for (let s = 0; s < 6; s++) {
          await page.clock.runFor(1000);
          await page.waitForTimeout(20);
          await page.evaluate(() => {
            const c = document.getElementById('canvas');
            window.__snaps.push(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
          });
        }
        await page.clock.runFor(4000); // celebration over: canvas is the bare artwork again
        await page.waitForTimeout(30);
        const diff = await page.evaluate(() => {
          const c = document.getElementById('canvas');
          const base = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          let darker = 0, brighter = 0;
          for (const s of window.__snaps) {
            for (let i = 0; i < base.length; i += 4) {
              if (base[i + 3] < 128) continue;
              const d = lum(s, i) - lum(base, i);
              if (d < -20) darker++; else if (d > 20) brighter++;
            }
          }
          return { darker, brighter };
        });
        const [win, lose] = expect === 'darker'
          ? [diff.darker, diff.brighter] : [diff.brighter, diff.darker];
        t.ok(win > 1000 && win > lose * 2,
          `${art} + ${effect}: effect reads as ${expect} against the artwork (darker ${diff.darker}, brighter ${diff.brighter})`);
        await page.close();
      });
    }
  }
}

// ---- 11. surprise animals + the collection ----
//
// The contract the kids actually asked for: you don't know which animal is
// coming, you never get the same one twice until you've seen them all, and
// the ones you've found are kept. Each of those is a check below.
const ANIMAL_NAMES = [
  'Fox', 'Cat', 'Penguin', 'Owl', 'Panda', 'Frog', 'Sloth', 'Axolotl',
  'Narwhal', 'Blobfish', 'Platypus', 'Chameleon', 'Shark', 'T. rex',
  'Tiger', 'Snake', 'Sea Star', 'Crocodile',
  // OpenMoji: the monkey, then the animal-and-a-thing pictures the kids picked.
  'Monkey', 'Cool Monkey', 'Doughnut Sloth', 'Birthday Hamster', 'Ice-cream Croc',
  'Pizza Shark', 'Cocoa Owl', 'Rock-star Elephant', 'Fancy Hamster', 'King Koala',
  'Shady Rabbit', 'Bath-time Hedgehog',
];
const N = ANIMAL_NAMES.length;
const FOOD_NAMES = ['Pizza', 'Doughnut', 'Watermelon', 'Ice Cream', 'Strawberry', 'Cupcake',
  'Banana', 'Pancakes', 'Avocado', 'Fried Egg'];
const WORD_NAMES = ['Kaboom', 'Bonkers', 'Noodle', 'Zigzag', 'Squish', 'Wobble', 'Gizmo',
  'Lollygag', 'Skedaddle', 'Bamboozle', 'Kerfuffle', 'Hullabaloo'];
const PATTERN_NAMES = ['Mandala', 'Sunburst', 'Aurora', 'Mosaic', 'Spiral', 'Waves', 'Prism',
  'Ember', 'Forest', 'Neon', 'Nebula', 'Sunset', 'Terrazzo', 'Kaleidoscope'];
const ALL_NAMES = [...ANIMAL_NAMES, ...FOOD_NAMES, ...WORD_NAMES, ...PATTERN_NAMES];
const TOTAL = ALL_NAMES.length;

section('surprise animals', async (t) => {
  // Coarse pixel signature — enough to tell two drawings apart, small enough
  // to compare as a string.
  const SIG = (id) => {
    const c = document.getElementById(id);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let s = '';
    for (let i = 0; i < d.length; i += 4 * 401) s += ((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4).toString(16);
    return s;
  };
  const page = await openPage();

  const tile = await page.evaluate((i) => {
    const w = document.querySelectorAll('.art-thumb-wrap')[i];
    return { label: w.querySelector('span').textContent, cls: w.className };
  }, TILE.animal);
  t.eq(tile.label, 'An animal', 'there is an animal surprise tile');
  t.ok(/surprise/.test(tile.cls), 'the surprise tile is marked as such');

  // Nothing on screen before Start may depend on which animal is coming, so
  // the preview must be byte-identical every time it's picked. Reloading is
  // what re-rolls the pick, so each sample needs its own load.
  await page.locator('.art-thumb-wrap').nth(TILE.animal).click();
  const previewSigs = new Set();
  for (let i = 0; i < 6; i++) {
    await page.reload();
    await page.locator('.art-thumb-wrap').nth(TILE.animal).click();
    previewSigs.add(await page.evaluate(SIG, 'previewCanvas'));
  }
  t.eq(previewSigs.size, 1, 'the preview never varies, so it cannot leak the animal');
  await page.close();
});

// Sixteen runs back to back on one page — the suite's longest single stretch,
// and the reason the buttons here are clicked from inside the page rather than
// through a locator: a real mouse click costs ~30ms of actionability checks
// each time, and what is under test is which animal comes back, not hit
// testing. Sections 4 and 12 still click for real.
section('every animal turns up exactly once', async (t) => {
  const page = await openPage({ clock: true });
  await armSurprise(page);

  const runOnce = () => page.evaluate(() => {
    document.getElementById('startBtn').click();
  }).then(() => finish(page)).then(() => page.evaluate(() => {
    const el = document.getElementById('revealName');
    const out = {
      text: el.textContent,
      visible: /visible/.test(el.className),
      badge: !!el.querySelector('.new-badge'),
      sig: (() => {
        const c = document.getElementById('canvas');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let sum = 0, sq = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
          sum += l; sq += l * l; n++;
        }
        return sq / n - (sum / n) ** 2;
      })(),
    };
    document.getElementById('resetBtn').click();
    return out;
  }));

  // Every run should hand back an animal not yet seen, so the set of names
  // should be the whole set with no repeats.
  const revealed = [];
  for (let run = 0; run < ANIMAL_NAMES.length; run++) {
    const shown = await runOnce();
    if (run === 0) {
      t.ok(shown.visible, 'the animal name shows once the picture is revealed');
      t.ok(shown.badge, 'a first-time animal is flagged NEW');
      t.ok(shown.sig > 50, `the revealed animal actually draws (variance ${shown.sig.toFixed(0)})`);
    }
    revealed.push(shown.text.replace(/^NEW/, ''));
  }
  const unknown = revealed.filter(n => !ANIMAL_NAMES.includes(n));
  t.ok(unknown.length === 0, `every reveal is a known animal${unknown.length ? ': ' + unknown.join(', ') : ''}`);
  t.eq(new Set(revealed).size, ANIMAL_NAMES.length,
    `${N} runs give ${N} different animals — none repeats until the set is complete`);

  const full = await page.evaluate(() => {
    document.getElementById('collectionBtn').click();
    return {
      count: document.getElementById('collectionCount').textContent,
      sub: document.getElementById('collectionSub').textContent,
      found: document.querySelectorAll('.collection-item.found').length,
      tiles: document.querySelectorAll('.collection-item').length,
      heads: [...document.querySelectorAll('.collection-head')].map(h => h.textContent),
    };
  });
  t.eq(full.count, `${N} of ${TOTAL}`, 'the counter counts every animal');
  t.eq(full.tiles, TOTAL, 'the collection has a tile for everything, in every category');
  t.eq(full.found, N, 'every animal tile is unlocked once every animal is found');
  t.ok(full.heads.some(h => h.indexOf(`Animals · ${N} of ${N}`) === 0 && /⭐/.test(h)),
    `the Animals heading celebrates a complete set (got ${JSON.stringify(full.heads)})`);
  t.ok(page.errors.length === 0, `no page errors${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
}, { slow: true });

// The name must not appear before the reveal.
section('the animal stays secret until the end', async (t) => {
  const page = await openPage({ clock: true });
  await armSurprise(page);
  await page.locator('#startBtn').click();
  await page.clock.runFor(RUN_S * 500);
  const midRun = await page.evaluate(() =>
    /visible/.test(document.getElementById('revealName').className));
  t.ok(!midRun, 'the name stays hidden while the timer is still running');
  await finish(page);
  t.ok(page.errors.length === 0, `no page errors${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
});

// Past the end of the set the pool reopens, so the surprise keeps working
// rather than sticking on one animal forever. The full collection is seeded
// here rather than played for — that it can be played for is the section
// above's job.
section('a complete collection keeps giving animals', async (t) => {
  const page = await openPage({
    clock: true,
    init: [[names => {
      window.localStorage.setItem('revealTimer.animals.v1', JSON.stringify({ found: names }));
    }, ANIMAL_NAMES]],
  });
  await armSurprise(page);
  t.eq(await page.evaluate(() => document.getElementById('collectionCount').textContent),
    `${N} of ${TOTAL}`, 'the seeded animals are all counted');
  const afterFull = [];
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { document.getElementById('startBtn').click(); });
    await finish(page);
    afterFull.push(await page.evaluate(() => {
      const el = document.getElementById('revealName');
      const out = { text: el.textContent, badge: !!el.querySelector('.new-badge') };
      document.getElementById('resetBtn').click();
      return out;
    }));
  }
  t.ok(afterFull.every(r => ANIMAL_NAMES.includes(r.text)),
    'a complete collection still reveals animals instead of stalling');
  t.ok(afterFull.every(r => !r.badge), 'an animal you already have is not flagged NEW again');
  t.ok(page.errors.length === 0, `no page errors${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
});

// Everything has to survive being redrawn at tile size: the collection is
// where a drawing is smallest, and a blank or duplicated tile there is the
// failure mode a rework of one animal (the Fox, say) would produce.
section('everything draws at tile size', async (t) => {
  const page = await openPage({
    init: [[names => {
      window.localStorage.setItem('revealTimer.animals.v1', JSON.stringify({ found: names }));
    }, ALL_NAMES]],
  });
  const tiles = await page.evaluate(() => {
    document.getElementById('collectionBtn').click();
    return [...document.querySelectorAll('.collection-item')].map(item => {
      const c = item.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0, sq = 0, n = d.length / 4, sig = '';
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += l; sq += l * l;
        if (i % (4 * 29) === 0) sig += ((d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | d[i + 2] >> 5).toString(32);
      }
      return { name: item.querySelector('span').textContent, variance: sq / n - (sum / n) ** 2, sig };
    });
  });
  t.eq(JSON.stringify(tiles.map(x => x.name)), JSON.stringify(ALL_NAMES), 'everything has a tile, category by category');
  const faint = tiles.filter(x => x.variance < 50);
  t.ok(faint.length === 0, faint.length
    ? `things that barely draw at tile size: ${faint.map(x => `${x.name} (${x.variance.toFixed(0)})`).join(', ')}`
    : 'nothing renders blank or near-blank at tile size');
  t.eq(new Set(tiles.map(x => x.sig)).size, TOTAL,
    'no two things draw the same picture');
  t.ok(page.errors.length === 0, `no page errors${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
});

// Found animals are kept; unfound ones must not be drawn anywhere.
section('a found animal is kept', async (t) => {
  const page = await openPage({ clock: true });
  await armSurprise(page);
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  const won = await page.evaluate(() => document.getElementById('revealName').textContent.replace(/^NEW/, ''));

  await page.reload();
  const kept = await page.evaluate((name) => {
    document.getElementById('collectionBtn').click();
    const items = [...document.querySelectorAll('.collection-item')];
    const sig = (cv) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let s = '';
      for (let i = 0; i < d.length; i += 4 * 37) s += ((d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | d[i + 2] >> 5).toString(32);
      return s;
    };
    const lockedSigs = new Set(items.filter(i => !/found/.test(i.className)).map(i => sig(i.querySelector('canvas'))));
    const mine = items.find(i => i.querySelector('span').textContent === name);
    return {
      count: document.getElementById('collectionCount').textContent,
      foundCount: document.querySelectorAll('.collection-item.found').length,
      lockedLabels: new Set(items.filter(i => !/found/.test(i.className)).map(i => i.querySelector('span').textContent)).size,
      lockedVariants: lockedSigs.size,
      mineIsDrawn: !!mine && !lockedSigs.has(sig(mine.querySelector('canvas'))),
      mineOpens: (() => {
        if (!mine) return false;
        mine.click();
        return /open/.test(document.getElementById('zoomView').className)
          && document.getElementById('zoomName').textContent === name;
      })(),
    };
  }, won);
  t.eq(kept.count, `1 of ${TOTAL}`, 'a found animal survives a reload');
  t.eq(kept.foundCount, 1, 'exactly the one animal is unlocked');
  t.eq(kept.lockedVariants, 1, 'every locked tile draws the same placeholder — no spoilers');
  t.eq(kept.lockedLabels, 1, 'locked tiles all share one label');
  t.ok(kept.mineIsDrawn, 'the found animal is drawn, not placeholdered');
  t.ok(kept.mineOpens, 'tapping a found animal opens it full size');
  await page.close();
});

// An uploaded photo isn't anything in the collection, so it gets no name.
section('an uploaded photo stays anonymous', async (t) => {
  const page = await openPage({ clock: true });
  await page.locator('#imageInput').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: TINY_PNG });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await shortDuration(page);
  await page.evaluate(() => { document.getElementById('soundToggle').checked = false; });
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  const state = await page.evaluate(() => ({
    named: /visible/.test(document.getElementById('revealName').className),
    count: document.getElementById('collectionCount').textContent,
  }));
  t.ok(!state.named, 'an upload run shows no name');
  t.eq(state.count, `0 of ${TOTAL}`, 'an upload run does not add to the collection');
  await page.close();
});

// Surprise mode is chosen often enough to be worth restoring, and a throwing
// localStorage must not take the collection (or the app) down with it.
section('surprise mode survives', async (t) => {
  const page = await openPage();
  await page.locator('.art-thumb-wrap').nth(TILE.animal).click();
  await page.reload();
  const restored = await page.evaluate(() => {
    const w = document.querySelector('.art-thumb-wrap.selected');
    return { label: w && w.querySelector('span').textContent, enabled: !document.getElementById('startBtn').disabled };
  });
  t.eq(restored.label, 'An animal', 'surprise mode is restored on reload');
  t.ok(restored.enabled, 'restored surprise mode leaves Start enabled');
  await page.close();

  const blocked = await openPage({ clock: true, init: [[BLOCK_LOCALSTORAGE]] });
  await armSurprise(blocked);
  await blocked.locator('#startBtn').click();
  await finish(blocked);
  await blocked.waitForTimeout(30);
  const shown = await blocked.evaluate(() => document.getElementById('revealName').textContent);
  t.ok(shown.length > 0 && blocked.errors.length === 0,
    `surprise still reveals when localStorage throws${blocked.errors.length ? ': ' + blocked.errors.join(' | ') : ''}`);
  await blocked.close();
});

// ---- 12. starting a run from the collection ----
//
// Tapping an animal you've already found should let you run the timer with it
// again. The surprise is untouched: only found animals are tappable at all, and
// a found animal is one whose name the collection is already showing.
section('start from the collection', async (t) => {
  const page = await openPage({ clock: true });

  // Win exactly one animal through the surprise tile, the only way in.
  await armSurprise(page);
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  const won = await page.evaluate(() =>
    document.getElementById('revealName').textContent.replace(/^NEW/, ''));
  await page.locator('#resetBtn').click();

  await page.locator('#collectionBtn').click();
  await page.locator('.collection-item.found').first().click();
  const zoom = await page.evaluate(() => ({
    open: /open/.test(document.getElementById('zoomView').className),
    startText: document.getElementById('zoomStart').textContent,
    startVisible: document.getElementById('zoomStart').offsetParent !== null,
  }));
  t.ok(zoom.open, 'tapping a found animal still opens it full size');
  t.ok(zoom.startVisible && zoom.startText.includes(won),
    `the zoom view offers to start the timer with it (got "${zoom.startText}")`);

  await page.locator('#zoomStart').click();
  const started = await page.evaluate(() => ({
    sheet: document.getElementById('collectionSheet').className,
    timer: document.getElementById('timerView').className,
    setup: document.getElementById('setup').style.display,
  }));
  t.eq(started.sheet, 'sheet', 'starting from the sheet closes it');
  t.eq(started.timer, 'timer-view active', 'the timer view takes over');
  t.eq(started.setup, 'none', 'the setup screen is hidden');

  await finish(page);
  await page.waitForTimeout(30);
  const ran = await page.evaluate(() => ({
    text: document.getElementById('revealName').textContent,
    visible: /visible/.test(document.getElementById('revealName').className),
    badge: !!document.querySelector('#revealName .new-badge'),
    count: document.getElementById('collectionCount').textContent,
  }));
  t.eq(ran.text, won, 'the run reveals the animal that was tapped, not a random one');
  t.ok(ran.visible, 'its name shows at the reveal');
  t.ok(!ran.badge, 'an animal you already had is not flagged NEW again');
  t.eq(ran.count, `1 of ${TOTAL}`, 'replaying an animal does not change the collection');

  // Back on the setup screen the picked animal is the current selection, named,
  // so Start repeats it without going through the sheet again.
  await page.locator('#resetBtn').click();
  const onSetup = await page.evaluate(() => ({
    label: document.getElementById('previewLabel').textContent,
    labelShown: /visible/.test(document.getElementById('previewLabel').className),
    enabled: !document.getElementById('startBtn').disabled,
    tileSelected: !!document.querySelector('.art-thumb-wrap.selected'),
  }));
  t.eq(onSetup.label, won, 'the setup screen names the picked animal');
  t.ok(onSetup.labelShown, 'that label is visible');
  t.ok(onSetup.enabled, 'Start is enabled with an animal picked');
  t.ok(!onSetup.tileSelected, 'no surprise tile is left looking selected');

  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  t.eq(await page.evaluate(() => document.getElementById('revealName').textContent), won,
    'Start on the setup screen repeats the same animal');
  await page.locator('#resetBtn').click();

  // ...and it survives a reload, like any other saved selection.
  await page.reload();
  const restored = await page.evaluate(() => ({
    label: document.getElementById('previewLabel').textContent,
    enabled: !document.getElementById('startBtn').disabled,
    previewDrawn: (() => {
      const c = document.getElementById('previewCanvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    })(),
  }));
  t.eq(restored.label, won, 'a picked animal comes back after a reload');
  t.ok(restored.enabled && restored.previewDrawn, 'the restored animal is previewed and startable');

  // Switching to another surprise drops the animal — otherwise Start would
  // quietly run the animal while the preview showed the food tile.
  await armSurprise(page, TILE.food);
  const labelAfter = await page.evaluate(() => /visible/.test(document.getElementById('previewLabel').className));
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  const afterFood = await page.evaluate(() => document.getElementById('revealName').textContent.replace(/^NEW/, ''));
  t.ok(FOOD_NAMES.includes(afterFood), `picking the food surprise afterwards clears the chosen animal (got "${afterFood}")`);
  t.ok(!labelAfter, 'the animal name label goes away with it');
  t.ok(page.errors.length === 0, `no page errors${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
}, { slow: true });

// ---- 12b. picking an animal from the collection without starting ----
//
// "Start timer with X" was the only button in the zoom view, so meeting an
// animal you'd already found and just wanting to look at it, or line up a
// different duration/background first, meant starting a run to get there.
section('select an animal without starting the timer', async (t) => {
  const page = await openPage({ clock: true });
  await armSurprise(page);
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  const won = await page.evaluate(() =>
    document.getElementById('revealName').textContent.replace(/^NEW/, ''));
  await page.locator('#resetBtn').click();

  await page.locator('#collectionBtn').click();
  await page.locator('.collection-item.found').first().click();
  await page.locator('#zoomSelect').click();

  const picked = await page.evaluate(() => ({
    sheet: document.getElementById('collectionSheet').className,
    timer: document.getElementById('timerView').className,
    setup: document.getElementById('setup').style.display,
    label: document.getElementById('previewLabel').textContent,
    labelShown: /visible/.test(document.getElementById('previewLabel').className),
    enabled: !document.getElementById('startBtn').disabled,
  }));
  t.eq(picked.sheet, 'sheet', 'selecting closes the collection sheet');
  t.eq(picked.timer, 'timer-view', 'the timer is not started');
  t.eq(picked.setup, '', 'the setup screen is showing, not hidden');
  t.eq(picked.label, won, 'the setup screen names the picked animal');
  t.ok(picked.labelShown, 'that label is visible');
  t.ok(picked.enabled, 'Start is enabled, ready for a deliberate tap');

  // Only pressing Start now actually runs it, with the animal that was picked.
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  t.eq(await page.evaluate(() => document.getElementById('revealName').textContent), won,
    'Start afterwards runs the picked animal, not a fresh surprise');
  t.ok(page.errors.length === 0, `no page errors${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
});

// An animal you haven't found has no way in: its tile is inert, and a saved
// selection naming one is ignored rather than put on screen.
section('an unfound animal has no way in', async (t) => {
  const page = await openPage();
  await page.evaluate(() => {
    window.localStorage.setItem('revealTimer.settings.v1',
      JSON.stringify({ art: 'animal:Shark', bg: '#111827', duration: '300', sound: false }));
    window.localStorage.removeItem('revealTimer.animals.v1');
  });
  await page.reload();
  const guarded = await page.evaluate(() => {
    document.getElementById('collectionBtn').click();
    const locked = document.querySelectorAll('.collection-item:not(.found)');
    locked[0].click();   // inert: no listener is attached to a locked tile
    return {
      zoomOpen: /open/.test(document.getElementById('zoomView').className),
      lockedCount: locked.length,
      startDisabled: document.getElementById('startBtn').disabled,
      labelShown: /visible/.test(document.getElementById('previewLabel').className),
      // innerText, not textContent: the latter includes the inline <script>,
      // whose source has always listed every animal by name.
      body: document.body.innerText,
    };
  });
  t.eq(guarded.lockedCount, TOTAL, 'a cleared collection locks everything again');
  t.ok(!guarded.zoomOpen, 'a locked tile cannot be opened');
  t.ok(guarded.startDisabled, 'a saved animal that is no longer found is not restored');
  t.ok(!guarded.labelShown, 'nothing on the setup screen names it');
  t.ok(!/Shark/.test(guarded.body), 'the unfound animal is not named anywhere on screen');
  await page.close();
});

// Once every animal has been found the surprise can't hand back a new one, and
// it used to draw uniformly from all sixteen — a 1-in-16 chance of repeating
// the animal you just had, and typically 13 of the 16 over a week of reveals.
// It now deals from a shuffled deck, so the three properties below hold:
// sixteen runs give sixteen different animals, the deck survives a reload
// rather than re-dealing from a full set, and a reshuffle never puts the animal
// you just saw back on top.
section('past the end of the set the surprise deals from a deck', async (t) => {
  const KEY = 'revealTimer.animals.v1';

  // Seeded through the page rather than through an init script, because an init
  // script runs again on every navigation — including the reloads below, where
  // re-writing the key would wipe the very deck being tested. (Guarding the
  // write on "is the key empty?" is not enough: at document start on a file://
  // page that read comes back empty often enough to fail about one run in
  // three.) Loading this app is the expensive part of the section — thirty-odd
  // canvases get drawn every time — so the two halves run on their own pages
  // side by side rather than one after the other.
  const armed = async (state) => {
    const page = await openPage({ clock: true });
    await page.evaluate(([k, v]) => { window.localStorage.setItem(k, JSON.stringify(v)); }, [KEY, state]);
    await page.reload();
    await armSurprise(page);
    page.runOnce = async () => {
      await page.evaluate(() => { document.getElementById('startBtn').click(); });
      await finish(page);
      return page.evaluate(() => {
        const name = document.getElementById('revealName').textContent;
        document.getElementById('resetBtn').click();
        return name;
      });
    };
    return page;
  };

  // Half one: four deals and then the state of the deck, rather than sixteen
  // deals — what makes a pass repeat-free is that the deck holds exactly the
  // animals it hasn't dealt yet, and that is visible after four. Then a reload,
  // which a deck kept only in memory would not survive.
  const pass = async () => {
    const page = await armed({ found: ANIMAL_NAMES });
    const dealt = [];
    for (let i = 0; i < 4; i++) dealt.push(await page.runOnce());
    const left = await page.evaluate(k =>
      ((JSON.parse(window.localStorage.getItem(k)) || {}).decks || {}).animal || [], KEY);
    await page.reload();
    await armSurprise(page);
    const resumed = await page.runOnce();
    const errors = page.errors.slice();
    await page.close();
    return { dealt, left, resumed, errors };
  };

  // Half two: the seam between one pass and the next. The deck is seeded with a
  // single card, so the run after it has to reshuffle. It's seeded in the old
  // single-deck format on purpose: that's what an existing save holds.
  const seam = async () => {
    const page = await armed({ found: ANIMAL_NAMES, deck: [ANIMAL_NAMES[0]] });
    const lastOfPass = await page.runOnce();
    const firstOfNext = await page.runOnce();
    const errors = page.errors.slice();
    await page.close();
    return { lastOfPass, firstOfNext, errors };
  };

  const [a, b] = await Promise.all([pass(), seam()]);

  t.ok(a.dealt.every(n => ANIMAL_NAMES.includes(n)), 'every deal is a known animal');
  t.eq(new Set(a.dealt).size, a.dealt.length, 'four deals in a row, four different animals');
  t.eq(a.left.length, ANIMAL_NAMES.length - a.dealt.length, 'the rest of the set is still in the deck');
  t.ok(a.left.every(n => a.dealt.indexOf(n) < 0),
    'and holds exactly what has not been dealt, so a pass cannot repeat one');
  t.ok(a.left.indexOf(a.resumed) >= 0,
    `the deck survives a reload rather than re-dealing from a full set (got "${a.resumed}")`);
  t.eq(b.lastOfPass, ANIMAL_NAMES[0], 'the last card of a pass is the one that was left in the deck');
  t.ok(b.firstOfNext !== b.lastOfPass,
    `a reshuffle doesn't deal the animal you just saw (got "${b.firstOfNext}" after "${b.lastOfPass}")`);
  const errors = a.errors.concat(b.errors);
  t.ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
}, { slow: true });

// The mask that hides the picture is also the clock, and there are four of them
// now. Whichever gets picked, the area it still covers has to track the time
// left — and at least two have to keep the middle of the picture covered until
// the end, because the middle is where every animal in the set keeps its face.
const REVEAL_COUNT = 4;
section('the picture comes off four different ways', async (t) => {
  // A pixel counts as masked when it is within a channel's tolerance of the
  // mask colour. The run uses the Sand background (a near-white mask) over the
  // Mandala artwork (near-black), so no part of the picture can be mistaken
  // for the mask — which is what makes a plain pixel count trustworthy here.
  const COVER = () => {
    const c = document.getElementById('canvas');
    const S = c.width, R = S / 2;
    const d = c.getContext('2d').getImageData(0, 0, S, S).data;
    const m = document.querySelector('.bg-swatch.selected')
      .getAttribute('data-mask').split(',').map(Number);
    let inside = 0, masked = 0, core = 0, coreMasked = 0, sig = '';
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % S, py = Math.floor((i / 4) / S);
      const near = d[i + 3] > 128
        && Math.abs(d[i] - m[0]) < 24
        && Math.abs(d[i + 1] - m[1]) < 24
        && Math.abs(d[i + 2] - m[2]) < 24;
      if ((i / 4) % 997 === 0) sig += near ? '1' : '0';
      if (d[i + 3] < 128) continue;
      inside++; if (near) masked++;
      if ((px - R) ** 2 + (py - R) ** 2 < (R * 0.3) ** 2) { core++; if (near) coreMasked++; }
    }
    return { cover: masked / inside, core: coreMasked / core, sig };
  };

  // The pattern is chosen by the first Math.random() of a run, so pinning
  // Math.random to a constant picks one. Nothing else on the page depends on
  // it here: the artwork and the background are clicked, not rolled for.
  //
  // This is the one section that samples a run *part way through*, and
  // page.clock.install() does not stop the clock — it keeps ticking in real
  // time and runFor() adds to that. So a one-second run would be perhaps 10%
  // through before the first sample was taken. A ten-second run makes the same
  // real-time drift a rounding error, and the frames are still driven by
  // runFor(), so it costs frames rather than seconds.
  const RUN_MS = 10000;
  const trial = async (i) => {
    const page = await openPage({
      clock: true,
      init: [[c => { Math.random = () => c; }, (i + 0.5) / REVEAL_COUNT]],
    });
    await pickFound(page, 'Mandala');                      // Mandala: a near-black artwork
    await page.locator('.bg-swatch').nth(6).click();       // Sand: a near-white mask
    await page.evaluate((s) => {
      const sel = document.getElementById('durationSelect');
      const opt = document.createElement('option');
      opt.value = String(s); opt.textContent = s + 's';
      sel.appendChild(opt); sel.value = String(s);
      document.getElementById('soundToggle').checked = false;
    }, RUN_MS / 1000);
    await page.locator('#startBtn').click();
    await page.clock.runFor(100);            // far enough in to have drawn a frame
    const full = await page.evaluate(COVER);
    await page.clock.runFor(RUN_MS / 2 - 200);
    const half = await page.evaluate(COVER);
    await page.clock.runFor(RUN_MS / 4);
    const quarter = await page.evaluate(COVER);
    const errors = page.errors.slice();
    await page.close();
    return { full, half, quarter, errors };
  };

  const runs = await Promise.all([...Array(REVEAL_COUNT).keys()].map(trial));
  runs.forEach((r, i) => {
    t.ok(r.full.cover > 0.95,
      `pattern ${i}: the picture starts completely hidden (${(r.full.cover * 100).toFixed(0)}% covered)`);
    t.ok(r.half.cover > 0.40 && r.half.cover < 0.60,
      `pattern ${i}: half the round left means about half the picture is still hidden (${(r.half.cover * 100).toFixed(0)}%)`);
    t.ok(r.quarter.cover > 0.17 && r.quarter.cover < 0.33,
      `pattern ${i}: a quarter left means about a quarter still hidden (${(r.quarter.cover * 100).toFixed(0)}%)`);
    t.ok(r.errors.length === 0, `pattern ${i}: no page errors${r.errors.length ? ': ' + r.errors.join(' | ') : ''}`);
  });
  t.eq(new Set(runs.map(r => r.half.sig)).size, REVEAL_COUNT,
    'the four patterns hide four visibly different shapes');
  // What the iris and the tiles are for. The wedge and the curtain have both
  // opened the middle by half time, which is the behaviour these two exist to
  // vary — an animal you can name at half time has no surprise left in it.
  const faceLast = runs.filter(r => r.half.core > 0.9).length;
  t.ok(faceLast >= 2,
    `at least two patterns still hide the middle of the picture at half time (${faceLast} of ${REVEAL_COUNT} do)`);
  const faceStillLast = runs.filter(r => r.quarter.core > 0.7).length;
  t.ok(faceStillLast >= 2,
    `and still mostly hide it with a quarter of the round left (${faceStillLast} of ${REVEAL_COUNT} do)`);
}, { slow: true });

// ---- 15. every category's surprise deals from that category ----
section('each surprise tile deals from its own category', async (t) => {
  const runs = [['food', FOOD_NAMES], ['word', WORD_NAMES], ['pattern', PATTERN_NAMES], ['any', ALL_NAMES]];
  const results = await Promise.all(runs.map(async ([cat, names]) => {
    const page = await openPage({ clock: true });
    await armSurprise(page, TILE[cat]);
    const got = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { document.getElementById('startBtn').click(); });
      await finish(page);
      got.push(await page.evaluate(() => {
        const n = document.getElementById('revealName').textContent.replace(/^NEW/, '');
        document.getElementById('resetBtn').click();
        return n;
      }));
    }
    const count = await page.evaluate(() => document.getElementById('collectionCount').textContent);
    const errors = page.errors.slice();
    await page.close();
    return { cat, names, got, count, errors };
  }));
  for (const r of results) {
    t.ok(r.got.every(n => r.names.includes(n)), `${r.cat}: every reveal comes from that category (${r.got.join(', ')})`);
    t.eq(new Set(r.got).size, 3, `${r.cat}: three runs, three different things`);
    t.eq(r.count, `3 of ${TOTAL}`, `${r.cat}: each one is added to the collection`);
    t.ok(r.errors.length === 0, `${r.cat}: no page errors${r.errors.length ? ': ' + r.errors.join(' | ') : ''}`);
  }
});

// ---- 16. saves from before categories still load ----
// The old app saved "__surprise__" for the animal surprise, "animal:Fox" for a
// picked animal, and a bare name for a preset pattern. A pattern that was the
// saved selection was in use, so it comes back as found rather than vanishing.
section('older saves carry over', async (t) => {
  const load = async (settings, animals) => {
    const page = await openPage();
    await page.evaluate(([s, a]) => {
      window.localStorage.setItem('revealTimer.settings.v1', JSON.stringify(s));
      if (a) window.localStorage.setItem('revealTimer.animals.v1', JSON.stringify(a));
    }, [settings, animals]);
    await page.reload();
    const out = await page.evaluate(() => ({
      tile: (document.querySelector('.art-thumb-wrap.selected span') || {}).textContent || null,
      label: document.getElementById('previewLabel').textContent,
      count: document.getElementById('collectionCount').textContent,
      enabled: !document.getElementById('startBtn').disabled,
    }));
    out.errors = page.errors.slice();
    await page.close();
    return out;
  };
  const base = { bg: '#111827', duration: '300', sound: false };
  const [surprise, animal, pattern] = await Promise.all([
    load({ ...base, art: '__surprise__' }, { found: ['Fox', 'Cat'], deck: ['Owl'], last: 'Fox' }),
    load({ ...base, art: 'animal:Cat' }, { found: ['Fox', 'Cat'] }),
    load({ ...base, art: 'Mandala' }, null),
  ]);
  t.eq(surprise.tile, 'An animal', 'the old surprise setting selects the animal surprise');
  t.eq(surprise.count, `2 of ${TOTAL}`, 'animals found before categories are still found');
  t.eq(animal.label, 'Cat', 'an old picked animal is still picked');
  t.eq(pattern.label, 'Mandala', 'an old preset pattern is still picked');
  t.eq(pattern.count, `1 of ${TOTAL}`, 'and counts as found');
  t.ok([surprise, animal, pattern].every(r => r.enabled), 'Start is enabled in every case');
  const errors = [surprise, animal, pattern].flatMap(r => r.errors);
  t.ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
});

// ---- 14. the tiles pattern has no seams between covered cells ----
//
// revealTiles() draws each covered cell as its own fillRect. Two neighbours
// used to be filled half a pixel oversize so they'd overlap rather than leave
// a gap — which stopped a true gap, but a semi-transparent mask compounds two
// overlapping fills into something visibly darker than one, i.e. a grid of
// hairlines along every cell edge. Now the mask is opaque and cell edges are
// rounded to whole pixels, so neighbouring cells share an exact boundary with
// nothing to blend.
//
// Any two adjacent pixels that are each individually close to the mask colour
// are two covered cells (or one cell and its own fill) — a real mask-to-artwork
// edge always has one side far from the mask colour, so filtering for "both
// sides look like the mask" is what isolates a covered/covered seam from an
// ordinary, expected reveal boundary.
section('the tiles pattern has no seams between covered cells', async (t) => {
  const page = await openPage({
    clock: true,
    init: [[(pick) => {
      let first = true;
      const orig = Math.random;
      Math.random = () => { if (first) { first = false; return pick; } return orig(); };
    }, 3.5 / 4]], // the 4th of 4 patterns = tiles
  });
  await pickFound(page, 'Mandala');                      // Mandala: near-black artwork, max contrast
  await page.locator('.bg-swatch').nth(6).click();       // Sand: near-white mask
  await shortDuration(page);
  await page.evaluate(() => { document.getElementById('soundToggle').checked = false; });
  await page.locator('#startBtn').click();
  await page.clock.runFor(100); // far enough in to have drawn a frame
  await page.waitForTimeout(30);
  const result = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    const S = c.width;
    const d = c.getContext('2d').getImageData(0, 0, S, S).data;
    const m = document.querySelector('.bg-swatch.selected').getAttribute('data-mask').split(',').map(Number);
    const at = (x, y) => { const i = (y * S + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const nearMask = (px) => Math.abs(px[0] - m[0]) < 20 && Math.abs(px[1] - m[1]) < 20 && Math.abs(px[2] - m[2]) < 20;
    // Inside the circle's own antialiased edge (R=S/2), not just inside the
    // canvas — the clip boundary blends the mask towards transparent over a
    // couple of pixels, which is an unrelated, expected softness and would
    // otherwise register as a false "seam" near the rim.
    const R = S / 2, cx = S / 2, cy = S / 2, SAFE = R - 8;
    let maxJump = 0, checked = 0;
    for (let y = 20; y < S - 20; y++) {
      for (let x = 20; x < S - 20; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > SAFE * SAFE) continue;
        const a = at(x, y), b = at(x + 1, y);
        if (!nearMask(a) || !nearMask(b)) continue;
        checked++;
        maxJump = Math.max(maxJump, Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]));
      }
    }
    return { maxJump, checked };
  });
  t.ok(result.checked > 1000, `plenty of covered/covered pixel pairs to check (${result.checked})`);
  t.ok(result.maxJump < 4, `no visible seam between covered tiles (largest single-pixel jump: ${result.maxJump})`);
  t.ok(page.errors.length === 0, `no page errors${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  await page.close();
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
browser = await chromium.launch(launchOpts);

const started = Date.now();
const results = new Array(SECTIONS.length);
const finished = new Array(SECTIONS.length).fill(false);
// Slow sections first, so the pool never ends up waiting on one straggler.
const queue = SECTIONS.map((s, i) => i).sort((a, b) => (SECTIONS[b].slow ? 1 : 0) - (SECTIONS[a].slow ? 1 : 0));
let cursor = 0, printed = 0;

// TEST_TIMING=1 tags each section with how long it took, which is how you find
// the next long pole (the whole suite is only as fast as its slowest section).
const timing = !!process.env.TEST_TIMING;
const flush = () => {
  while (printed < SECTIONS.length && finished[printed]) {
    const r = results[printed];
    console.log(r.name + (timing ? ` (${(r.ms / 1000).toFixed(1)}s)` : ''));
    for (const line of r.lines) console.log(line);
    printed++;
  }
};

const worker = async () => {
  while (cursor < queue.length) {
    const i = queue[cursor++];
    const t = new Checks(SECTIONS[i].name);
    const t0 = Date.now();
    try { await SECTIONS[i].fn(t); }
    catch (e) { t.ok(false, `section threw: ${(e && e.stack) || e}`); }
    t.ms = Date.now() - t0;
    results[i] = t; finished[i] = true;
    flush();
  }
};

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, SECTIONS.length) }, worker));
await browser.close();
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(failures
  ? `\nFAILED: ${failures} check(s) — ${SECTIONS.length} sections in ${secs}s`
  : `\nALL CHECKS PASSED — ${SECTIONS.length} sections in ${secs}s`);
process.exit(failures ? 1 : 0);
