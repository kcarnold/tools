/* Everything there is to reveal, by category. */
(function (RT) {
  'use strict';

  /* Everything you can reveal belongs to one of these, and every category works  */
  /* the same way: a surprise tile deals one you haven't found yet, and once found */
  /* it's in the collection to pick on purpose. Names must be unique across       */
  /* categories: the found list is one list.                                      */
  var CATEGORIES = [
    {id:'animal',  label:'Animals',  one:'animal',  tile:'An animal', items:RT.art.animals,  from:'#7c3aed', to:'#2563eb'},
    {id:'food',    label:'Food',     one:'food',    tile:'Food',      items:RT.art.food,     from:'#fb923c', to:'#e11d48'},
    {id:'word',    label:'Words',    one:'word',    tile:'A word',    items:RT.art.words,    from:'#14b8a6', to:'#2563eb'},
    {id:'pattern', label:'Patterns', one:'pattern', tile:'A pattern', items:RT.art.patterns, from:'#ec4899', to:'#9333ea'},
  ];
  var ANY = {id:'any', label:'Anything', one:'surprise', tile:'Anything!', from:'#f59e0b', to:'#db2777'};
  var ITEMS = [];
  (function indexItems() {
    for (var c=0; c<CATEGORIES.length; c++) {
      for (var i=0; i<CATEGORIES[c].items.length; i++) {
        CATEGORIES[c].items[i].cat = CATEGORIES[c].id;
        ITEMS.push(CATEGORIES[c].items[i]);
      }
    }
  }());
  function catById(id) {
    for (var c=0; c<CATEGORIES.length; c++) if (CATEGORIES[c].id === id) return CATEGORIES[c];
    return id === 'any' ? ANY : null;
  }

  function itemByName(name) {
    for (var i=0; i<ITEMS.length; i++) if (ITEMS[i].name === name) return ITEMS[i];
    return null;
  }

  RT.catalog = {
    categories: CATEGORIES, any: ANY, items: ITEMS, catById: catById, itemByName: itemByName
  };
}(window.RT = window.RT || {}));
