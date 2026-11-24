// iOS 9 Safari, approximately. No such browser runs in CI, so this takes away
// what it lacks — CSS it can't parse, DOM methods it doesn't have, syntax newer
// than ES5 — and checks the app is still usable. A real iPad can still surprise
// us; what this catches is leaning on something newer without a fallback.
//
// The floor is really iOS 9.3: the colours are CSS custom properties.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { test, ok, eq, expect, TILE } from './helpers.mjs';

const APP_DIR = fileURLToPath(new URL('..', import.meta.url));

// ---- CSS ----
// A browser drops a declaration it can't parse, and a whole rule whose selector
// it can't parse. Each pattern is followed by the first iOS that understands it.
const NEW_VALUE = /\b(env|max|min|clamp)\(|\b\d+[dsl]v[hw]\b|\bgrid\b/;    // 11, 11, 11, 13, 15.4, 10.3
const NEW_PROPERTY = /^(gap|row-gap|column-gap|grid-.*|inset|aspect-ratio|overscroll-behavior|place-.*)$/; // 14.5, 10.3, 14.5, 15, 16, 11
const NEW_SELECTOR = /:(has|is|where|focus-visible)\b/;                    // 15.4, 14, 14, 15.4

const ios9Css = css => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/([^{}]*)\{([^{}]*)\}/g, (rule, selector, body) => {
    if (NEW_SELECTOR.test(selector)) return '';
    const kept = body.split(';').filter(decl => {
      const colon = decl.indexOf(':');
      if (colon < 0) return false;
      return !NEW_PROPERTY.test(decl.slice(0, colon).trim()) && !NEW_VALUE.test(decl.slice(colon + 1));
    });
    return `${selector}{${kept.join(';')}}`;
  });

const serveIos9Css = async (page) => {
  await page.route(/\.css$|\/round-timer\/$/, async route => {
    const response = await route.fetch();
    const text = await response.text();
    const body = /\.css$/.test(route.request().url())
      ? ios9Css(text)
      : text.replace(/(<style>)([\s\S]*?)(<\/style>)/g, (m, open, css, close) => open + ios9Css(css) + close);
    await route.fulfill({ response, body });
  });
};

// ---- DOM and JS built-ins ----
const REMOVE_NEW_APIS = () => {
  const drop = (obj, ...names) => { for (const n of names) if (obj) delete obj[n]; };
  drop(CanvasRenderingContext2D.prototype, 'ellipse', 'roundRect', 'reset', 'createConicGradient', 'filter');
  drop(NodeList.prototype, 'forEach', 'entries', 'keys', 'values');
  drop(Element.prototype, 'append', 'prepend', 'before', 'after', 'replaceWith', 'replaceChildren', 'toggleAttribute');
  drop(Document.prototype, 'append', 'prepend', 'replaceChildren');
  drop(Navigator.prototype, 'wakeLock', 'serviceWorker');
  drop(window, 'AudioContext', 'fetch', 'IntersectionObserver', 'ResizeObserver', 'structuredClone');
};

const ios9Page = (openPage, options = {}) =>
  openPage({ ...options, init: [[REMOVE_NEW_APIS]], beforeLoad: serveIos9Css });

const PHONE = { width: 320, height: 504 };   // iPhone 5, in Safari
const IPAD  = { width: 768, height: 960 };

// Horizontal/vertical daylight between neighbouring elements.
const GAPS = (selector) => {
  const r = [...document.querySelectorAll(selector)].map(e => e.getBoundingClientRect());
  return r.slice(1).map((b, i) => Math.max(b.left - r[i].right, b.top - r[i].bottom));
};

for (const [device, viewport] of [['iPhone', PHONE], ['iPad', IPAD]]) {
  test(`the setup screen holds together on an old ${device}`, async ({ openPage }) => {
    const page = await ios9Page(openPage, { viewport });
    eq(await page.evaluate(() => getComputedStyle(document.getElementById('artRow')).columnGap), 'normal',
      'the page under test has no flexbox gap');
    ok(await page.evaluate(() => {
      const r = document.getElementById('startBtn').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }), 'Start is on screen');
    for (const what of ['.art-thumb-wrap', '.bg-row:first-child .bg-swatch', '.divider > *', '.sound-row > *']) {
      const gaps = await page.evaluate(GAPS, what);
      ok(gaps.length && gaps.every(g => g >= 3), `${what}: neighbours don't touch (${gaps.map(g => g.toFixed(1)).join(', ')})`);
    }
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  });

  test(`the collection fills the screen on an old ${device}`, async ({ openPage }) => {
    const page = await ios9Page(openPage, { viewport });
    await page.locator('#collectionBtn').click();
    const sheet = await page.evaluate(() => {
      const r = document.getElementById('collectionSheet').getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    expect.soft(sheet, 'the sheet covers the page').toEqual({ left: 0, top: 0, ...viewport });
    const gaps = await page.evaluate(GAPS, '.collection-item:nth-child(-n+5)');
    ok(gaps.every(g => g >= 5), `tiles don't touch (${gaps.join(', ')})`);
    await page.locator('#collectionClose').click();
    ok(await page.locator('#collectionSheet').isHidden(), 'and it closes again');
  });
}

test('Reset keeps its distance from Pause', async ({ openPage }) => {
  const page = await ios9Page(openPage, { viewport: PHONE });
  await page.locator('.art-thumb-wrap').nth(TILE.animal).click();
  await page.locator('#startBtn').click();
  const [gap] = await page.evaluate(GAPS, '.controls button');
  ok(gap >= 24, `Reset throws the run away, so it must not sit next to Pause (${gap}px)`);
  ok(await page.locator('#wakeBanner').isVisible(), 'with no Wake Lock, the keep-your-screen-on banner shows');
});

// ---- Syntax ----
const scriptsIn = () => {
  const html = readFileSync(APP_DIR + 'index.html', 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m, i) => [`index.html script ${i}`, m[1]]);
  const files = readdirSync(APP_DIR, { recursive: true })
    .filter(f => f.endsWith('.js'))
    .map(f => [f, readFileSync(APP_DIR + f, 'utf8')]);
  return inline.concat(files);
};

test('the scripts are ES5 and avoid what iOS 9 canvas lacks', () => {
  const scripts = scriptsIn();
  ok(scripts.length > 0, 'found the scripts');
  for (const [name, source] of scripts) {
    let error = null;
    try { parse(source, { ecmaVersion: 5 }); } catch (e) { error = e.message; }
    eq(error, null, `${name} parses as ES5`);
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect.soft(code.match(/['"]#[0-9a-f]{8}['"]/gi), `${name}: 8-digit hex makes addColorStop throw`).toBeNull();
    expect.soft(code.match(/\.ellipse\(/g), `${name}: no ctx.ellipse(), use ell()`).toBeNull();
  }
});
