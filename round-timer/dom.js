/* Small DOM and canvas helpers. */
(function (RT) {
  'use strict';

  RT.dom = {
    byId: function(id) { return document.getElementById(id); },

    el: function(tag, className, text) {
      var e = document.createElement(tag);
      if (className) e.className = className;
      if (text) e.textContent = text;
      return e;
    },

    /* Run a drawing on a square canvas (a new one of side S, or one given).    */
    /* A drawing that throws leaves it as far as it got, not the app broken.    */
    render: function(draw, target) {
      var c = target;
      if (typeof target === 'number') {
        c = document.createElement('canvas');
        c.width = c.height = target;
      }
      var ctx = c.getContext('2d');
      ctx.clearRect(0,0,c.width,c.width);
      try { draw(ctx, c.width); } catch (e) {}
      return c;
    },

    /* Draw a square picture as a circle filling the canvas. */
    drawRound: function(ctx, S, picture) {
      ctx.clearRect(0,0,S,S);
      ctx.save(); ctx.beginPath(); ctx.arc(S/2,S/2,S/2,0,Math.PI*2); ctx.clip();
      ctx.drawImage(picture,0,0,S,S);
      ctx.restore();
    }
  };
}(window.RT = window.RT || {}));
