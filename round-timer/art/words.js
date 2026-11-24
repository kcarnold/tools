/* Words. */
(function (RT) {
  'use strict';

  var draw = RT.draw;
  var wash = draw.wash;

  /* ---- Words ----------------------------------------------------------------- */
  /* Words that are fun to say out loud. Drawn letter by letter, each tipped a   */
  /* little and in its own colour, so a half-uncovered word is a guessing game: */
  /* the reveal patterns that open from one side give away a letter at a time.  */
  /* Kept to ten letters so the word still fits the circle at a readable size.  */
  var WORD_LIST = ['Kaboom','Bonkers','Noodle','Zigzag','Squish','Wobble','Gizmo',
                   'Lollygag','Skedaddle','Bamboozle','Kerfuffle','Hullabaloo'];
  var WORD_WASH = [['#fff1c9','#f59e0b'],['#e0f2fe','#3b82f6'],['#fce7f3','#db2777'],
                   ['#dcfce7','#16a34a'],['#ede9fe','#7c3aed'],['#ffedd5','#ea580c']];
  var WORD_INK  = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#a855f7','#ec4899'];

  function wordArt(word, idx) {
    return function(ctx, S) {
      var u = S/100, w = WORD_WASH[idx % WORD_WASH.length];
      wash(ctx,S,w[0],w[1]);
      var size = 30*u, font = function(px) {
        return '900 ' + px + 'px "Arial Rounded MT Bold", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';
      };
      ctx.font = font(size);
      var total = 0, widths = [], i;
      for (i=0; i<word.length; i++) { widths.push(ctx.measureText(word[i]).width); total += widths[i]; }
      /* fit inside the circle: about 84% of the width at the middle line */
      if (total > 84*u) { var k = 84*u/total; size *= k; total *= k; for (i=0; i<widths.length; i++) widths[i] *= k; }
      ctx.font = font(size);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      var x = 50*u - total/2;
      for (i=0; i<word.length; i++) {
        var cx = x + widths[i]/2, cy = 52*u + (i%2 ? -1 : 1)*size*0.06;
        ctx.save(); ctx.translate(cx,cy); ctx.rotate((i%2 ? 0.09 : -0.07));
        ctx.lineWidth = size*0.16; ctx.strokeStyle = '#ffffff'; ctx.strokeText(word[i],0,0);
        ctx.fillStyle = WORD_INK[(i+idx) % WORD_INK.length]; ctx.fillText(word[i],0,0);
        ctx.restore();
        x += widths[i];
      }
    };
  }

  var WORDS = [];
  for (var wi=0; wi<WORD_LIST.length; wi++) WORDS.push({name: WORD_LIST[wi], fn: wordArt(WORD_LIST[wi], wi)});

  RT.art.words = WORDS;
}(window.RT = window.RT || {}));
