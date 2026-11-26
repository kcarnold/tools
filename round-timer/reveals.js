/* How the picture gets uncovered.                                              */
/*                                                                              */
/* The mask that hides the artwork is also the clock: whatever shape it takes,  */
/* the area it still covers is the fraction of the round still to run, so a     */
/* glance at the picture says roughly how much is left. One pattern is picked   */
/* at random per run.                                                           */
/*                                                                              */
/* The wedge opens the middle of the picture early, and the middle is where     */
/* most pictures keep their face, so by half time you can usually name a        */
/* surprise. The iris and the tiles hold the middle back to the end; the        */
/* curtain holds the top.                                                       */
/*                                                                              */
/* Each reveal is a function (ctx, S, f, fill): cover the fraction f of the     */
/* circle inscribed in a square of side S. The caller clips to that circle.     */
(function (RT) {
  'use strict';

  var EDGE = 'rgba(255,255,255,0.30)';   /* lit line on the moving boundary */

  function strokeEdge(ctx) {
    ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
  }

  /* A pie slice sweeping clockwise from twelve o'clock. */
  function wedge(ctx, S, f, fill) {
    var cx=S/2, cy=S/2, r=S/2;
    var start=-Math.PI/2, end=start+f*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,end,false); ctx.closePath();
    ctx.fillStyle=fill; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+r*Math.cos(end), cy+r*Math.sin(end));
    strokeEdge(ctx);
  }

  /* A disc over the middle, shrinking away to nothing: edges first, face last.  */
  /* Radius r*sqrt(f) is what keeps the covered area proportional to f.          */
  function iris(ctx, S, f, fill) {
    ctx.beginPath(); ctx.arc(S/2,S/2,(S/2)*Math.sqrt(f),0,Math.PI*2);
    ctx.fillStyle=fill; ctx.fill();
    strokeEdge(ctx);
  }

  /* The top segment of a circle of radius r, cut h below the top, has area      */
  /* r^2*acos((r-h)/r) - (r-h)*sqrt(2rh-h^2), which is monotonic in h — so the   */
  /* height for a given area comes out of two dozen bisections, cheap enough to  */
  /* redo every frame.                                                           */
  function segmentHeight(f, r) {
    var target=f*Math.PI*r*r, lo=0, hi=2*r, mid, a, i;
    for (i=0; i<24; i++) {
      mid=(lo+hi)/2;
      a = r*r*Math.acos(Math.max(-1,Math.min(1,(r-mid)/r)))
        - (r-mid)*Math.sqrt(Math.max(0,2*r*mid-mid*mid));
      if (a < target) lo=mid; else hi=mid;
    }
    return (lo+hi)/2;
  }

  /* A cover sliding up off the picture: feet first, face last. */
  function curtain(ctx, S, f, fill) {
    var y = segmentHeight(f, S/2);      /* the circle's top edge is y=0 */
    ctx.fillStyle=fill; ctx.fillRect(0,0,S,y);
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(S,y);
    strokeEdge(ctx);
  }

  /* Tiles lifting off one at a time. A corner tile covers almost none of the     */
  /* circle and a middle one covers all of it, so each tile carries the share it  */
  /* actually hides — otherwise a run of corner tiles would stall the clock.      */
  /* They come off outside-in: the order is by distance from the middle plus up   */
  /* to two thirds of a tile of noise, which makes the edge ragged while still    */
  /* keeping the face for last.                                                   */
  var TILE_N = 8;

  function planTiles(S) {
    var n=TILE_N, cell=S/n, r=S/2, i, j, k, col, row, hits, sx, sy;
    var tiles=[], total=0;
    for (i=0; i<n*n; i++) {
      col=i%n; row=Math.floor(i/n); hits=0;
      for (j=0; j<4; j++) for (k=0; k<4; k++) {
        sx=(col+(j+0.5)/4)*cell - r; sy=(row+(k+0.5)/4)*cell - r;
        if (sx*sx+sy*sy <= r*r) hits++;
      }
      sx=(col+0.5)*cell - r; sy=(row+0.5)*cell - r;
      tiles.push({
        col: col, row: row, weight: hits/16,
        key: Math.sqrt(sx*sx+sy*sy) + Math.random()*cell*0.66
      });
      total += hits/16;
    }
    tiles.sort(function(a,b) { return a.key - b.key; });
    return {tiles: tiles, total: total};
  }

  /* Planned once per run: doing it per frame would make the tiles shimmer.      */
  /* The covered tiles are a prefix of the order, so the middle is at its front. */
  /* Cell edges are rounded to whole pixels so that two covered neighbours share */
  /* an exact boundary; fractional edges antialias into a visible seam.          */
  function tilesReveal() {
    var plan = null;
    return function(ctx, S, f, fill) {
      if (!plan) plan = planTiles(S);
      var cell=S/TILE_N, need=f*plan.total, acc=0, i, t, x0, x1, y0, y1;
      ctx.fillStyle=fill;
      for (i=0; i<plan.tiles.length && acc<need; i++) {
        t=plan.tiles[i]; acc+=t.weight;
        x0=Math.round(t.col*cell); x1=Math.round((t.col+1)*cell);
        y0=Math.round(t.row*cell); y1=Math.round((t.row+1)*cell);
        ctx.fillRect(x0, y0, x1-x0, y1-y0);
      }
    };
  }

  RT.reveals = {
    pick: function() {
      switch (Math.floor(Math.random()*4)) {
        case 0:  return wedge;
        case 1:  return iris;
        case 2:  return curtain;
        default: return tilesReveal();
      }
    }
  };
}(window.RT = window.RT || {}));
