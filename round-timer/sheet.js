/* The collection sheet: everything there is to find, and a closer look at what */
/* has been found. Not-yet-found ones show a placeholder instead of the picture */
/* and can't be opened.                                                         */
(function (RT) {
  'use strict';

  var $ = RT.dom.byId, el = RT.dom.el, render = RT.dom.render;
  var catalog = RT.catalog, collection = RT.collection;

  var sheet = $('collectionSheet'), grid = $('collectionGrid'), zoomView = $('zoomView');
  var zoomed = null;   /* the item open full size */

  function progress(n, of) { return n + ' of ' + of; }

  function updateCount() {
    $('collectionCount').textContent = progress(collection.count(), catalog.items.length);
  }

  function buildTile(item) {
    var found = collection.isFound(item);
    var tile = el('div', 'collection-item' + (found ? ' found' : ''));
    tile.appendChild(render(found ? item.fn : RT.art.locked, 62));
    tile.appendChild(el('span', '', item.name));
    if (found) tile.addEventListener('click', function() { openZoom(item); });
    return tile;
  }

  function buildGrid() {
    var total = catalog.items.length;
    $('collectionSub').textContent = collection.count() === total
      ? 'You found all ' + total + '! 🎉'
      : progress(collection.count(), total) + ' found';
    grid.innerHTML = '';
    catalog.categories.forEach(function(cat) {
      var n = collection.countIn(cat), all = cat.items.length;
      grid.appendChild(el('div', 'collection-head',
        cat.label + ' · ' + progress(n, all) + (n === all ? ' ⭐' : '')));
      cat.items.forEach(function(item) { grid.appendChild(buildTile(item)); });
    });
  }

  function openZoom(item) {
    zoomed = item;
    render(item.fn, $('zoomCanvas'));
    $('zoomName').textContent = item.name;
    $('zoomStart').textContent = '▶ Start timer with ' + item.name;
    zoomView.classList.add('open');
    grid.style.display = 'none';
  }

  function closeZoom() {
    zoomed = null;
    zoomView.classList.remove('open');
    grid.style.display = '';
  }

  function open() {
    buildGrid(); closeZoom();
    sheet.classList.add('open');
    document.body.classList.add('sheet-open');   /* the page behind stops scrolling */
  }

  function close() {
    closeZoom();
    sheet.classList.remove('open');
    document.body.classList.remove('sheet-open');
  }

  /* Both ways of choosing the zoomed item: to run now, or to have on the setup  */
  /* screen so the duration or background can be changed first.                  */
  function chooseWith(callback) {
    return function() {
      if (!zoomed) return;
      var item = zoomed;
      close();
      callback(item);
    };
  }

  RT.sheet = {
    updateCount: updateCount,
    init: function(callbacks) {
      $('collectionBtn').addEventListener('click', open);
      $('collectionClose').addEventListener('click', close);
      $('zoomBack').addEventListener('click', closeZoom);
      $('zoomStart').addEventListener('click', chooseWith(callbacks.onStart));
      $('zoomSelect').addEventListener('click', chooseWith(callbacks.onSelect));
      /* Tapping the dimmed area outside the card closes it too. */
      sheet.addEventListener('click', function(e) { if (e.target === sheet) close(); });
      updateCount();
    }
  };
}(window.RT = window.RT || {}));
