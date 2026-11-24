// What the app holds on to while a round runs — the screen, the audio context,
// the sounds already scheduled — and that it lets go of them.

import { test, ok, eq, finish, shortDuration, armSurprise, TINY_PNG } from './helpers.mjs';

// Stands in for navigator.wakeLock, counting the locks still held.
const FAKE_WAKE_LOCK = () => {
  window.__locks = { held: 0, requested: 0 };
  Object.defineProperty(Navigator.prototype, 'wakeLock', {
    configurable: true,
    get: () => ({
      request: () => {
        window.__locks.requested++; window.__locks.held++;
        let mine = true;
        const lock = { release: () => { if (mine) { mine = false; window.__locks.held--; } return Promise.resolve(); } };
        return Promise.resolve(lock);
      },
    }),
  });
};

// Stands in for Web Audio. Set __audio.state to 'suspended' or 'interrupted' to
// have the context come up that way; __audio.sounding is the notes not stopped.
const FAKE_AUDIO = () => {
  const audio = window.__audio = { state: 'running', resumed: 0, started: 0, oscillators: [] };
  const param = () => ({
    setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; }, cancelScheduledValues() { return this; },
  });
  window.AudioContext = window.webkitAudioContext = function () {
    Object.defineProperty(this, 'state', { get: () => audio.state });
    this.currentTime = 0; this.sampleRate = 44100; this.destination = {};
    this.resume = () => { audio.resumed++; audio.state = 'running'; return Promise.resolve(); };
    this.createOscillator = () => {
      const o = { type: '', frequency: { value: 0 }, silenced: false, connect() {}, disconnect() { o.silenced = true; },
                  start() { audio.started++; }, stop(t) { if (t === undefined || t === 0) o.silenced = true; } };
      audio.oscillators.push(o);
      return o;
    };
    this.createGain = () => ({ gain: param(), connect() {}, disconnect() {} });
    this.createBuffer = () => ({});
    this.createBufferSource = () => ({ buffer: null, connect() {}, start() {} });
  };
};

const held = page => page.evaluate(() => window.__locks.held);
const becomeVisible = page => page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });

test('the screen is kept on for a round and a minute after it', async ({ openPage }) => {
  const page = await openPage({ clock: true, init: [[FAKE_WAKE_LOCK]] });
  await armSurprise(page);
  eq(await held(page), 0, 'nothing is held on the setup screen');
  await page.locator('#startBtn').click();
  eq(await held(page), 1, 'running holds one lock');
  await page.locator('#pauseBtn').click();
  eq(await held(page), 0, 'pausing lets go');
  await page.locator('#pauseBtn').click();
  eq(await held(page), 1, 'resuming takes it back');
  await finish(page);
  await page.clock.runFor(9000);             // the celebration is over too
  eq(await held(page), 1, 'the screen stays on for a while to look at the picture');
  await page.clock.runFor(61000);
  eq(await held(page), 0, 'and then may sleep');
  await becomeVisible(page);
  eq(await held(page), 0, 'coming back to a finished round does not take it again');
  await page.locator('#pauseBtn').click();   // Restart
  eq(await held(page), 1, 'Restart holds one lock, not two');
  await page.locator('#resetBtn').click();
  eq(await held(page), 0, 'Reset lets go');
});

test('a new round is not cut off by the last one letting go of the screen', async ({ openPage }) => {
  const page = await openPage({ clock: true, init: [[FAKE_WAKE_LOCK]] });
  await armSurprise(page);
  await page.locator('#startBtn').click();
  await finish(page);
  await page.clock.runFor(9000);
  await page.evaluate(() => { document.getElementById('durationSelect').value = '300'; });   // for the next round
  await page.locator('#pauseBtn').click();   // Restart, inside the minute
  await page.clock.runFor(61000);
  eq(await held(page), 1, 'the screen is still on a minute into the new round');
  await page.locator('#resetBtn').click();
  eq(await held(page), 0, 'Reset lets go');
});

test('a lock granted late is not kept', async ({ openPage }) => {
  const page = await openPage({ init: [[FAKE_WAKE_LOCK]] });
  await armSurprise(page);
  await page.evaluate(() => {                // both before the request resolves
    document.getElementById('startBtn').click();
    document.getElementById('resetBtn').click();
  });
  eq(await held(page), 0, 'Start then Reset straight away leaves nothing held');
});

const sounding = page => page.evaluate(() => window.__audio.oscillators.filter(o => !o.silenced).length);

test('Reset and Restart cut the done chime short', async ({ openPage }) => {
  for (const button of ['#resetBtn', '#pauseBtn']) {
    const page = await openPage({ clock: true, init: [[FAKE_AUDIO]] });
    await armSurprise(page);
    await page.evaluate(() => { document.getElementById('soundToggle').checked = true; });
    await page.locator('#startBtn').click();
    await finish(page);
    ok(await sounding(page) >= 16, 'the done chime is ringing');
    await page.locator(button).click();
    const left = await sounding(page);
    eq(left, button === '#resetBtn' ? 0 : 4, `${button}: only a new round's own start chime is left (${left} notes)`);
  }
});

for (const state of ['suspended', 'interrupted']) {
  test(`the chime still plays when iOS has left the audio ${state}`, async ({ openPage }) => {
    const page = await openPage({ clock: true, init: [[FAKE_AUDIO]] });
    await armSurprise(page);
    await page.evaluate(() => { document.getElementById('soundToggle').checked = true; });
    await page.evaluate(s => { window.__audio.state = s; }, state);
    await page.locator('#startBtn').click();
    const a = await page.evaluate(() => ({ resumed: window.__audio.resumed, started: window.__audio.started }));
    ok(a.resumed >= 1, 'the context is resumed inside the tap');
    eq(a.started, 4, 'and then the start chime is scheduled');
  });
}

test('an uploaded photo is scaled once, not on every frame', async ({ openPage }) => {
  const page = await openPage({
    clock: true,
    init: [[() => {
      window.__photoDraws = 0;
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (src, ...rest) {
        if (src instanceof HTMLImageElement && !/svg/.test(src.src.slice(0, 30))) window.__photoDraws++;
        return draw.call(this, src, ...rest);
      };
    }]],
  });
  await page.locator('#imageInput').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: TINY_PNG });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await shortDuration(page);
  await page.evaluate(() => { document.getElementById('soundToggle').checked = false; window.__photoDraws = 0; });
  await page.locator('#startBtn').click();
  await finish(page);
  eq(await page.evaluate(() => window.__photoDraws), 0, 'the full-size photo is not redrawn while the timer runs');
});
