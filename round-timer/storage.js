/* What's remembered between visits.                                            */
/*                                                                              */
/* Two keys: settings are preferences you'd happily see reset, the collection   */
/* is a record you'd be annoyed to lose. Every access is wrapped: Safari in     */
/* private mode throws from localStorage rather than returning null.            */
(function (RT) {
  'use strict';

  var SETTINGS = 'revealTimer.settings.v1';
  /* Says "animals" because that's what it held first. Renaming it would lose   */
  /* everything people have found; it now holds every category's finds.         */
  var COLLECTION = 'revealTimer.animals.v1';

  function asObject(value) { return value && typeof value === 'object' ? value : {}; }

  function read(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return asObject(raw ? JSON.parse(raw) : null);
    } catch (e) { return {}; }
  }

  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* settings.art says what was selected: "surprise:" + category id, "item:" +   */
  /* name, or null. Older saves used "__surprise__" for the animal surprise,     */
  /* "animal:Fox" for a picked animal, and a bare name for a preset pattern.     */
  /* Patterns weren't discovered then, so one that was selected is also one to   */
  /* count as found: impliesFound.                                               */
  function loadSettings() {
    var s = read(SETTINGS);
    var art = s.art;
    if (typeof art !== 'string') s.art = null;
    else if (art === '__surprise__') s.art = 'surprise:animal';
    else if (art.indexOf('animal:') === 0) s.art = 'item:' + art.slice('animal:'.length);
    else if (art.indexOf('surprise:') !== 0 && art.indexOf('item:') !== 0) {
      s.art = 'item:' + art;
      s.impliesFound = art;
    }
    return s;
  }

  /* {found: [names], decks: {category: [names]}, lastShown: {category: name}}.  */
  /* An older save had a single animal deck, under "deck" and "last".            */
  function loadCollection() {
    var c = read(COLLECTION);
    var decks = asObject(c.decks), lastShown = asObject(c.lastShown);
    if (c.deck && !decks.animal) decks.animal = c.deck;
    if (c.last && !lastShown.animal) lastShown.animal = c.last;
    return {found: c.found, decks: decks, lastShown: lastShown};
  }

  RT.storage = {
    loadSettings: loadSettings,
    saveSettings: function(s) { write(SETTINGS, s); },
    loadCollection: loadCollection,
    saveCollection: function(c) { write(COLLECTION, c); }
  };
}(window.RT = window.RT || {}));
