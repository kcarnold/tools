// Shared by every spec: the openPage fixture, soft assertions, and the in-page
// scratch code that more than one spec needs.

import { test as base, expect } from '@playwright/test';

export const APP_URL = '/round-timer/';

// Soft, so one run reports every check that fails rather than only the first.
export const ok = (cond, msg) => expect.soft(!!cond, msg).toBe(true);
export const eq = (actual, wanted, msg) => expect.soft(actual, msg).toBe(wanted);

// The shortest duration the dropdown offers is 30 seconds, and running the fake
// clock through 30s of requestAnimationFrame is ~1800 redraws of the artwork —
// by far the dominant cost of this suite, and enough of a memory load to kill
// the renderer if you complete twenty timers on one page. The app reads
// durationSelect.value directly, so appending a 1-second option drives exactly
// the same code path in a thirtieth of the frames. Anything asserting on the
// dropdown's own contents (the saved-settings test) still uses the real options.
export const RUN_S = 1;
export const shortDuration = page => page.evaluate((s) => {
  const sel = document.getElementById('durationSelect');
  const opt = document.createElement('option');
  opt.value = String(s); opt.textContent = s + 's';
  sel.appendChild(opt); sel.value = String(s);
}, RUN_S);
// Comfortably past the duration, so the last tick lands on onDone().
export const finish = page => page.clock.runFor(RUN_S * 1000 + 100);

// The countdown and the celebration both redraw the whole artwork on every
// animation frame, and at 60fps a one-second run is 60 redraws — 280ms of
// headless software rasterising, repeated for every run in the suite. Nothing
// here asserts on frame rate: the checks look at what is on the canvas at a
// given instant, and the app's own clock is Date.now(), not a frame count. So
// each page gets a requestAnimationFrame that ticks 20 times a second instead
// of 60, which is still smooth enough to sample an animation and cuts the
// redraws — the suite's single biggest cost — by two thirds.
export const RAF_STEP_MS = 50;
export const throttleFrames = (step) => {
  window.requestAnimationFrame = function (cb) {
    return setTimeout(function () { cb(Date.now()); }, step);
  };
  window.cancelAnimationFrame = function (id) { clearTimeout(id); };
};

// openPage() gives a page of its own context, so localStorage never leaks from
// one to the next. A test may open several. Any uncaught error on any of them
// fails the test, so no test has to check for that itself.
//   clock: install the fake clock (needed by anything that runs a timer).
//   init:  extra init scripts, applied before the frame throttle.
//   Anything else (viewport, serviceWorkers...) is passed to the browser context.
export const test = base.extend({
  openPage: async ({ browser }, use) => {
    const contexts = [], errors = [];
    await use(async ({ clock = false, init = [], url = APP_URL, beforeLoad, ...options } = {}) => {
      const context = await browser.newContext(options);
      contexts.push(context);
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      for (const [fn, arg] of init) await page.addInitScript(fn, arg);
      // page.clock.install() installs its own requestAnimationFrame, so the
      // throttle has to be registered after it to be the one that survives.
      if (clock) await page.clock.install({ time: 0 });
      await page.addInitScript(throttleFrames, RAF_STEP_MS);
      if (beforeLoad) await beforeLoad(page);
      await page.goto(url);
      return page;
    });
    for (const context of contexts) await context.close();
    expect(errors, 'no uncaught errors on any page').toEqual([]);
  },
});
export { expect };

// The two blocks of in-page scratch code that more than one spec needs.
export const BLOCK_LOCALSTORAGE = () => {
  Object.defineProperty(window, 'localStorage', {
    get() { throw new Error('SecurityError: localStorage is disabled'); },
  });
};
// Variance of pixel luminance: near zero means nothing was drawn.
export const CANVAS_VARIANCE = (id) => {
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
export const TILE = { any: 0, animal: 1, food: 2, word: 3, pattern: 4 };
export const TILE_LABELS = ['Anything!', 'An animal', 'Food', 'A word', 'A pattern'];

// Pick a surprise tile (the animal one unless told otherwise), shorten the run,
// silence the chime — the opening move of most of the animal tests.
export const armSurprise = async (page, tile = TILE.animal) => {
  await page.locator('.art-thumb-wrap').nth(tile).click();
  await shortDuration(page);
  await page.evaluate(() => { document.getElementById('soundToggle').checked = false; });
};

// Put one specific thing on the setup screen. Patterns are no longer tiles of
// their own — like everything else they're found first and then picked from
// the collection — so this marks it found, reloads, and picks it there.
export const pickFound = async (page, name) => {
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
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');

export const ANIMAL_NAMES = [
  'Fox', 'Cat', 'Penguin', 'Owl', 'Panda', 'Frog', 'Sloth', 'Axolotl',
  'Narwhal', 'Blobfish', 'Platypus', 'Chameleon', 'Shark', 'T. rex',
  'Tiger', 'Snake', 'Sea Star', 'Crocodile',
  // OpenMoji: the monkey, then the animal-and-a-thing pictures the kids picked.
  'Monkey', 'Cool Monkey', 'Doughnut Sloth', 'Birthday Hamster', 'Ice-cream Croc',
  'Pizza Shark', 'Cocoa Owl', 'Rock-star Elephant', 'Fancy Hamster', 'King Koala',
  'Shady Rabbit', 'Bath-time Hedgehog',
];
export const N = ANIMAL_NAMES.length;
export const FOOD_NAMES = ['Pizza', 'Doughnut', 'Watermelon', 'Ice Cream', 'Strawberry', 'Cupcake',
  'Banana', 'Pancakes', 'Avocado', 'Fried Egg'];
export const WORD_NAMES = ['Kaboom', 'Bonkers', 'Noodle', 'Zigzag', 'Squish', 'Wobble', 'Gizmo',
  'Lollygag', 'Skedaddle', 'Bamboozle', 'Kerfuffle', 'Hullabaloo'];
export const PATTERN_NAMES = ['Mandala', 'Sunburst', 'Aurora', 'Mosaic', 'Spiral', 'Waves', 'Prism',
  'Ember', 'Forest', 'Neon', 'Nebula', 'Sunset', 'Terrazzo', 'Kaleidoscope'];
export const ALL_NAMES = [...ANIMAL_NAMES, ...FOOD_NAMES, ...WORD_NAMES, ...PATTERN_NAMES];
export const TOTAL = ALL_NAMES.length;
