import {
  test, ok, eq, finish, armSurprise, TILE, TILE_LABELS, BLOCK_LOCALSTORAGE, TOTAL,
} from './helpers.mjs';

// every surprise tile actually draws something (thumbnails)
test('surprise tiles', async ({ openPage }) => {
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
  eq(JSON.stringify(thumbs.map(x => x.name)), JSON.stringify(TILE_LABELS), 'one surprise tile per category, "Anything" first');
  const blank = thumbs.filter(t2 => t2.variance < 50);
  ok(blank.length === 0, blank.length ? `tiles with near-blank thumbnails: ${blank.map(b => b.name).join(', ')}` : 'no tile rendered blank/broken');
  eq(new Set(thumbs.map(x => Math.round(x.variance))).size, thumbs.length, 'the tiles all look different');
});

// light background swatches flip text contrast
test('background swatches', async ({ openPage }) => {
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
  eq(after.bodyClass, 'light-bg', 'body gets light-bg class when a light swatch is selected');
  ok(after.fg !== darkSwatch, `text color flips for contrast on light background (was ${darkSwatch}, now ${after.fg})`);
});

// settings survive a reload
test('saved settings', async ({ openPage }) => {
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
  eq(after.art, artName, 'the same preset comes back selected');
  eq(after.bg, savedBg, 'the same background comes back selected');
  eq(after.bodyClass, 'light-bg', 'a restored light background re-applies light-bg');
  eq(after.duration, '600', 'duration is restored');
  eq(after.sound, false, 'sound toggle is restored');
  ok(after.startEnabled, 'restored preset leaves Start enabled');
  ok(after.canvasHasArt, 'restored preset is re-rendered into the preview');

  // A blocked/throwing localStorage (Safari private mode) must not break the app.
  const blocked = await openPage({ init: [[BLOCK_LOCALSTORAGE]] });
  await blocked.locator('.art-thumb-wrap').nth(1).click();
  const enabled = await blocked.evaluate(() => !document.getElementById('startBtn').disabled);
  ok(enabled ,
    `app still works when localStorage throws`);
});

// the surprise tiles fit one row; nothing scrolls sideways
test('layout', async ({ openPage }) => {
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
  eq(layout.rows, 1, 'all five surprise tiles fit in one row on a phone');
  ok(!layout.overflowsSideways, 'the tile strip has no sideways scroll');
  ok(!layout.pageOverflows, 'page has no horizontal scroll');
  eq(layout.swatchRows, 2, 'backgrounds are split into two rows');
  eq(JSON.stringify(layout.perRow), JSON.stringify([6, 6]), 'six swatches in each row');
});

// everything you need is on screen on a phone, either way up
// iPhone 15: Safari's visible area is ~393x659 upright and ~852x323 on its
// side. Upright, Start used to sit ~200px below the fold; on its side the
// countdown and half the picture were off-screen while the timer ran.
test('fits a phone screen', async ({ openPage }) => {
  const inView = (id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5;
  };
  for (const [label, viewport] of [['upright', { width: 393, height: 659 }], ['on its side', { width: 852, height: 323 }]]) {
    const page = await openPage({ viewport });
    ok(await page.evaluate(inView, 'startBtn'), `${label}: Start is on screen without scrolling`);
    await page.locator('.art-thumb-wrap').nth(1).click();
    await page.locator('#startBtn').click();
    const seen = await page.evaluate((ids) => ids.map(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return [id, r.top >= 0 && r.bottom <= innerHeight + 0.5];
    }), ['timeDisplay', 'canvas', 'pauseBtn', 'resetBtn']);
    const off = seen.filter(([, ok]) => !ok).map(([id]) => id);
    ok(off.length === 0, `${label}: countdown, picture and buttons all on screen${off.length ? ' (off: ' + off.join(', ') + ')' : ''}`);
    ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), `${label}: the running timer doesn't scroll`);
  }
});

