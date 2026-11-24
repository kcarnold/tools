(function (RT) {
  'use strict';

  var CATEGORIES = RT.catalog.categories, ANY = RT.catalog.any, ITEMS = RT.catalog.items,
      catById = RT.catalog.catById, itemByName = RT.catalog.itemByName,
      artSurprise = RT.art.surprise, artLocked = RT.art.locked, rand = RT.draw.rand;

  /* ---- DOM refs ----------------------------------------------------------- */
  var imageInput  = document.getElementById('imageInput');
  var uploadLabel = document.getElementById('uploadLabel');
  var startBtn    = document.getElementById('startBtn');
  var durationSel = document.getElementById('durationSelect');
  var soundToggle = document.getElementById('soundToggle');
  var setup       = document.getElementById('setup');
  var timerView   = document.getElementById('timerView');
  var timeDisplay = document.getElementById('timeDisplay');
  var canvas      = document.getElementById('canvas');
  var pauseBtn    = document.getElementById('pauseBtn');
  var resetBtn    = document.getElementById('resetBtn');
  var artRow      = document.getElementById('artRow');
  var previewWrap = document.getElementById('previewWrap');
  var previewCvs  = document.getElementById('previewCanvas');
  var previewLbl  = document.getElementById('previewLabel');
  var revealName  = document.getElementById('revealName');
  var collectionBtn   = document.getElementById('collectionBtn');
  var collectionCount = document.getElementById('collectionCount');
  var collectionSheet = document.getElementById('collectionSheet');
  var collectionClose = document.getElementById('collectionClose');
  var collectionGrid  = document.getElementById('collectionGrid');
  var collectionSub   = document.getElementById('collectionSub');
  var zoomView    = document.getElementById('zoomView');
  var zoomCanvas  = document.getElementById('zoomCanvas');
  var zoomName    = document.getElementById('zoomName');
  var zoomStart   = document.getElementById('zoomStart');
  var zoomSelect  = document.getElementById('zoomSelect');
  var zoomBack    = document.getElementById('zoomBack');
  var ctx         = canvas.getContext('2d');
  var pctx        = previewCvs.getContext('2d');

  /* ---- State -------------------------------------------------------------- */
  var selectedImg = null;
  var selectedArt = null;   /* name of the chosen preset, or null for an upload */
  var totalMs     = 0;
  var remainingMs = 0;
  var lastTime    = 0;
  var running     = false;
  var rafId       = null;
  var celebrating = false;
  var done        = false;   /* round finished; Pause/Resume becomes Restart */
  var celebStart  = 0;
  var CELEB_DUR   = 8000;
  var CELEB_FADE  = 1200;   /* tail of CELEB_DUR spent fading the effect out    */
  var celebFade   = 1;      /* multiplied into every effect's alpha             */
  var celebInk    = '#ffffff';  /* white on dark artwork, near-black on light   */
  var celebOnLight= false;
  var audioCtx    = null;
  var maskColor   = '17,24,39';
  var wakeLock    = null;
  var wakeLockWanted = null;  /* the request that may still set wakeLock        */
  var chimeNotes  = [];       /* oscillators scheduled and not yet silenced     */
  var chimeId     = 0;        /* bumped to drop a chime still waiting to start  */
  var keepAliveId = null;
  var wakeBanner  = document.getElementById('wakeBanner');
  var wakeBannerClose = document.getElementById('wakeBannerClose');
  var SURPRISE_KEY = 'surprise:';  /* + category id, in saved settings          */
  var ITEM_KEY     = 'item:';      /* + item name, for one picked on purpose    */
  var surpriseCat  = null;  /* the category a surprise run deals from, or null  */
  var pendingItem  = null;  /* what this run will reveal — not shown yet        */
  var chosenItem   = null;  /* a found item picked on purpose from the sheet    */

  /* The middle of a photo, at the size it's shown. Once, on loading: scaling a */
  /* 12-megapixel photo on every frame is more than an old iPad can do.         */
  function cropToSquare(img) {
    var S=canvas.width, c=document.createElement('canvas');
    c.width=S; c.height=S;
    var scale=Math.max(S/img.width, S/img.height), w=img.width*scale, h=img.height*scale;
    c.getContext('2d').drawImage(img,(S-w)/2,(S-h)/2,w,h);
    return c;
  }

  /* ---- Preview ----------------------------------------------------------- */
  function showPreview(src) {
    var ps = previewCvs.width;
    pctx.clearRect(0,0,ps,ps);
    pctx.save(); pctx.beginPath(); pctx.arc(ps/2,ps/2,ps/2,0,Math.PI*2); pctx.clip();
    pctx.drawImage(src,0,0,ps,ps);
    pctx.restore();
    previewWrap.className='preview-wrap visible';
  }

  /* Only a deliberately-picked animal is named here. Passing '' (every other  */
  /* selection, the surprise tile included) hides the label again.             */
  function setPreviewLabel(text) {
    previewLbl.textContent = text || '';
    previewLbl.className = text ? 'preview-label visible' : 'preview-label';
  }

  /* ---- Saved settings ------------------------------------------------------ */
  /* One JSON blob: chosen preset, background, duration, sound. Uploads aren't   */
  /* stored (a photo would blow the quota), so a saved upload just comes back    */
  /* as "nothing chosen yet". Every access is wrapped: Safari in private mode    */
  /* throws from localStorage rather than returning null.                       */
  var LS_KEY = 'revealTimer.settings.v1';
  var restoring = false;

  function loadSettings() {
    try {
      var raw = window.localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveSettings() {
    if (restoring) return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        art: selectedArt,
        bg: currentBg,
        duration: durationSel.value,
        sound: !!soundToggle.checked
      }));
    } catch (e) {}
  }

  /* ---- What has been found, and what comes next ------------------------------ */
  /* Its own key, not part of the settings blob: settings are preferences you'd  */
  /* happily see reset, this is a record you'd be annoyed to lose. Same wrapping */
  /* as above — Safari private mode throws rather than returning null.           */
  /* The key still says "animals" because that's what it held first; keeping it  */
  /* means nothing already found is lost. It now holds every category's finds,   */
  /* plus one deck per category (see pickSurprise). An older blob had a single   */
  /* animal deck under "deck"; that is read as the animal deck.                  */
  /* Unknown names are dropped on the way in, so a deck saved before the set     */
  /* grew (or shrank) can't hand back something that no longer exists.          */
  var LS_FOUND  = 'revealTimer.animals.v1';
  var foundList = [];
  var decks     = {};   /* category id -> names still to come in this pass      */
  var lastShown = {};   /* category id -> what it last dealt, so no repeat     */

  function knownNames(value) {
    var out = [], i;
    if (Object.prototype.toString.call(value) !== '[object Array]') return out;
    for (i=0; i<value.length; i++) {
      if (itemByName(value[i]) && out.indexOf(value[i]) < 0) out.push(value[i]);
    }
    return out;
  }

  (function loadFoundState() {
    var obj = null;
    try {
      var raw = window.localStorage.getItem(LS_FOUND);
      obj = raw ? JSON.parse(raw) : null;
    } catch (e) { obj = null; }
    if (!obj) return;
    foundList = knownNames(obj.found);
    var d = obj.decks || {}, l = obj.lastShown || {};
    if (obj.deck && !d.animal) d.animal = obj.deck;
    if (obj.last && !l.animal) l.animal = obj.last;
    for (var c=0; c<CATEGORIES.length; c++) {
      var id = CATEGORIES[c].id;
      decks[id] = knownNames(d[id]);
      if (itemByName(l[id])) lastShown[id] = l[id];
    }
  }());

  function saveFoundState() {
    try {
      window.localStorage.setItem(LS_FOUND, JSON.stringify({
        found: foundList, decks: decks, lastShown: lastShown
      }));
    } catch (e) {}
  }

  function isFound(name) {
    for (var i=0; i<foundList.length; i++) if (foundList[i] === name) return true;
    return false;
  }

  function markFound(name) {
    if (isFound(name)) return false;
    foundList.push(name);
    saveFoundState();
    return true;
  }

  function foundIn(cat) {
    var n = 0;
    for (var i=0; i<cat.items.length; i++) if (isFound(cat.items[i].name)) n++;
    return n;
  }

  /* Prefer one they haven't met: until a category is complete that alone makes */
  /* every reveal a new one. Past the end it deals from a shuffled deck per      */
  /* category instead of rolling a die — a die hands back what you just had and  */
  /* leaves some waiting for weeks — and a reshuffle never puts the one you just */
  /* saw on top. "Anything" pools every category's unfound ones; once all are   */
  /* found it picks a category at random and deals from that one's deck.        */
  function pickSurprise(catId) {
    var cats = catId === 'any' ? CATEGORIES : [catById(catId) || CATEGORIES[0]];
    var pool = [], c, i, next;
    for (c=0; c<cats.length; c++) {
      for (i=0; i<cats[c].items.length; i++) if (!isFound(cats[c].items[i].name)) pool.push(cats[c].items[i]);
    }
    if (pool.length) {
      next = pool[Math.floor(Math.random()*pool.length)];
    } else {
      var cat = cats[Math.floor(Math.random()*cats.length)];
      if (!decks[cat.id] || !decks[cat.id].length) decks[cat.id] = shuffledDeck(cat);
      next = itemByName(decks[cat.id].pop()) || cat.items[0];
    }
    lastShown[next.cat] = next.name;
    saveFoundState();
    return next;
  }

  /* Fisher-Yates over one category. The deck is dealt off the end, so it's the  */
  /* last entry that must not be the one they just saw.                          */
  function shuffledDeck(cat) {
    var deck = [], i, j, tmp;
    for (i=0; i<cat.items.length; i++) deck.push(cat.items[i].name);
    for (i=deck.length-1; i>0; i--) {
      j = Math.floor(Math.random()*(i+1));
      tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    if (deck.length > 1 && deck[deck.length-1] === lastShown[cat.id]) {
      tmp = deck[deck.length-1]; deck[deck.length-1] = deck[0]; deck[0] = tmp;
    }
    return deck;
  }

  function updateCollectionCount() {
    collectionCount.textContent = foundList.length + ' of ' + ITEMS.length;
  }

  /* ---- Background swatches ----------------------------------------------- */
  var swatches = document.querySelectorAll('.bg-swatch');
  var currentBg = '#111827';

  function selectSwatch(sw) {
    for (var k=0; k<swatches.length; k++) swatches[k].className='bg-swatch';
    sw.className='bg-swatch selected';
    currentBg = sw.getAttribute('data-bg');
    document.body.style.background = currentBg;
    /* The pinned Start bar paints over the content scrolling under it, so it */
    /* needs the page colour too.                                             */
    document.body.style.setProperty('--page-bg', currentBg);
    maskColor = sw.getAttribute('data-mask');
    if (sw.getAttribute('data-light') === '1') {
      document.body.className = 'light-bg';
    } else {
      document.body.className = '';
    }
    saveSettings();
  }

  for (var si=0; si<swatches.length; si++) {
    (function(sw) {
      sw.addEventListener('click', function() { selectSwatch(sw); });
    })(swatches[si]);
  }

  durationSel.addEventListener('change', saveSettings);
  soundToggle.addEventListener('change', saveSettings);

  /* ---- Wake Lock ----------------------------------------------------------- */
  /* Keeps the screen on while a round is running; Web Audio can otherwise get   */
  /* suspended when iOS locks the screen, silencing the reveal chime.            */
  function updateWakeBanner() {
    if (!wakeBanner) return;
    wakeBanner.className = ('wakeLock' in navigator) ? 'wake-banner' : 'wake-banner visible';
  }

  /* The lock arrives later than it's asked for, by which time it may no longer */
  /* be wanted (wakeLockWanted) or a newer one may have been asked for.         */
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    releaseWakeLock();
    var request = wakeLockWanted = {};
    try {
      navigator.wakeLock.request('screen').then(function(lock) {
        if (wakeLockWanted === request) wakeLock = lock;
        else lock.release();
      }).catch(function() {});
    } catch (e) {}
  }

  function releaseWakeLock() {
    wakeLockWanted = null;
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
  }

  if (wakeBannerClose) {
    wakeBannerClose.addEventListener('click', function() {
      wakeBanner.className = 'wake-banner';
    });
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && (running || celebrating)) {
      requestWakeLock();
      resumeAudioCtx();
    }
  });

  /* ---- Audio helpers -------------------------------------------------------- */
  /* Create the AudioContext once and hand it back. On iOS a context created    */
  /* inside a tap gesture starts unlocked; one created later starts suspended.  */
  function ensureAudioCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { audioCtx = new AC(); } catch(e) {} }
    }
    return audioCtx;
  }

  /* Resume the context and resolve only once it is actually running. iOS        */
  /* suspends the context when the page is backgrounded and only lets it resume  */
  /* inside a user gesture, so callers must wait for this before scheduling      */
  /* sound — otherwise notes are scheduled at a frozen currentTime and never     */
  /* play.                                                                       */
  function resumeAudioCtx() {
    var ctx = ensureAudioCtx();
    if (!ctx) return Promise.resolve();
    /* Anything but running: iOS also has 'interrupted' (a call, the lock screen). */
    if (ctx.state !== 'running' && ctx.resume) {
      try { return ctx.resume(); } catch (e) {}
    }
    return Promise.resolve();
  }

  /* Schedule a silent 1-sample buffer every 15s to prevent iOS from suspending  */
  /* the AudioContext while a round is running (backgrounding otherwise mutes    */
  /* the eventual reveal chime).                                                 */
  function startKeepAlive() {
    stopKeepAlive();
    keepAliveId = setInterval(function() {
      if (!audioCtx) return;
      if (audioCtx.state !== 'running') { resumeAudioCtx(); return; }
      var buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
      var src = audioCtx.createBufferSource();
      src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
    }, 15000);
  }

  function stopKeepAlive() {
    if (keepAliveId) { clearInterval(keepAliveId); keepAliveId = null; }
  }

  /* ---- Event listeners registered FIRST, before any art rendering        - */
  /* (defensive: art generation errors cannot block listener registration)    */

  imageInput.addEventListener('change', function() {
    var file = imageInput.files && imageInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var image = new Image();
      image.onload = function() {
        selectedImg=cropToSquare(image); selectedArt=null; surpriseCat=null;
        chosenItem=null;
        deselectAllArt();
        showPreview(selectedImg);
        setPreviewLabel('');
        uploadLabel.textContent='Loaded: '+file.name;
        startBtn.disabled=false; startBtn.textContent='Start';
        saveSettings();
      };
      image.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* Shared by the Start button and by "start with this one" in the collection  */
  /* sheet, so both go through exactly the same setup.                          */
  function beginRun() {
    if (!selectedImg) return;
    cancelAnimationFrame(rafId);   /* stop any celebration still animating */
    stopChime();
    if (soundToggle.checked) { ensureAudioCtx(); playStartSound(); }
    saveSettings();
    /* A surprise is chosen here, not when the tile was tapped — so nothing on   */
    /* screen between picking a surprise tile and the reveal can give it away.  */
    /* One picked from the collection is known already.                         */
    pendingItem = chosenItem;
    revealName.className = 'reveal-name';
    if (surpriseCat) {
      pendingItem = pickSurprise(surpriseCat);
      var ac = document.createElement('canvas'); ac.width=320; ac.height=320;
      try { pendingItem.fn(ac.getContext('2d'), 320); } catch (e) {}
      selectedImg = ac;
    }
    pickRevealPattern();
    totalMs=parseInt(durationSel.value,10)*1000;
    remainingMs=totalMs; celebrating=false; done=false;
    timeDisplay.className='time-display'; setPauseButton(false);
    setup.style.display='none'; timerView.className='timer-view active';
    updateWakeBanner();
    running=true; lastTime=Date.now(); rafId=requestAnimationFrame(tick);
    requestWakeLock(); startKeepAlive();
  }

  startBtn.addEventListener('click', beginRun);

  /* Restart: re-run the same round but with a freshly-picked background colour. */
  /* The colour is chosen from the same swatch palette so it stays on-theme and  */
  /* the light/dark ink handling keeps working.                                  */
  function restartRun() {
    var sw = swatches[Math.floor(Math.random()*swatches.length)];
    selectSwatch(sw);
    beginRun();
  }

  /* One place that sets both the label and the colour, so Pause/Resume can't  */
  /* drift out of sync the way two separate textContent assignments did.       */
  function setPauseButton(paused) {
    if (done) {
      pauseBtn.textContent = '↻ Restart';
      pauseBtn.className = 'ctrl-btn pause done';
      return;
    }
    pauseBtn.textContent = paused ? '▶ Resume' : 'Pause';
    pauseBtn.className = 'ctrl-btn pause' + (paused ? ' paused' : '');
  }

  pauseBtn.addEventListener('click', function() {
    if (done) { restartRun(); return; }
    if (celebrating || remainingMs<=0) return;
    if (running) {
      running=false; cancelAnimationFrame(rafId); setPauseButton(true);
      releaseWakeLock(); stopKeepAlive();
    } else {
      running=true; lastTime=Date.now(); setPauseButton(false);
      rafId=requestAnimationFrame(tick);
      requestWakeLock(); startKeepAlive();
    }
  });

  resetBtn.addEventListener('click', function() {
    running=false; celebrating=false; done=false; cancelAnimationFrame(rafId);
    timerView.className='timer-view'; setup.style.display='';
    revealName.className='reveal-name';
    /* Back on the setup screen the surprise tile must show its "?" again, not  */
    /* what was just revealed.                                                  */
    if (surpriseCat && artPickers[SURPRISE_KEY+surpriseCat]) artPickers[SURPRISE_KEY+surpriseCat]();
    setPauseButton(false); ctx.clearRect(0,0,canvas.width,canvas.height);
    releaseWakeLock(); stopKeepAlive(); stopChime();
  });

  /* ---- Surprise tiles — wrapped so one bad art can't break the others ----- */
  var artPickers = {};   /* settings key -> select(), so saved settings restore */

  function deselectAllArt() {
    var all = artRow.children;
    for (var i=0; i<all.length; i++) all[i].className = 'art-thumb-wrap surprise';
  }

  /* One tile per category, "Anything" first. Picking one shows its "?" — NOT */
  /* what's behind it, which isn't even chosen until Start.                   */
  [ANY].concat(CATEGORIES).forEach(function(cat) {
    var wrap = document.createElement('div');
    wrap.className = 'art-thumb-wrap surprise';
    var tc = document.createElement('canvas');
    tc.width = 62; tc.height = 62;
    try { artSurprise(tc.getContext('2d'), 62, cat); } catch (e) {}
    var lbl = document.createElement('span');
    lbl.textContent = cat.tile;
    wrap.appendChild(tc); wrap.appendChild(lbl);
    artRow.appendChild(wrap);
    function pick() {
      deselectAllArt();
      wrap.className = 'art-thumb-wrap surprise selected';
      var oc = document.createElement('canvas'); oc.width=320; oc.height=320;
      try { artSurprise(oc.getContext('2d'), 320, cat); } catch (e) {}
      selectedImg=oc; selectedArt=SURPRISE_KEY+cat.id; surpriseCat=cat.id;
      chosenItem=null;
      showPreview(oc);
      setPreviewLabel('');
      uploadLabel.textContent='Upload your own photo';
      startBtn.disabled=false; startBtn.textContent='Start';
      saveSettings();
    }
    artPickers[SURPRISE_KEY+cat.id] = pick;
    wrap.addEventListener('click', pick);
  });

  /* ---- Picking one on purpose ----------------------------------------------- */
  /* Reachable only from the collection sheet, and only for something already    */
  /* found — a surprise is still the only way to meet a new one. Past that point */
  /* it becomes the selection, is previewed and named, and is remembered.        */
  function pickItem(item) {
    deselectAllArt();
    var oc = document.createElement('canvas'); oc.width=320; oc.height=320;
    try { item.fn(oc.getContext('2d'), 320); } catch (e) {}
    selectedImg=oc; selectedArt=ITEM_KEY+item.name;
    surpriseCat=null; chosenItem=item;
    showPreview(oc);
    setPreviewLabel(item.name);
    uploadLabel.textContent='Upload your own photo';
    startBtn.disabled=false; startBtn.textContent='Start';
    saveSettings();
  }

  /* ---- Restore last-used settings ----------------------------------------- */
  (function restoreSettings() {
    var s = loadSettings();
    if (!s) return;
    restoring = true;
    try {
      if (s.bg) {
        for (var i=0; i<swatches.length; i++) {
          if (swatches[i].getAttribute('data-bg') === s.bg) { selectSwatch(swatches[i]); break; }
        }
      }
      if (s.duration) {
        for (var j=0; j<durationSel.options.length; j++) {
          if (durationSel.options[j].value === String(s.duration)) { durationSel.selectedIndex = j; break; }
        }
      }
      if (typeof s.sound === 'boolean') soundToggle.checked = s.sound;
      /* Older saves used other keys: "__surprise__" for the animal surprise,    */
      /* "animal:Fox" for a picked animal, and a bare name for a preset pattern. */
      /* A pattern that was saved as the selection was in use, so it counts as  */
      /* found rather than vanishing now that patterns are discovered too.      */
      var key = s.art;
      if (key === '__surprise__') key = SURPRISE_KEY + 'animal';
      else if (key && key.indexOf('animal:') === 0) key = ITEM_KEY + key.slice(7);
      else if (key && key.indexOf(SURPRISE_KEY) !== 0 && key.indexOf(ITEM_KEY) !== 0 && itemByName(key)) {
        markFound(key); key = ITEM_KEY + key;
      }
      /* A saved item only comes back if it's still in the found list. If the  */
      /* collection was cleared, restoring it would put something they haven't */
      /* earned on the setup screen, named.                                    */
      if (key && key.indexOf(ITEM_KEY) === 0) {
        var saved = itemByName(key.slice(ITEM_KEY.length));
        if (saved && isFound(saved.name)) pickItem(saved);
      } else if (key && artPickers[key]) {
        artPickers[key]();
      }
    } catch (e) {
    } finally { restoring = false; }
  }());

  /* ---- Collection sheet ---------------------------------------------------- */
  /* Locked animals draw the "?" placeholder, so the grid never spoils one you   */
  /* haven't earned. Found ones are tappable and open at full size.              */
  function buildCollection() {
    while (collectionGrid.firstChild) collectionGrid.removeChild(collectionGrid.firstChild);
    var all = foundList.length === ITEMS.length;
    collectionSub.textContent = all
      ? 'You found all ' + ITEMS.length + '! 🎉'
      : foundList.length + ' of ' + ITEMS.length + ' found';

    CATEGORIES.forEach(function(cat) {
      var head = document.createElement('div');
      head.className = 'collection-head';
      var n = foundIn(cat);
      head.textContent = cat.label + ' · ' + n + ' of ' + cat.items.length + (n === cat.items.length ? ' ⭐' : '');
      collectionGrid.appendChild(head);
      cat.items.forEach(function(item) {
        var found = isFound(item.name);
        var el = document.createElement('div');
        el.className = 'collection-item' + (found ? ' found' : '');
        var tc = document.createElement('canvas');
        tc.width = 62; tc.height = 62;
        try { (found ? item.fn : artLocked)(tc.getContext('2d'), 62); } catch (e) {}
        var lbl = document.createElement('span');
        lbl.textContent = item.name;
        el.appendChild(tc); el.appendChild(lbl);
        if (found) el.addEventListener('click', function() { openZoom(item); });
        collectionGrid.appendChild(el);
      });
    });
  }

  /* The animal currently open full size — what "Start timer with…" runs. */
  var zoomAnimal = null;

  function openZoom(animal) {
    zoomAnimal = animal;
    var zs = zoomCanvas.width;
    var zctx = zoomCanvas.getContext('2d');
    zctx.clearRect(0,0,zs,zs);
    try { animal.fn(zctx, zs); } catch (e) {}
    zoomName.textContent = animal.name;
    zoomStart.textContent = '▶ Start timer with ' + animal.name;
    zoomView.className = 'zoom-view open';
    collectionGrid.style.display = 'none';
  }

  function closeZoom() {
    zoomView.className = 'zoom-view';
    collectionGrid.style.display = '';
    zoomAnimal = null;
  }

  /* Tap an animal you've found, then run the timer with it — same duration,   */
  /* background and sound as the setup screen was already holding. It also      */
  /* becomes the current selection, so Start on the setup screen repeats it.    */
  zoomStart.addEventListener('click', function() {
    if (!zoomAnimal) return;
    var animal = zoomAnimal;
    collectionSheet.className = 'sheet';
    closeZoom();
    pickItem(animal);
    beginRun();
  });

  /* The other way out of here: pick it and land back on the setup screen      */
  /* without starting anything, so a duration or background change still      */
  /* happens before Start is pressed on purpose.                              */
  zoomSelect.addEventListener('click', function() {
    if (!zoomAnimal) return;
    var animal = zoomAnimal;
    collectionSheet.className = 'sheet';
    closeZoom();
    pickItem(animal);
  });

  collectionBtn.addEventListener('click', function() {
    buildCollection(); closeZoom();
    collectionSheet.className = 'sheet open';
  });
  collectionClose.addEventListener('click', function() {
    collectionSheet.className = 'sheet';
  });
  /* Tapping the dimmed area outside the card closes it too. */
  collectionSheet.addEventListener('click', function(e) {
    if (e.target === collectionSheet) collectionSheet.className = 'sheet';
  });
  zoomBack.addEventListener('click', closeZoom);
  updateCollectionCount();

  /* ---- Timer tick -------------------------------------------------------- */
  function tick() {
    var now=Date.now();
    remainingMs -= (now-lastTime); lastTime=now;
    if (remainingMs<0) remainingMs=0;
    drawFrame(remainingMs/totalMs);
    updateDisplay(remainingMs);
    if (remainingMs<=0) { onDone(); return; }
    if (running) rafId=requestAnimationFrame(tick);
  }

  /* ---- Done -------------------------------------------------------------- */
  function onDone() {
    timeDisplay.className='time-display done';
    if (soundToggle.checked) playDoneSound();
    if (pendingItem) {
      var isNew = markFound(pendingItem.name);
      updateCollectionCount(); buildCollection();
      revealName.innerHTML = '';
      if (isNew) {
        var badge = document.createElement('span');
        badge.className = 'new-badge'; badge.textContent = 'NEW';
        revealName.appendChild(badge);
      }
      revealName.appendChild(document.createTextNode(pendingItem.name));
      revealName.className = 'reveal-name visible';
    }
    running=false; celebrating=true; celebStart=Date.now(); celebFade=1;
    done=true; setPauseButton(false);
    drawFrame(0);            /* fully-revealed artwork, so the sample is of it  */
    measureCelebContrast();
    activeCeleb = CELEBRATIONS[Math.floor(Math.random()*CELEBRATIONS.length)];
    rafId=requestAnimationFrame(celebTick);
  }

  /* Sparkles/pulses used to be plain white, which all but disappeared over a    */
  /* light photo or a pale preset. Sample the revealed artwork and flip the ink  */
  /* (plus add a halo behind every effect) when it's a light image.              */
  function measureCelebContrast() {
    celebOnLight = false;
    try {
      var S=canvas.width, d=ctx.getImageData(0,0,S,S).data;
      var sum=0, n=0;
      /* Stride is a prime multiple of the 4-byte stride so the samples don't    */
      /* land on a repeating column of a patterned artwork.                      */
      for (var i=0; i<d.length; i+=4*37) {
        if (d[i+3]<128) continue;                       /* outside the circle    */
        sum += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        n++;
      }
      if (n) celebOnLight = (sum/n) > 140;
    } catch (e) { /* tainted canvas — keep the white default */ }
    celebInk = celebOnLight ? '#0b1220' : '#ffffff';
  }

  function celebTick() {
    var elapsed=Date.now()-celebStart;
    celebFade = elapsed > CELEB_DUR-CELEB_FADE
      ? Math.max(0,(CELEB_DUR-elapsed)/CELEB_FADE) : 1;
    drawFrame(0); drawCelebration(activeCeleb, elapsed);
    if (elapsed<CELEB_DUR) { rafId=requestAnimationFrame(celebTick); }
    else { drawFrame(0); celebrating=false; releaseWakeLock(); stopKeepAlive(); }
  }

  /* ---- How the picture gets uncovered -------------------------------------- */
  /* The mask that hides the artwork is also the clock: whatever shape it takes,  */
  /* the area it still covers is the fraction of the round still to run, so a     */
  /* glance at the picture says roughly how much is left. One pattern is picked   */
  /* at random per run, the same way the celebration effect is — so a run doesn't */
  /* play out identically every time once you already know all sixteen animals.   */
  /* The wedge opens the middle of the picture early, and the middle is where     */
  /* every animal in the set keeps its face — so by half time you can usually     */
  /* name a surprise and the rest of the round has nothing left in it. The iris   */
  /* and the tiles hold the middle back to the end; the curtain holds the top     */
  /* (ears, horns, a narwhal's tusk). Three runs in four now stay a surprise      */
  /* for longer than they used to.                                                */

  var MASK_EDGE = 'rgba(255,255,255,0.30)';   /* lit line on the moving boundary */
  /* Fully opaque, not a hint of see-through. A see-through mask sounded nicer   */
  /* but made revealTiles' overlapping rects double up: two 0.93-alpha fills    */
  /* stacked at a shared edge come out darker than one, which is a visible grid */
  /* of hairlines the "half a pixel of overlap" fix below can't hide. Solid     */
  /* fills of the same colour cover each other exactly, so the overlap needed   */
  /* to close sub-pixel gaps between cells stops being visible at all.          */
  function maskFill() { return 'rgb('+maskColor+')'; }

  /* The original: a pie slice sweeping clockwise from twelve o'clock. */
  function revealWedge(f, S) {
    var cx=S/2, cy=S/2, r=S/2;
    var start=-Math.PI/2, end=start+f*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,end,false); ctx.closePath();
    ctx.fillStyle=maskFill(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+r*Math.cos(end), cy+r*Math.sin(end));
    ctx.strokeStyle=MASK_EDGE; ctx.lineWidth=2; ctx.stroke();
  }

  /* A disc over the middle, shrinking away to nothing: edges first, face last.  */
  /* Radius r*sqrt(f) is what keeps the covered area proportional to f.          */
  function revealIris(f, S) {
    var cx=S/2, cy=S/2, rad=(S/2)*Math.sqrt(f);
    ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2);
    ctx.fillStyle=maskFill(); ctx.fill();
    ctx.strokeStyle=MASK_EDGE; ctx.lineWidth=2; ctx.stroke();
  }

  /* A cover sliding up off the picture: feet first, face last. The top segment  */
  /* of a circle of radius r, cut h below the top, has area                     */
  /* r^2*acos((r-h)/r) - (r-h)*sqrt(2rh-h^2), which is monotonic in h — so the   */
  /* height for a given area comes out of two dozen bisections, cheaper to read  */
  /* than the closed form and cheap enough to redo every frame.                  */
  function maskSegmentHeight(f, r) {
    var target=f*Math.PI*r*r, lo=0, hi=2*r, mid, a, i;
    for (i=0; i<24; i++) {
      mid=(lo+hi)/2;
      a = r*r*Math.acos(Math.max(-1,Math.min(1,(r-mid)/r)))
        - (r-mid)*Math.sqrt(Math.max(0,2*r*mid-mid*mid));
      if (a < target) lo=mid; else hi=mid;
    }
    return (lo+hi)/2;
  }

  function revealCurtain(f, S) {
    var y = maskSegmentHeight(f, S/2);      /* the circle's top edge is y=0 */
    ctx.fillStyle=maskFill(); ctx.fillRect(0,0,S,y);
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(S,y);
    ctx.strokeStyle=MASK_EDGE; ctx.lineWidth=2; ctx.stroke();
  }

  /* Tiles lifting off one at a time. A corner tile covers almost none of the     */
  /* circle and a middle one covers all of it, so each tile carries the share it  */
  /* actually hides and they come off in that currency — otherwise a run of       */
  /* corner tiles would stall the clock.                                          */
  /* They come off outside-in, jittered: the order is by distance from the middle */
  /* plus up to two thirds of a tile of noise, which is enough to make the edge   */
  /* ragged and unpredictable while still keeping the face for last. Both the     */
  /* weights and the order are worked out once per run — doing either per frame   */
  /* would make the tiles shimmer instead of lift.                                */
  var TILE_N = 6;
  var tileOrder = [], tileWeight = [], tileTotal = 0;

  function planTiles(S) {
    var n=TILE_N, cell=S/n, r=S/2, i, j, k, col, row, hits, sx, sy, keyed=[];
    tileWeight=[]; tileTotal=0;
    for (i=0; i<n*n; i++) {
      col=i%n; row=Math.floor(i/n); hits=0;
      for (j=0; j<4; j++) for (k=0; k<4; k++) {
        sx=(col+(j+0.5)/4)*cell - r; sy=(row+(k+0.5)/4)*cell - r;
        if (sx*sx+sy*sy <= r*r) hits++;
      }
      tileWeight.push(hits/16); tileTotal += hits/16;
      sx=(col+0.5)*cell - r; sy=(row+0.5)*cell - r;
      keyed.push({i:i, key:Math.sqrt(sx*sx+sy*sy) + Math.random()*cell*0.66});
    }
    keyed.sort(function(a,b) { return a.key - b.key; });
    tileOrder=[];
    for (i=0; i<keyed.length; i++) tileOrder.push(keyed[i].i);
  }

  /* The covered tiles are a prefix of the order, so the ones that lift first are */
  /* the ones at its end — which is why planTiles() puts the middle at the front. */
  /* Cell edges are rounded to whole pixels so two covered neighbours share an    */
  /* exact boundary — no gap, no overlap — rather than each carving out its own   */
  /* fractional-pixel rectangle. That used to be papered over with half a pixel   */
  /* of overlap between rects, which stopped a true gap but still let antialiasing */
  /* blend two partial-coverage edges into a faint seam; rounding removes the     */
  /* fractional edge in the first place, so there is nothing left to blend.       */
  function revealTiles(f, S) {
    if (!tileOrder.length) planTiles(S);
    var n=TILE_N, cell=S/n, need=f*tileTotal, acc=0, i, idx, col, row, x0,x1,y0,y1;
    ctx.fillStyle=maskFill();
    for (i=0; i<tileOrder.length && acc<need; i++) {
      idx=tileOrder[i]; acc+=tileWeight[idx];
      col=idx%n; row=Math.floor(idx/n);
      x0=Math.round(col*cell); x1=Math.round((col+1)*cell);
      y0=Math.round(row*cell); y1=Math.round((row+1)*cell);
      ctx.fillRect(x0, y0, x1-x0, y1-y0);
    }
  }

  var REVEALS = [revealWedge, revealIris, revealCurtain, revealTiles];
  var activeReveal = revealWedge;

  function pickRevealPattern() {
    activeReveal = REVEALS[Math.floor(Math.random()*REVEALS.length)];
    tileOrder = [];    /* so the next run that needs tiles gets a fresh shuffle */
  }

  /* ---- Draw -------------------------------------------------------------- */
  function drawFrame(fraction) {
    var S=canvas.width, cx=S/2, cy=S/2, r=S/2;
    ctx.clearRect(0,0,S,S);
    if (!selectedImg) return;
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
    ctx.drawImage(selectedImg,0,0,S,S);
    ctx.restore();
    if (fraction<=0) return;
    /* Every pattern draws inside this clip, so none of them has to know it is   */
    /* painting into a circle rather than a square.                              */
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
    activeReveal(fraction, S);
    ctx.restore();
  }

  /* ---- Celebration animations --------------------------------------------- */
  /* A handful of distinct end-of-timer effects; one is picked at random each   */
  /* time the timer finishes so repeat use doesn't always look the same.        */
  function drawCelebration(fn, elapsed) {
    var S=canvas.width, cx=S/2, cy=S/2;
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,S/2,0,Math.PI*2); ctx.clip();
    /* A dark halo under everything keeps bright confetti/rings legible on a     */
    /* pale artwork. The effects' own save()/restore() inherit it.               */
    if (celebOnLight) { ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=S*0.022; }
    fn(elapsed);
    ctx.restore();
  }

  function celebRings(elapsed) {
    var S=canvas.width, cx=S/2, cy=S/2, t=elapsed/CELEB_DUR;
    var cols=celebOnLight
      ? ['180,120,0','0,120,180','170,20,110','0,130,70','180,70,0','90,50,170']
      : ['255,220,50','80,220,255','255,100,200','100,255,160','255,160,60','200,150,255'];
    for (var i=0; i<6; i++) {
      var phase=(t*2+i/6)%1;
      ctx.beginPath(); ctx.arc(cx,cy,phase*S*0.52,0,Math.PI*2);
      ctx.strokeStyle='rgba('+cols[i]+','+(1-phase)*0.75*celebFade+')';
      ctx.lineWidth=5-phase*3; ctx.stroke();
    }
  }

  function celebConfetti(elapsed) {
    var S=canvas.width;
    var cols=['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6'];
    var n=70, life=3600;
    for (var i=0; i<n; i++) {
      var seed=i*17+3;
      var delay=rand(seed)*(CELEB_DUR-life-CELEB_FADE);
      var te=elapsed-delay;
      if (te<0) continue;
      var tt=Math.min(te/life,1);
      var x=rand(seed+1)*S+(rand(seed+2)-0.5)*S*0.3*tt;
      var y=-S*0.08+tt*S*1.15;
      var rot=rand(seed+3)*Math.PI*2+tt*8*(rand(seed+4)>0.5?1:-1);
      var w=S*0.02+rand(seed+5)*S*0.02, h=w*0.6;
      var alpha=(tt>0.82 ? Math.max(0,(1-tt)/0.18) : 1)*celebFade;
      ctx.save(); ctx.globalAlpha=alpha;
      ctx.translate(x,y); ctx.rotate(rot);
      ctx.fillStyle=cols[i%cols.length];
      ctx.fillRect(-w/2,-h/2,w,h);
      ctx.restore();
    }
  }

  function celebSparkle(elapsed) {
    var S=canvas.width, cx=S/2, cy=S/2, t=elapsed/CELEB_DUR;
    var n=80, waves=2;   /* two passes so the longer window keeps re-seeding    */
    for (var w=0; w<waves; w++) {
      var wt=(t*waves)-w;
      if (wt<0 || wt>1) continue;
      for (var i=0; i<n; i++) {
        var seed=i*23+5+w*331;
        var angle=rand(seed)*Math.PI*2;
        var speed=0.22+rand(seed+1)*0.55;
        var dist=wt*speed*S;
        if (dist>S*0.56) continue;
        var x=cx+Math.cos(angle)*dist, y=cy+Math.sin(angle)*dist;
        var twinkle=0.5+0.5*Math.sin(wt*40+seed);
        var alpha=Math.max(0,1-wt)*twinkle*celebFade;
        var r=S*0.006+rand(seed+2)*S*0.011;
        ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=celebInk;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function celebFireworks(elapsed) {
    var S=canvas.width;
    var cols=celebOnLight
      ? ['200,30,30','190,120,0','0,120,190','110,50,200','0,140,80','190,40,130']
      : ['255,80,80','255,190,60','120,220,255','170,120,255','120,255,170','255,120,200'];
    var bursts=8, burstDur=1700, particles=22;
    for (var b=0; b<bursts; b++) {
      var seed=b*101+7;
      var startT=rand(seed)*(CELEB_DUR-burstDur-CELEB_FADE);
      var te=elapsed-startT;
      if (te<0 || te>burstDur) continue;
      var cx=S*(0.25+rand(seed+1)*0.5), cy=S*(0.22+rand(seed+2)*0.5);
      var tt=te/burstDur, col=cols[b%cols.length];
      for (var p=0; p<particles; p++) {
        var pseed=seed+p*3+1;
        var angle=(p/particles)*Math.PI*2+rand(pseed)*0.3;
        var speed=S*(0.2+rand(pseed+1)*0.13);
        var x=cx+Math.cos(angle)*speed*tt;
        var y=cy+Math.sin(angle)*speed*tt+tt*tt*S*0.12;
        var alpha=Math.max(0,1-tt*1.15)*celebFade;
        ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle='rgba('+col+',1)';
        ctx.beginPath(); ctx.arc(x,y,S*0.008,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function celebPulse(elapsed) {
    var S=canvas.width, cx=S/2, cy=S/2, t=(elapsed%1400)/1400;
    var pulses=3;
    for (var i=0; i<pulses; i++) {
      var phase=(t+i/pulses)%1;
      var r=phase*S*0.55;
      var alpha=(1-phase)*(celebOnLight?0.7:0.55)*celebFade;
      ctx.save(); ctx.globalAlpha=alpha;
      ctx.strokeStyle=celebInk; ctx.lineWidth=S*0.015;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }

  var CELEBRATIONS = [celebRings, celebConfetti, celebSparkle, celebFireworks, celebPulse];
  var activeCeleb  = celebRings;

  /* ---- Sound ------------------------------------------------------------- */
  /* The same four-note chime is used twice: once quietly when a round starts  */
  /* (so you know the sound works and, on iOS, so the AudioContext unlocks     */
  /* inside the tap), and several times when the round finishes, spaced out so */
  /* it's still audible if you glance back a few seconds late.                 */
  function playChime(repeats, peak) {
    stopChime();
    var id = chimeId;
    resumeAudioCtx().then(function() {
      if (!audioCtx || id !== chimeId) return;
      var notes=[523.25,659.25,783.99,1046.50];
      var noteGap=0.18, roundGap=0.5;
      var roundDur=notes.length*noteGap+0.56;
      var now=audioCtx.currentTime;
      for (var r=0; r<repeats; r++) {
        var roundStart=now+r*(roundDur+roundGap);
        notes.forEach(function(freq,i) {
          var osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.type='sine'; osc.frequency.value=freq;
          var t=roundStart+i*noteGap;
          gain.gain.setValueAtTime(0,t);
          gain.gain.linearRampToValueAtTime(peak,t+0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
          osc.start(t); osc.stop(t+0.56);
          chimeNotes.push({osc:osc, gain:gain});
        });
      }
    });
  }

  function stopChime() {
    chimeId++;
    for (var i=0; i<chimeNotes.length; i++) {
      try { chimeNotes[i].osc.disconnect(); chimeNotes[i].gain.disconnect(); } catch (e) {}
    }
    chimeNotes = [];
  }

  function playStartSound() { playChime(1, 0.16); }
  function playDoneSound()  { playChime(4, 0.28); }   /* ~7.1s, just under CELEB_DUR */

  /* ---- Display ----------------------------------------------------------- */
  function updateDisplay(ms) {
    var s=Math.ceil(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    timeDisplay.textContent = h>0 ? pad(h)+':'+pad(m)+':'+pad(sec) : pad(m)+':'+pad(sec);
  }
  function pad(n) { return n<10 ? '0'+n : ''+n; }

}(window.RT));
