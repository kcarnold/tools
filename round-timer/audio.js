/* The chime, and keeping iOS from muting it. */
(function (RT) {
  'use strict';

  var audioCtx    = null;
  var notes       = [];     /* scheduled and not yet silenced              */
  var chimeId     = 0;      /* bumped to drop a chime still waiting to start */
  var keepAliveId = null;

  /* Create the AudioContext once and hand it back. On iOS a context created    */
  /* inside a tap gesture starts unlocked; one created later starts suspended.  */
  function ensureContext() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { audioCtx = new AC(); } catch (e) {} }
    }
    return audioCtx;
  }

  /* Resume the context and resolve only once it is actually running. iOS        */
  /* suspends the context when the page is backgrounded and only lets it resume  */
  /* inside a user gesture, so callers must wait for this before scheduling      */
  /* sound — otherwise notes are scheduled at a frozen currentTime and never     */
  /* play. Anything but running counts: iOS also has 'interrupted' (a call, the  */
  /* lock screen).                                                               */
  function resume() {
    var ac = ensureContext();
    if (ac && ac.state !== 'running' && ac.resume) {
      try { return Promise.resolve(ac.resume()); } catch (e) {}
    }
    return Promise.resolve();
  }

  function stopChime() {
    chimeId++;
    notes.forEach(function(n) {
      try { n.osc.disconnect(); n.gain.disconnect(); } catch (e) {}
    });
    notes = [];
  }

  function playNote(freq, t, peak) {
    var osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type='sine'; osc.frequency.value=freq;
    gain.gain.setValueAtTime(0,t);
    gain.gain.linearRampToValueAtTime(peak,t+0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
    osc.start(t); osc.stop(t+0.56);
    notes.push({osc: osc, gain: gain});
  }

  /* The same four-note chime is used twice: once quietly when a round starts   */
  /* (so you know the sound works and, on iOS, so the AudioContext unlocks      */
  /* inside the tap), and several times when the round finishes, spaced out so  */
  /* it's still audible if you glance back a few seconds late.                  */
  function playChime(repeats, peak) {
    stopChime();
    var id = chimeId;
    resume().then(function() {
      if (!audioCtx || id !== chimeId) return;
      var freqs=[523.25,659.25,783.99,1046.50];
      var noteGap=0.18, roundGap=0.5, roundDur=freqs.length*noteGap+0.56;
      var now=audioCtx.currentTime;
      for (var r=0; r<repeats; r++) {
        for (var i=0; i<freqs.length; i++) {
          playNote(freqs[i], now + r*(roundDur+roundGap) + i*noteGap, peak);
        }
      }
    }).catch(function() {});
  }

  /* A silent 1-sample buffer every 15s, so iOS doesn't suspend the context     */
  /* during a round and mute the chime at the end of it.                        */
  function keepAlive(on) {
    if (keepAliveId) { clearInterval(keepAliveId); keepAliveId = null; }
    if (!on) return;
    keepAliveId = setInterval(function() {
      if (!audioCtx) return;
      if (audioCtx.state !== 'running') { resume().catch(function() {}); return; }
      var src = audioCtx.createBufferSource();
      src.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
      src.connect(audioCtx.destination); src.start(0);
    }, 15000);
  }

  RT.audio = {
    resume: function() { resume().catch(function() {}); },
    playStart: function() { playChime(1, 0.16); },
    playDone:  function() { playChime(4, 0.28); },   /* ~7.1s, just under a celebration */
    stopChime: stopChime,
    keepAlive: keepAlive
  };
}(window.RT = window.RT || {}));
