import {
  test, ok, eq, finish, armSurprise, RUN_S, TILE, ANIMAL_NAMES, FOOD_NAMES, WORD_NAMES, PATTERN_NAMES, ALL_NAMES, N, TOTAL,
} from './helpers.mjs';

test('surprise animals', async ({ openPage }) => {
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
  eq(tile.label, 'An animal', 'there is an animal surprise tile');
  ok(/surprise/.test(tile.cls), 'the surprise tile is marked as such');

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
  eq(previewSigs.size, 1, 'the preview never varies, so it cannot leak the animal');
});

// Sixteen runs back to back on one page — the suite's longest single stretch,
// and the reason the buttons here are clicked from inside the page rather than
// through a locator: a real mouse click costs ~30ms of actionability checks
// each time, and what is under test is which animal comes back, not hit
// testing. The other tests still click for real.
test('every animal turns up exactly once', async ({ openPage }) => {
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
      ok(shown.visible, 'the animal name shows once the picture is revealed');
      ok(shown.badge, 'a first-time animal is flagged NEW');
      ok(shown.sig > 50, `the revealed animal actually draws (variance ${shown.sig.toFixed(0)})`);
    }
    revealed.push(shown.text.replace(/^NEW/, ''));
  }
  const unknown = revealed.filter(n => !ANIMAL_NAMES.includes(n));
  ok(unknown.length === 0, `every reveal is a known animal${unknown.length ? ': ' + unknown.join(', ') : ''}`);
  eq(new Set(revealed).size, ANIMAL_NAMES.length,
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
  eq(full.count, `${N} of ${TOTAL}`, 'the counter counts every animal');
  eq(full.tiles, TOTAL, 'the collection has a tile for everything, in every category');
  eq(full.found, N, 'every animal tile is unlocked once every animal is found');
  ok(full.heads.some(h => h.indexOf(`Animals · ${N} of ${N}`) === 0 && /⭐/.test(h)),
    `the Animals heading celebrates a complete set (got ${JSON.stringify(full.heads)})`);
});

// The name must not appear before the reveal.
test('the animal stays secret until the end', async ({ openPage }) => {
  const page = await openPage({ clock: true });
  await armSurprise(page);
  await page.locator('#startBtn').click();
  await page.clock.runFor(RUN_S * 500);
  const midRun = await page.evaluate(() =>
    /visible/.test(document.getElementById('revealName').className));
  ok(!midRun, 'the name stays hidden while the timer is still running');
  await finish(page);
});

