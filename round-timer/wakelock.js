/* Keeps the screen on. Otherwise iOS locks it and suspends Web Audio, which    */
/* silences the reveal chime.                                                   */
(function (RT) {
  'use strict';

  var supported = 'wakeLock' in navigator;
  var lock    = null;
  var request = null;   /* the request that may still set lock */

  function release() {
    request = null;
    if (lock) { lock.release(); lock = null; }
  }

  /* A lock arrives later than it's asked for, by which time it may no longer be */
  /* wanted, or a newer one may have been asked for.                             */
  function acquire() {
    release();
    if (!supported) return;
    var mine = request = {};
    try {
      navigator.wakeLock.request('screen').then(function(granted) {
        if (request === mine) lock = granted;
        else granted.release();
      }).catch(function() {});
    } catch (e) {}
  }

  RT.wakeLock = {supported: supported, acquire: acquire, release: release};
}(window.RT = window.RT || {}));