// swatch colours are actually distinguishable
test('background palette', async ({ openPage }) => {
  const page = await openPage();
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.bg-row')].map(r =>
      [...r.querySelectorAll('.bg-swatch')].map(s => ({
        bg: s.getAttribute('data-bg'),
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
    ok(min >= 40, `row ${ri}: closest pair is still distinguishable (${pair}, distance ${min.toFixed(0)})`);
  }
  ok(rows[0].every(s => !s.light), 'first row is the dark set');
  ok(rows[1].every(s => s.light), 'second row is the light set');
  ok(rows[1].some(s => s.bg === '#e0f2fe'), 'the light blue is left exactly as it was');
});

// press-and-hold can't start a text selection
test('touch handling', async ({ openPage }) => {
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
    eq(v, 'none', `${name} is not text-selectable on press-and-hold`);
  }
  ok(sel.select === 'text' || sel.select === 'auto', `form fields stay selectable (got ${sel.select})`);
});

// Surprise mode is chosen often enough to be worth restoring, and a throwing
// localStorage must not take the collection (or the app) down with it.
test('surprise mode survives', async ({ openPage }) => {
  const page = await openPage();
  await page.locator('.art-thumb-wrap').nth(TILE.animal).click();
  await page.reload();
  const restored = await page.evaluate(() => {
    const w = document.querySelector('.art-thumb-wrap.selected');
    return { label: w && w.querySelector('span').textContent, enabled: !document.getElementById('startBtn').disabled };
  });
  eq(restored.label, 'An animal', 'surprise mode is restored on reload');
  ok(restored.enabled, 'restored surprise mode leaves Start enabled');

  const blocked = await openPage({ clock: true, init: [[BLOCK_LOCALSTORAGE]] });
  await armSurprise(blocked);
  await blocked.locator('#startBtn').click();
  await finish(blocked);
  await blocked.waitForTimeout(30);
  const shown = await blocked.evaluate(() => document.getElementById('revealName').textContent);
  ok(shown.length > 0 ,
    `surprise still reveals when localStorage throws`);
});

// saves from before categories still load
// The old app saved "__surprise__" for the animal surprise, "animal:Fox" for a
// picked animal, and a bare name for a preset pattern. A pattern that was the
// saved selection was in use, so it comes back as found rather than vanishing.
// Whatever is in storage, the app has to start.
test('a corrupt save is ignored', async ({ openPage }) => {
  for (const junk of ['not json', '5', '"text"', 'null', '[]', '{"found":7,"decks":3,"lastShown":"x","deck":1,"art":{},"bg":[],"duration":{}}']) {
    const page = await openPage();
    await page.evaluate(v => {
      window.localStorage.setItem('revealTimer.settings.v1', v);
      window.localStorage.setItem('revealTimer.animals.v1', v);
    }, junk);
    await page.reload();
    eq(await page.locator('.art-thumb-wrap').count(), 5, `${junk}: the tiles are there`);
    await armSurprise(page);
    await page.locator('#startBtn').click();
    ok(await page.locator('#timerView').isVisible(), `${junk}: a round starts`);
  }
});

test('older saves carry over', async ({ openPage }) => {
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
    return out;
  };
  const base = { bg: '#111827', duration: '300', sound: false };
  const [surprise, animal, pattern] = await Promise.all([
    load({ ...base, art: '__surprise__' }, { found: ['Fox', 'Cat'], deck: ['Owl'], last: 'Fox' }),
    load({ ...base, art: 'animal:Cat' }, { found: ['Fox', 'Cat'] }),
    load({ ...base, art: 'Mandala' }, null),
  ]);
  eq(surprise.tile, 'An animal', 'the old surprise setting selects the animal surprise');
  eq(surprise.count, `2 of ${TOTAL}`, 'animals found before categories are still found');
  eq(animal.label, 'Cat', 'an old picked animal is still picked');
  eq(pattern.label, 'Mandala', 'an old preset pattern is still picked');
  eq(pattern.count, `1 of ${TOTAL}`, 'and counts as found');
  ok([surprise, animal, pattern].every(r => r.enabled), 'Start is enabled in every case');
});
