/* Shapes the drawings are built from. */
(function (RT) {
  'use strict';

  /* ---- Deterministic pseudo-random (seed-based, no Math.random) ----------- */
  function rand(seed) {
    var x = Math.sin(seed + 1.0) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ---- Animal artwork ----------------------------------------------------- */
  /* Same contract as the presets above: paint a square canvas of side S. Every  */
  /* coordinate is in hundredths of S (u = S/100) so one function serves the     */
  /* 320px reveal, the 250px zoom and the 62px collection tile alike.            */
  /*                                                                            */
  /* Two constraints carried over from the presets: ES5 only, and rgba() rather  */
  /* than 8-digit hex. A third is new — ctx.ellipse() doesn't exist on iOS 9     */
  /* Safari, so ell() builds one from a scaled arc instead. Path points are      */
  /* baked into device space as they're added, which is why it can restore()     */
  /* the transform before filling and still get an ellipse (and an unsquashed    */
  /* line width if anything strokes afterwards).                                 */

  function ell(ctx, x, y, rx, ry, rot, fill) {
    ctx.save(); ctx.translate(x,y); if (rot) ctx.rotate(rot); ctx.scale(rx,ry);
    ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.restore();
    ctx.fillStyle = fill; ctx.fill();
  }
  function circ(ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle = fill; ctx.fill();
  }
  function poly(ctx, pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
    for (var i=1; i<pts.length; i++) ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  /* poly() with the corners knocked off: fill the path, then stroke the same   */
  /* path in the same colour with a round join, which rounds every corner by     */
  /* half the line width. Keeps a shape's silhouette while losing its edges.     */
  function softPoly(ctx, pts, fill, r) {
    poly(ctx,pts,fill);
    ctx.lineWidth = r*2; ctx.strokeStyle = fill;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }
  function wash(ctx, S, inner, outer) {
    var g = ctx.createRadialGradient(S/2,S*0.40,0,S/2,S*0.5,S*0.75);
    g.addColorStop(0,inner); g.addColorStop(1,outer);
    ctx.fillStyle = g; ctx.fillRect(0,0,S,S);
  }
  function stroke(ctx, w, col) {
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }
  /* White + iris + pupil + catchlight. The catchlight is what makes these read  */
  /* as alive rather than as two flat dots.                                      */
  function eyeball(ctx, x, y, r, iris) {
    circ(ctx,x,y,r,'#ffffff');
    if (iris) { circ(ctx,x,y,r*0.68,iris); circ(ctx,x,y,r*0.34,'#141414'); }
    else      { circ(ctx,x,y,r*0.58,'#141414'); }
    circ(ctx,x-r*0.26,y-r*0.30,r*0.21,'rgba(255,255,255,0.95)');
  }
  function dotEye(ctx, x, y, r) {
    circ(ctx,x,y,r,'#181818');
    circ(ctx,x-r*0.30,y-r*0.34,r*0.36,'rgba(255,255,255,0.9)');
  }
  /* A "w" mouth: the little vertical from the nose, then a curve either side. */
  function catMouth(ctx, cx, top, w, h, lw, col) {
    stroke(ctx,lw,col);
    ctx.beginPath();
    ctx.moveTo(cx,top); ctx.lineTo(cx,top+h*0.45);
    ctx.moveTo(cx,top+h*0.45); ctx.quadraticCurveTo(cx-w*0.5,top+h*1.2,cx-w,top+h*0.45);
    ctx.moveTo(cx,top+h*0.45); ctx.quadraticCurveTo(cx+w*0.5,top+h*1.2,cx+w,top+h*0.45);
    ctx.stroke();
  }

  RT.draw = {
    rand: rand, ell: ell, circ: circ, poly: poly, softPoly: softPoly,
    wash: wash, stroke: stroke, eyeball: eyeball, dotEye: dotEye, catMouth: catMouth
  };
  RT.art = {};   /* filled in by the other files in this directory */
}(window.RT = window.RT || {}));
