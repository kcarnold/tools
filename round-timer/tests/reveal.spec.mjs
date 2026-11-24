import {
  test, ok, eq, shortDuration, pickFound,
} from './helpers.mjs';

const REVEAL_COUNT = 4;

test('the picture comes off four different ways', async ({ openPage }) => {
  // A pixel counts as masked when it is within a channel's tolerance of the
  // mask colour. The run uses the Sand background (a near-white mask) over the
  // Mandala artwork (near-black), so no part of the picture can be mistaken
  // for the mask — which is what makes a plain pixel count trustworthy here.
  const COVER = () => {
    const c = document.getElementById('canvas');
    const S = c.width, R = S / 2;
    const d = c.getContext('2d').getImageData(0, 0, S, S).data;
    const m = document.querySelector('.bg-swatch.selected').getAttribute('data-bg')
      .match(/[0-9a-f]{2}/g).map(h => parseInt(h, 16));
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
  // This is the one test that samples a run *part way through*, and
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
    return { full, half, quarter };
  };

  const runs = await Promise.all([...Array(REVEAL_COUNT).keys()].map(trial));
  runs.forEach((r, i) => {
    ok(r.full.cover > 0.95,
      `pattern ${i}: the picture starts completely hidden (${(r.full.cover * 100).toFixed(0)}% covered)`);
    ok(r.half.cover > 0.40 && r.half.cover < 0.60,
      `pattern ${i}: half the round left means about half the picture is still hidden (${(r.half.cover * 100).toFixed(0)}%)`);
    ok(r.quarter.cover > 0.17 && r.quarter.cover < 0.33,
      `pattern ${i}: a quarter left means about a quarter still hidden (${(r.quarter.cover * 100).toFixed(0)}%)`);
  });
  eq(new Set(runs.map(r => r.half.sig)).size, REVEAL_COUNT,
    'the four patterns hide four visibly different shapes');
  // What the iris and the tiles are for. The wedge and the curtain have both
  // opened the middle by half time, which is the behaviour these two exist to
  // vary — an animal you can name at half time has no surprise left in it.
  const faceLast = runs.filter(r => r.half.core > 0.9).length;
  ok(faceLast >= 2,
    `at least two patterns still hide the middle of the picture at half time (${faceLast} of ${REVEAL_COUNT} do)`);
  const faceStillLast = runs.filter(r => r.quarter.core > 0.7).length;
  ok(faceStillLast >= 2,
    `and still mostly hide it with a quarter of the round left (${faceStillLast} of ${REVEAL_COUNT} do)`);
});

// the tiles pattern has no seams between covered cells
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
test('the tiles pattern has no seams between covered cells', async ({ openPage }) => {
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
    const m = document.querySelector('.bg-swatch.selected').getAttribute('data-bg')
      .match(/[0-9a-f]{2}/g).map(h => parseInt(h, 16));
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
  ok(result.checked > 1000, `plenty of covered/covered pixel pairs to check (${result.checked})`);
  ok(result.maxJump < 4, `no visible seam between covered tiles (largest single-pixel jump: ${result.maxJump})`);
});
