/* The surprise tiles, and the placeholder for something not found yet. */
(function (RT) {
  'use strict';

  var draw = RT.draw;
  var ell = draw.ell,
      circ = draw.circ;

  /* The tile you pick to get a random unseen one of a category, and the        */
  /* placeholder for one you haven't found yet. Neither may hint at which is     */
  /* coming — the emblem says only which category.                              */
  function artSurprise(ctx, S, cat) {
    var u = S/100, W = 'rgba(255,255,255,0.95)';
    var g = ctx.createLinearGradient(0,0,S,S);
    g.addColorStop(0,cat.from); g.addColorStop(1,cat.to);
    ctx.fillStyle = g; ctx.fillRect(0,0,S,S);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var font = function(px) { return 'bold ' + px + 'px -apple-system, Helvetica, Arial, sans-serif'; };
    if (cat.id === 'animal') {
      circ(ctx,50*u,60*u,19*u,W);
      circ(ctx,26*u,41*u,8*u,W); circ(ctx,41*u,25*u,8*u,W);
      circ(ctx,59*u,25*u,8*u,W); circ(ctx,74*u,41*u,8*u,W);
      ctx.fillStyle = cat.to; ctx.font = font(24*u); ctx.fillText('?', 50*u, 61*u);
    } else if (cat.id === 'food') {
      circ(ctx,50*u,50*u,32*u,W);
      circ(ctx,50*u,50*u,14*u,cat.to);
      ctx.fillStyle = W; ctx.font = font(20*u); ctx.fillText('?', 50*u, 51*u);
    } else if (cat.id === 'word') {
      ctx.fillStyle = W; ctx.font = font(40*u); ctx.fillText('Aa', 50*u, 46*u);
      ctx.font = font(26*u); ctx.fillText('?', 50*u, 78*u);
    } else if (cat.id === 'pattern') {
      for (var p=0; p<8; p++) {
        var a = p/8*Math.PI*2;
        ell(ctx,50*u+Math.cos(a)*18*u,50*u+Math.sin(a)*18*u,12*u,6*u,a,W);
      }
      circ(ctx,50*u,50*u,12*u,cat.from);
      ctx.fillStyle = W; ctx.font = font(18*u); ctx.fillText('?', 50*u, 51*u);
    } else {
      ctx.fillStyle = W; ctx.font = font(64*u); ctx.fillText('?', 50*u, 54*u);
      circ(ctx,22*u,24*u,4*u,W); circ(ctx,80*u,30*u,3*u,W); circ(ctx,74*u,80*u,4*u,W); circ(ctx,24*u,76*u,3*u,W);
    }
  }

  function artLocked(ctx, S) {
    var u = S/100;
    ctx.fillStyle = '#2b3140'; ctx.fillRect(0,0,S,S);
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    ctx.font = 'bold ' + (48*u) + 'px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 50*u, 53*u);
  }

  RT.art.surprise = artSurprise;
  RT.art.locked = artLocked;
}(window.RT = window.RT || {}));