// Past the end of the set the pool reopens, so the surprise keeps working
// rather than sticking on one animal forever. The full collection is seeded
// here rather than played for — that it can be played for is the test
// above's job.
test('a complete collection keeps giving animals', async ({ openPage }) => {
  const page = await openPage({
    clock: true,
    init: [[names => {
      window.localStorage.setItem('revealTimer.animals.v1', JSON.stringify({ found: names }));
    }, ANIMAL_NAMES]],
  });
  await armSurprise(page);
  eq(await page.evaluate(() => document.getElementById('collectionCount').textContent),
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
  ok(afterFull.every(r => ANIMAL_NAMES.includes(r.text)),
    'a complete collection still reveals animals instead of stalling');
  ok(afterFull.every(r => !r.badge), 'an animal you already have is not flagged NEW again');
});

// Everything has to survive being redrawn at tile size: the collection is
// where a drawing is smallest, and a blank or duplicated tile there is the
// failure mode a rework of one animal (the Fox, say) would produce.
test('everything draws at tile size', async ({ openPage }) => {
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
  eq(JSON.stringify(tiles.map(x => x.name)), JSON.stringify(ALL_NAMES), 'everything has a tile, category by category');
  const faint = tiles.filter(x => x.variance < 50);
  ok(faint.length === 0, faint.length
    ? `things that barely draw at tile size: ${faint.map(x => `${x.name} (${x.variance.toFixed(0)})`).join(', ')}`
    : 'nothing renders blank or near-blank at tile size');
  eq(new Set(tiles.map(x => x.sig)).size, TOTAL,
    'no two things draw the same picture');
});

// Found animals are kept; unfound ones must not be drawn anywhere.
test('a found animal is kept', async ({ openPage }) => {
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
  eq(kept.count, `1 of ${TOTAL}`, 'a found animal survives a reload');
  eq(kept.foundCount, 1, 'exactly the one animal is unlocked');
  eq(kept.lockedVariants, 1, 'every locked tile draws the same placeholder — no spoilers');
  eq(kept.lockedLabels, TOTAL - 1, 'every locked tile shows its own name: only the picture is kept back');
  ok(kept.mineIsDrawn, 'the found animal is drawn, not placeholdered');
  ok(kept.mineOpens, 'tapping a found animal opens it full size');
});

// starting a run from the collection
//
// Tapping an animal you've already found should let you run the timer with it
// again. The surprise is untouched: only found animals are tappable at all, and
// a found animal is one whose name the collection is already showing.
test('start from the collection', async ({ openPage }) => {
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
  ok(zoom.open, 'tapping a found animal still opens it full size');
  ok(zoom.startVisible && zoom.startText.includes(won),
    `the zoom view offers to start the timer with it (got "${zoom.startText}")`);

  await page.locator('#zoomStart').click();
  const started = await page.evaluate(() => ({
    sheet: document.getElementById('collectionSheet').className,
    timer: document.getElementById('timerView').className,
    setup: document.getElementById('setup').style.display,
  }));
  eq(started.sheet, 'sheet', 'starting from the sheet closes it');
  eq(started.timer, 'timer-view active', 'the timer view takes over');
  eq(started.setup, 'none', 'the setup screen is hidden');

  await finish(page);
  await page.waitForTimeout(30);
  const ran = await page.evaluate(() => ({
    text: document.getElementById('revealName').textContent,
    visible: /visible/.test(document.getElementById('revealName').className),
    badge: !!document.querySelector('#revealName .new-badge'),
    count: document.getElementById('collectionCount').textContent,
  }));
  eq(ran.text, won, 'the run reveals the animal that was tapped, not a random one');
  ok(ran.visible, 'its name shows at the reveal');
  ok(!ran.badge, 'an animal you already had is not flagged NEW again');
  eq(ran.count, `1 of ${TOTAL}`, 'replaying an animal does not change the collection');

  // Back on the setup screen the picked animal is the current selection, named,
  // so Start repeats it without going through the sheet again.
  await page.locator('#resetBtn').click();
  const onSetup = await page.evaluate(() => ({
    label: document.getElementById('previewLabel').textContent,
    labelShown: /visible/.test(document.getElementById('previewLabel').className),
    enabled: !document.getElementById('startBtn').disabled,
    tileSelected: !!document.querySelector('.art-thumb-wrap.selected'),
  }));
  eq(onSetup.label, won, 'the setup screen names the picked animal');
  ok(onSetup.labelShown, 'that label is visible');
  ok(onSetup.enabled, 'Start is enabled with an animal picked');
  ok(!onSetup.tileSelected, 'no surprise tile is left looking selected');

  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  eq(await page.evaluate(() => document.getElementById('revealName').textContent), won,
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
  eq(restored.label, won, 'a picked animal comes back after a reload');
  ok(restored.enabled && restored.previewDrawn, 'the restored animal is previewed and startable');

  // Switching to another surprise drops the animal — otherwise Start would
  // quietly run the animal while the preview showed the food tile.
  await armSurprise(page, TILE.food);
  const labelAfter = await page.evaluate(() => /visible/.test(document.getElementById('previewLabel').className));
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  const afterFood = await page.evaluate(() => document.getElementById('revealName').textContent.replace(/^NEW/, ''));
  ok(FOOD_NAMES.includes(afterFood), `picking the food surprise afterwards clears the chosen animal (got "${afterFood}")`);
  ok(!labelAfter, 'the animal name label goes away with it');
});

// picking an animal from the collection without starting
//
// "Start timer with X" was the only button in the zoom view, so meeting an
// animal you'd already found and just wanting to look at it, or line up a
// different duration/background first, meant starting a run to get there.
test('select an animal without starting the timer', async ({ openPage }) => {
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
  eq(picked.sheet, 'sheet', 'selecting closes the collection sheet');
  eq(picked.timer, 'timer-view', 'the timer is not started');
  eq(picked.setup, '', 'the setup screen is showing, not hidden');
  eq(picked.label, won, 'the setup screen names the picked animal');
  ok(picked.labelShown, 'that label is visible');
  ok(picked.enabled, 'Start is enabled, ready for a deliberate tap');

  // Only pressing Start now actually runs it, with the animal that was picked.
  await page.locator('#startBtn').click();
  await finish(page);
  await page.waitForTimeout(30);
  eq(await page.evaluate(() => document.getElementById('revealName').textContent), won,
    'Start afterwards runs the picked animal, not a fresh surprise');
});

// An animal you haven't found has no way in: its tile is inert, and a saved
// selection naming one is ignored rather than put on screen.
test('an unfound animal has no way in', async ({ openPage }) => {
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
      // The collection lists every name; what must not happen is the saved one
      // being put on the setup screen as though it had been earned.
      preview: document.getElementById('previewLabel').textContent,
      setup: document.getElementById('setup').innerText,
    };
  });
  eq(guarded.lockedCount, TOTAL, 'a cleared collection locks everything again');
  ok(!guarded.zoomOpen, 'a locked tile cannot be opened');
  ok(guarded.startDisabled, 'a saved animal that is no longer found is not restored');
  ok(!guarded.labelShown, 'nothing on the setup screen names it');
  eq(guarded.preview, '', 'the unfound animal is not picked');
  ok(!/Shark/.test(guarded.setup), 'the unfound animal is not named on the setup screen');
});

