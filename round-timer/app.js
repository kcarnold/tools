/* The setup screen and the timer. */
(function (RT) {
  'use strict';

  var $ = RT.dom.byId, el = RT.dom.el, render = RT.dom.render, drawRound = RT.dom.drawRound;
  var catalog = RT.catalog, collection = RT.collection;

  var startBtn    = $('startBtn');
  var durationSel = $('durationSelect');
  var soundToggle = $('soundToggle');
  var imageInput  = $('imageInput');
  var timeDisplay = $('timeDisplay');
  var pauseBtn    = $('pauseBtn');
  var revealName  = $('revealName');
  var wakeBanner  = $('wakeBanner');
  var canvas      = $('canvas');
  var ctx         = canvas.getContext('2d');
  var S           = canvas.width;

  function saveSettings() {
    RT.storage.saveSettings({
      art: keyOf(selection),
      bg: background.color,
      duration: durationSel.value,
      sound: !!soundToggle.checked
    });
  }

  /* ---- Background ---------------------------------------------------------- */
  var BACKGROUNDS = [
    {label: 'Dark', light: false, colors: [
      ['#111827', 'Charcoal'], ['#4c0f2a', 'Wine'], ['#5c2a06', 'Rust'],
      ['#15522c', 'Forest'], ['#0e4a5a', 'Teal'], ['#2b1b63', 'Indigo']]},
    {label: 'Light', light: true, colors: [
      ['#ffedd5', 'Sand'], ['#f9a8d4', 'Pink'], ['#e0f2fe', 'Sky'],
      ['#bbf7d0', 'Mint'], ['#c4b5fd', 'Lavender'], ['#fef08a', 'Butter']]}
  ];
  var backgrounds = [];     /* {color, light, swatch}, in order */
  var background;           /* the one in use                   */

  function showBackground(bg) {
    background = bg;
    backgrounds.forEach(function(b) { b.swatch.classList.toggle('selected', b === bg); });
    document.body.style.background = bg.color;
    /* The pinned Start bar paints over the content scrolling under it, so it */
    /* needs the page colour too.                                             */
    document.body.style.setProperty('--page-bg', bg.color);
    document.body.classList.toggle('light-bg', bg.light);
  }

  BACKGROUNDS.forEach(function(row) {
    var rowEl = el('div', 'bg-row');
    rowEl.appendChild(el('span', 'bg-row-label', row.label));
    row.colors.forEach(function(c) {
      var swatch = el('div', 'bg-swatch');
      swatch.title = c[1];
      swatch.style.background = c[0];
      swatch.setAttribute('data-bg', c[0]);
      if (row.light) swatch.setAttribute('data-light', '1');
      var bg = {color: c[0], light: row.light, swatch: swatch};
      swatch.addEventListener('click', function() { showBackground(bg); saveSettings(); });
      backgrounds.push(bg);
      rowEl.appendChild(swatch);
    });
    $('bgRows').appendChild(rowEl);
  });

  /* ---- Selection ------------------------------------------------------------ */
  /* What Start will run. One of:                                               */
  /*   {kind: 'surprise', cat}    what it reveals isn't chosen until Start      */
  /*   {kind: 'item', item}       a found thing picked from the collection      */
  /*   {kind: 'upload', fileName}                                               */
  /* each with the picture to show for it. null until something is picked.      */
  var selection = null;
  var tiles = {};           /* category id -> its surprise tile */

  function surprise(cat) {
    return {kind: 'surprise', cat: cat, picture: render(function(c, size) { RT.art.surprise(c, size, cat); }, S)};
  }

  function pickedItem(item) {
    return {kind: 'item', item: item, picture: render(item.fn, S)};
  }

  /* The middle of a photo, at the size it's shown. Once, on loading: scaling a */
  /* 12-megapixel photo on every frame is more than an old iPad can do.         */
  function upload(img, fileName) {
    var picture = render(function(c) {
      var scale=Math.max(S/img.width, S/img.height), w=img.width*scale, h=img.height*scale;
      c.drawImage(img,(S-w)/2,(S-h)/2,w,h);
    }, S);
    return {kind: 'upload', fileName: fileName, picture: picture};
  }

  /* How a selection is saved. An upload isn't: a photo would blow the quota. */
  function keyOf(sel) {
    if (sel && sel.kind === 'surprise') return 'surprise:' + sel.cat.id;
    if (sel && sel.kind === 'item') return 'item:' + sel.item.name;
    return null;
  }

  function fromKey(key) {
    var i = (key || '').indexOf(':'), kind = (key || '').slice(0, i), rest = (key || '').slice(i+1);
    if (kind === 'surprise') {
      var cat = catalog.catById(rest);
      return cat && surprise(cat);
    }
    if (kind === 'item') {
      /* Only if it's still found: otherwise this would put something they      */
      /* haven't earned on the setup screen, named.                             */
      var item = catalog.itemByName(rest);
      return item && collection.isFound(item) ? pickedItem(item) : null;
    }
    return null;
  }

  function showSelection(sel) {
    selection = sel;
    Object.keys(tiles).forEach(function(id) {
      tiles[id].classList.toggle('selected', sel.kind === 'surprise' && sel.cat.id === id);
    });
    var preview = $('previewCanvas'), label = $('previewLabel');
    drawRound(preview.getContext('2d'), preview.width, sel.picture);
    $('previewWrap').classList.add('visible');
    label.textContent = sel.kind === 'item' ? sel.item.name : '';
    label.classList.toggle('visible', sel.kind === 'item');
    $('uploadLabel').textContent = sel.kind === 'upload' ? 'Loaded: ' + sel.fileName : 'Upload your own photo';
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
  }

  function select(sel) { showSelection(sel); saveSettings(); }

  /* One tile per category, "Anything" first. Picking one shows its "?", not    */
  /* what's behind it.                                                          */
  [catalog.any].concat(catalog.categories).forEach(function(cat) {
    var tile = el('div', 'art-thumb-wrap surprise');
    tile.appendChild(render(function(c, size) { RT.art.surprise(c, size, cat); }, 62));
    tile.appendChild(el('span', '', cat.tile));
    tile.addEventListener('click', function() { select(surprise(cat)); });
    tiles[cat.id] = tile;
    $('artRow').appendChild(tile);
  });

  imageInput.addEventListener('change', function() {
    var file = imageInput.files && imageInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var image = new Image();
      image.onload = function() { select(upload(image, file.name)); };
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---- Phase ---------------------------------------------------------------- */
  /* setup -> running <-> paused, running -> celebrating -> done. Everything     */
  /* that depends on which of these it is gets set here and nowhere else.        */
  var LINGER = 60000;       /* the screen stays on this long after the celebration, to look */
  var phase = 'setup';
  var frameId = null;
  var run = null;           /* the round under way, or just finished */

  function isFinished() { return phase === 'celebrating' || phase === 'done'; }

  /* The screen and the audio are kept going until the last of the chime. */
  function isAwake() { return phase === 'running' || phase === 'celebrating'; }

  function setPhase(next) {
    var wasAwake = isAwake();
    phase = next;

    $('setup').style.display = phase === 'setup' ? '' : 'none';
    $('timerView').classList.toggle('active', phase !== 'setup');
    timeDisplay.classList.toggle('done', isFinished());

    pauseBtn.textContent = isFinished() ? '↻ Restart' : phase === 'paused' ? '▶ Resume' : 'Pause';
    pauseBtn.classList.toggle('paused', phase === 'paused');
    pauseBtn.classList.toggle('done', isFinished());

    if (isAwake() && !wasAwake) RT.wakeLock.acquire();
    if (phase === 'done') RT.wakeLock.releaseAfter(LINGER);
    else if (!isAwake()) RT.wakeLock.release();
    if (isAwake() !== wasAwake) RT.audio.keepAlive(isAwake());

    cancelAnimationFrame(frameId);
    if (phase === 'running') frameId = requestAnimationFrame(tick);
    if (phase === 'celebrating') frameId = requestAnimationFrame(celebrate);
  }

  /* The browser takes the lock away when the page is hidden. */
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && isAwake()) {
      RT.wakeLock.acquire();
      RT.audio.resume();
    }
  });

  /* ---- A round -------------------------------------------------------------- */
  /* A surprise is chosen here, not when its tile was tapped, so nothing on      */
  /* screen before the reveal can give it away.                                  */
  function beginRun() {
    if (!selection) return;
    RT.audio.stopChime();
    if (soundToggle.checked) RT.audio.playStart();
    saveSettings();

    var item = selection.kind === 'surprise' ? collection.pickSurprise(selection.cat) : selection.item;
    var totalMs = parseInt(durationSel.value,10)*1000;
    run = {
      item: item || null,   /* named when revealed; an upload has none */
      picture: selection.kind === 'surprise' ? render(item.fn, S) : selection.picture,
      reveal: RT.reveals.pick(),
      totalMs: totalMs, remainingMs: totalMs,
      lastTime: Date.now(),
      celebration: null, celebrationStart: 0
    };
    revealName.classList.remove('visible');
    wakeBanner.classList.toggle('visible', !RT.wakeLock.supported);
    setPhase('running');
  }

  function drawFrame(fraction) {
    drawRound(ctx, S, run.picture);
    if (fraction <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.arc(S/2,S/2,S/2,0,Math.PI*2); ctx.clip();
    /* Opaque, so that overlapping or touching fills can't show a seam. */
    run.reveal(ctx, S, fraction, background.color);
    ctx.restore();
  }

  function pad(n) { return n<10 ? '0'+n : ''+n; }

  /* Tapping the time switches each part (h, m, s) to binary, and back. */
  var showBinary = false;

  function showTime(ms) {
    var s=Math.ceil(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
    if (showBinary) {
      timeDisplay.textContent = (h>0 ? h.toString(2)+':' : '') + m.toString(2) + ':' + (s%60).toString(2);
      return;
    }
    timeDisplay.textContent = (h>0 ? pad(h)+':' : '') + pad(m) + ':' + pad(s%60);
  }

  function tick() {
    var now = Date.now();
    run.remainingMs = Math.max(0, run.remainingMs - (now-run.lastTime));
    run.lastTime = now;
    drawFrame(run.remainingMs/run.totalMs);
    showTime(run.remainingMs);
    if (run.remainingMs <= 0) finishRun();
    else frameId = requestAnimationFrame(tick);
  }

  function finishRun() {
    if (soundToggle.checked) RT.audio.playDone();
    if (run.item) {
      var isNew = collection.markFound(run.item);
      RT.sheet.updateCount();
      revealName.innerHTML = '';
      if (isNew) revealName.appendChild(el('span', 'new-badge', 'NEW'));
      revealName.appendChild(document.createTextNode(run.item.name));
      revealName.classList.add('visible');
    }
    drawFrame(0);
    run.celebration = RT.celebrations.start(ctx, S);
    run.celebrationStart = Date.now();
    setPhase('celebrating');
  }

  function celebrate() {
    var elapsed = Date.now()-run.celebrationStart;
    drawFrame(0);
    if (elapsed >= RT.celebrations.DURATION) { setPhase('done'); return; }
    run.celebration(elapsed);
    frameId = requestAnimationFrame(celebrate);
  }

  startBtn.addEventListener('click', beginRun);

  timeDisplay.addEventListener('click', function() {
    showBinary = !showBinary;
    if (run) showTime(run.remainingMs);
  });

  pauseBtn.addEventListener('click', function() {
    if (phase === 'running') {
      setPhase('paused');
    } else if (phase === 'paused') {
      run.lastTime = Date.now();
      setPhase('running');
    } else if (isFinished()) {
      /* Restart: the same again, on a different-coloured background. */
      showBackground(backgrounds[Math.floor(Math.random()*backgrounds.length)]);
      beginRun();
    }
  });

  $('resetBtn').addEventListener('click', function() {
    RT.audio.stopChime();
    revealName.classList.remove('visible');
    ctx.clearRect(0,0,S,S);
    setPhase('setup');
  });

  $('wakeBannerClose').addEventListener('click', function() {
    wakeBanner.classList.remove('visible');
  });

  durationSel.addEventListener('change', saveSettings);
  soundToggle.addEventListener('change', saveSettings);

  RT.sheet.init({
    onSelect: function(item) { select(pickedItem(item)); },
    onStart:  function(item) { select(pickedItem(item)); beginRun(); }
  });

  /* ---- Restore last-used settings ------------------------------------------- */
  (function restore() {
    var s = RT.storage.loadSettings();
    showBackground(backgrounds.filter(function(b) { return b.color === s.bg; })[0] || backgrounds[0]);
    for (var i=0; i<durationSel.options.length; i++) {
      if (durationSel.options[i].value === String(s.duration)) durationSel.selectedIndex = i;
    }
    if (typeof s.sound === 'boolean') soundToggle.checked = s.sound;
    var implied = s.impliesFound && catalog.itemByName(s.impliesFound);
    if (implied) { collection.markFound(implied); RT.sheet.updateCount(); }
    var sel = fromKey(s.art);
    if (sel) showSelection(sel);
  }());
}(window.RT));
