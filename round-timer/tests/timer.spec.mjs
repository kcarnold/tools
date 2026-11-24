import {
  test, ok, eq, finish, shortDuration, pickFound, TILE_LABELS, CANVAS_VARIANCE, TINY_PNG, TOTAL,
} from './helpers.mjs';

// timer completion + celebration animation
test('timer completion + celebration animation', async ({ openPage }) => {
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
    return { doneClass, variance };
  };
  const results = await Promise.all([0, 1, 2, 3, 4, 5].map(trial));
  const seen = new Set();
  results.forEach((r, n) => {
    ok(r.doneClass === 'time-display done', `trial ${n}: reaches done state`);
    ok(r.variance > 50, `trial ${n}: celebration animation is visibly drawing (variance ${r.variance.toFixed(0)})`);
    seen.add(Math.round(r.variance));
  });
  ok(seen.size > 1, `celebration animation varies across completions (${seen.size} distinct variance samples across 6 trials)`);
});

// countdown digits keep a fixed width
test('time display', async ({ openPage }) => {
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
  ok(spread < 0.5, `all-digit strings render at one fixed width (spread ${spread.toFixed(2)}px: ${JSON.stringify(widths)})`);
});

// one chime on start, a longer one on finish
test('chimes', async ({ openPage }) => {
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
  eq(onStart.length, 4, 'starting the timer plays the chime exactly once (4 notes)');

  await finish(page);
  await page.waitForTimeout(30);
  const all = await page.evaluate(() => window.__notes.slice());
  const done = all.slice(4);
  ok(done.length >= 16, `finish chime repeats more than it used to (${done.length} notes, was 12)`);
  const span = Math.max(...done) - Math.min(...done);
  ok(span > 5, `finish chime keeps ringing for a while (${span.toFixed(1)}s of note onsets, was ~4.6s)`);
});

// celebration stays legible on a light artwork
// Every effect should darken a pale artwork and brighten a dark one. Before the
// contrast fix, Sparkle and Pulse were plain white and did neither on a light
// image (0 darkened pixels — they were invisible).
//
// Ten independent (artwork x effect) pairs, one test each so the workers can
// spread them out; together they used to be more than half the suite's runtime.
{
  const CELEBS = ['Rings', 'Confetti', 'Sparkle', 'Fireworks', 'Pulse'];
  for (const [art, expect] of [['Terrazzo', 'darker'], ['Mandala', 'brighter']]) {
    for (let ci = 0; ci < CELEBS.length; ci++) {
      const effect = CELEBS[ci], pin = ci / CELEBS.length + 0.05;
      test(`celebration contrast: ${art} + ${effect}`, async ({ openPage }) => {
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
        ok(win > 1000 && win > lose * 2,
          `${art} + ${effect}: effect reads as ${expect} against the artwork (darker ${diff.darker}, brighter ${diff.brighter})`);
      });
    }
  }
}

// An uploaded photo isn't anything in the collection, so it gets no name.
test('an uploaded photo stays anonymous', async ({ openPage }) => {
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
  ok(!state.named, 'an upload run shows no name');
  eq(state.count, `0 of ${TOTAL}`, 'an upload run does not add to the collection');
});