// Once every animal has been found the surprise can't hand back a new one, and
// it used to draw uniformly from all sixteen — a 1-in-16 chance of repeating
// the animal you just had, and typically 13 of the 16 over a week of reveals.
// It now deals from a shuffled deck, so the three properties below hold:
// sixteen runs give sixteen different animals, the deck survives a reload
// rather than re-dealing from a full set, and a reshuffle never puts the animal
// you just saw back on top.
test('past the end of the set the surprise deals from a deck', async ({ openPage }) => {
  const KEY = 'revealTimer.animals.v1';

  // Seeded through the page rather than through an init script, because an init
  // script runs again on every navigation — including the reloads below, where
  // re-writing the key would wipe the very deck being tested. (Guarding the
  // write on "is the key empty?" is not enough: at document start on a file://
  // page that read comes back empty often enough to fail about one run in
  // three.) Loading this app is the expensive part of the test — thirty-odd
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
    return { dealt, left, resumed };
  };

  // Half two: the seam between one pass and the next. The deck is seeded with a
  // single card, so the run after it has to reshuffle. It's seeded in the old
  // single-deck format on purpose: that's what an existing save holds.
  const seam = async () => {
    const page = await armed({ found: ANIMAL_NAMES, deck: [ANIMAL_NAMES[0]] });
    const lastOfPass = await page.runOnce();
    const firstOfNext = await page.runOnce();
    return { lastOfPass, firstOfNext };
  };

  const [a, b] = await Promise.all([pass(), seam()]);

  ok(a.dealt.every(n => ANIMAL_NAMES.includes(n)), 'every deal is a known animal');
  eq(new Set(a.dealt).size, a.dealt.length, 'four deals in a row, four different animals');
  eq(a.left.length, ANIMAL_NAMES.length - a.dealt.length, 'the rest of the set is still in the deck');
  ok(a.left.every(n => a.dealt.indexOf(n) < 0),
    'and holds exactly what has not been dealt, so a pass cannot repeat one');
  ok(a.left.indexOf(a.resumed) >= 0,
    `the deck survives a reload rather than re-dealing from a full set (got "${a.resumed}")`);
  eq(b.lastOfPass, ANIMAL_NAMES[0], 'the last card of a pass is the one that was left in the deck');
  ok(b.firstOfNext !== b.lastOfPass,
    `a reshuffle doesn't deal the animal you just saw (got "${b.firstOfNext}" after "${b.lastOfPass}")`);
});

// every category's surprise deals from that category
test('each surprise tile deals from its own category', async ({ openPage }) => {
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
    return { cat, names, got, count };
  }));
  for (const r of results) {
    ok(r.got.every(n => r.names.includes(n)), `${r.cat}: every reveal comes from that category (${r.got.join(', ')})`);
    eq(new Set(r.got).size, 3, `${r.cat}: three runs, three different things`);
    eq(r.count, `3 of ${TOTAL}`, `${r.cat}: each one is added to the collection`);
  }
});
