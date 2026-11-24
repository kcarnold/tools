/* What has been found, and what comes next. */
(function (RT) {
  'use strict';

  var catalog = RT.catalog;

  /* Names this version doesn't know are dropped, so a save from before the set  */
  /* changed can't hand back something that no longer exists.                    */
  function knownNames(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function(name, i) {
      return catalog.itemByName(name) && value.indexOf(name) === i;
    });
  }

  var saved     = RT.storage.loadCollection();
  var found     = knownNames(saved.found);
  var decks     = {};   /* category id -> names still to come in this pass  */
  var lastShown = {};   /* category id -> what it last dealt, so no repeat  */
  catalog.categories.forEach(function(cat) {
    decks[cat.id] = knownNames(saved.decks[cat.id]);
    if (catalog.itemByName(saved.lastShown[cat.id])) lastShown[cat.id] = saved.lastShown[cat.id];
  });

  function save() {
    RT.storage.saveCollection({found: found, decks: decks, lastShown: lastShown});
  }

  function isFound(item) { return found.indexOf(item.name) >= 0; }

  /* Returns whether it's new. */
  function markFound(item) {
    if (isFound(item)) return false;
    found.push(item.name);
    save();
    return true;
  }

  function randomOf(list) { return list[Math.floor(Math.random()*list.length)]; }

  /* Fisher-Yates over one category. The deck is dealt off the end, so it's the  */
  /* last entry that must not be the one they just saw.                          */
  function shuffledDeck(cat) {
    var deck = cat.items.map(function(item) { return item.name; });
    function swap(i, j) { var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp; }
    var last = deck.length-1;
    for (var i=last; i>0; i--) swap(i, Math.floor(Math.random()*(i+1)));
    if (last > 0 && deck[last] === lastShown[cat.id]) swap(last, 0);
    return deck;
  }

  /* Prefer one they haven't met: until a category is complete that alone makes  */
  /* every reveal a new one. Past the end it deals from a shuffled deck per      */
  /* category instead of rolling a die — a die hands back what you just had and  */
  /* leaves some waiting for weeks. "Anything" pools every category's unfound    */
  /* ones; once all are found it picks a category and deals from its deck.       */
  function pickSurprise(cat) {
    var cats = cat === catalog.any ? catalog.categories : [cat];
    var pool = [], next;
    cats.forEach(function(c) {
      pool = pool.concat(c.items.filter(function(item) { return !isFound(item); }));
    });
    if (pool.length) {
      next = randomOf(pool);
    } else {
      var c = randomOf(cats);
      if (!decks[c.id].length) decks[c.id] = shuffledDeck(c);
      next = catalog.itemByName(decks[c.id].pop());
    }
    lastShown[next.cat] = next.name;
    save();
    return next;
  }

  RT.collection = {
    isFound: isFound,
    markFound: markFound,
    pickSurprise: pickSurprise,
    count: function() { return found.length; },
    countIn: function(cat) { return cat.items.filter(isFound).length; }
  };
}(window.RT = window.RT || {}));
