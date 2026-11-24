/* Animals. */
(function (RT) {
  'use strict';

  var draw = RT.draw;
  var ell = draw.ell,
      circ = draw.circ,
      poly = draw.poly,
      softPoly = draw.softPoly,
      wash = draw.wash,
      stroke = draw.stroke,
      eyeball = draw.eyeball,
      dotEye = draw.dotEye,
      catMouth = draw.catMouth;

  /* The fox used to be six flat polygons: a hexagonal head, knife-edged cheeks  */
  /* and a hard V of a muzzle — the only animal here whose head wasn't an        */
  /* ellipse. The kids' verdict was "Foxy is too boxy". So the cranium is an     */
  /* ell() like everybody else's, and the wedges that keep it a fox rather than  */
  /* a cat — pointed ears, tapering snout, cream mask, orange blaze down the     */
  /* nose — go through softPoly, which keeps their shape but not their corners.  */
  function anFox(ctx, S) {
    var u = S/100; wash(ctx,S,'#ffeed2','#f0b473');
    softPoly(ctx,[[24*u,47*u],[30*u,12*u],[53*u,35*u]],'#e2661c',2.6*u);
    softPoly(ctx,[[76*u,47*u],[70*u,12*u],[47*u,35*u]],'#e2661c',2.6*u);
    softPoly(ctx,[[33*u,41*u],[35*u,24*u],[47*u,36*u]],'#3d2519',1.6*u);
    softPoly(ctx,[[67*u,41*u],[65*u,24*u],[53*u,36*u]],'#3d2519',1.6*u);
    ell(ctx,50*u,55*u,29*u,26*u,0,'#f4801f');
    softPoly(ctx,[[34*u,64*u],[66*u,64*u],[50*u,84*u]],'#f4801f',5*u);
    softPoly(ctx,[[27*u,58*u],[73*u,58*u],[65*u,78*u],[50*u,86*u],[35*u,78*u]],'#fff4e4',4*u);
    softPoly(ctx,[[44*u,44*u],[56*u,44*u],[54*u,67*u],[46*u,67*u]],'#f4801f',3*u);
    eyeball(ctx,36*u,53*u,6.8*u,'#8a4a12');
    eyeball(ctx,64*u,53*u,6.8*u,'#8a4a12');
    softPoly(ctx,[[44.5*u,65*u],[55.5*u,65*u],[50*u,72*u]],'#2c1c12',1.3*u);
    catMouth(ctx,50*u,72*u,9*u,5.5*u,2.3*u,'#6b4326');
  }

  function anCat(ctx, S) {
    var u = S/100; wash(ctx,S,'#e2ecfd','#a7b6f0');
    poly(ctx,[[26*u,44*u],[30*u,12*u],[54*u,32*u]],'#8b909c');
    poly(ctx,[[74*u,44*u],[70*u,12*u],[46*u,32*u]],'#8b909c');
    poly(ctx,[[33*u,37*u],[35*u,21*u],[48*u,33*u]],'#efa6b8');
    poly(ctx,[[67*u,37*u],[65*u,21*u],[52*u,33*u]],'#efa6b8');
    ell(ctx,50*u,57*u,29*u,26*u,0,'#9ba1ad');
    stroke(ctx,3.4*u,'#6a6f79');
    ctx.beginPath();
    ctx.moveTo(43*u,34*u); ctx.lineTo(41*u,44*u);
    ctx.moveTo(50*u,32*u); ctx.lineTo(50*u,43*u);
    ctx.moveTo(57*u,34*u); ctx.lineTo(59*u,44*u);
    ctx.stroke();
    ell(ctx,50*u,69*u,16*u,11*u,0,'#e9ebef');
    eyeball(ctx,38*u,55*u,7.2*u,'#46b062');
    eyeball(ctx,62*u,55*u,7.2*u,'#46b062');
    poly(ctx,[[45*u,64*u],[55*u,64*u],[50*u,70*u]],'#df7089');
    catMouth(ctx,50*u,70*u,9*u,6*u,2.4*u,'#5b6068');
    stroke(ctx,1.8*u,'rgba(255,255,255,0.92)');
    ctx.beginPath();
    ctx.moveTo(35*u,66*u); ctx.lineTo(16*u,61*u);
    ctx.moveTo(35*u,71*u); ctx.lineTo(15*u,73*u);
    ctx.moveTo(65*u,66*u); ctx.lineTo(84*u,61*u);
    ctx.moveTo(65*u,71*u); ctx.lineTo(85*u,73*u);
    ctx.stroke();
  }

  function anPenguin(ctx, S) {
    var u = S/100; wash(ctx,S,'#f0fbff','#79c2e8');
    circ(ctx,20*u,20*u,9*u,'rgba(255,255,255,0.5)');
    ell(ctx,50*u,82*u,32*u,30*u,0,'#242f3d');
    ell(ctx,17*u,78*u,8*u,21*u,0.30,'#1a2330');
    ell(ctx,83*u,78*u,8*u,21*u,-0.30,'#1a2330');
    /* Belly starts below the chin: when it met the face patch the two white     */
    /* shapes merged and the head stopped reading as a head.                     */
    ell(ctx,50*u,90*u,22*u,22*u,0,'#fdfdfa');
    circ(ctx,50*u,41*u,25*u,'#242f3d');
    ell(ctx,50*u,46*u,18*u,15*u,0,'#fdfdfa');
    eyeball(ctx,42*u,43*u,5.6*u,null);
    eyeball(ctx,58*u,43*u,5.6*u,null);
    poly(ctx,[[42*u,53*u],[58*u,53*u],[50*u,65*u]],'#f5a623');
    poly(ctx,[[46*u,59*u],[54*u,59*u],[50*u,65*u]],'#d6871a');
  }

  function anOwl(ctx, S) {
    var u = S/100; wash(ctx,S,'#314064','#101a2e');
    circ(ctx,78*u,22*u,10*u,'rgba(255,247,214,0.8)');
    circ(ctx,18*u,16*u,1.8*u,'rgba(255,255,255,0.7)');
    circ(ctx,30*u,28*u,1.4*u,'rgba(255,255,255,0.55)');
    ell(ctx,50*u,68*u,28*u,32*u,0,'#8b5c35');
    ell(ctx,50*u,76*u,18*u,22*u,0,'#dbaa6d');
    ell(ctx,24*u,68*u,8*u,20*u,0.16,'#6e4526');
    ell(ctx,76*u,68*u,8*u,20*u,-0.16,'#6e4526');
    poly(ctx,[[27*u,30*u],[24*u,8*u],[44*u,22*u]],'#8b5c35');
    poly(ctx,[[73*u,30*u],[76*u,8*u],[56*u,22*u]],'#8b5c35');
    ell(ctx,50*u,40*u,27*u,23*u,0,'#8b5c35');
    circ(ctx,38*u,41*u,13.5*u,'#ead0a9');
    circ(ctx,62*u,41*u,13.5*u,'#ead0a9');
    eyeball(ctx,38*u,41*u,9*u,'#f5b81c');
    eyeball(ctx,62*u,41*u,9*u,'#f5b81c');
    poly(ctx,[[45*u,47*u],[55*u,47*u],[50*u,58*u]],'#f08a24');
  }

  function anPanda(ctx, S) {
    var u = S/100; wash(ctx,S,'#eefaea','#87c982');
    ctx.fillStyle = 'rgba(70,138,68,0.45)';
    ctx.fillRect(6*u,0,7*u,S); ctx.fillRect(87*u,0,7*u,S);
    circ(ctx,25*u,26*u,13*u,'#20202a');
    circ(ctx,75*u,26*u,13*u,'#20202a');
    ell(ctx,50*u,54*u,33*u,30*u,0,'#fcfcf8');
    ell(ctx,36*u,49*u,11*u,13.5*u,-0.26,'#20202a');
    ell(ctx,64*u,49*u,11*u,13.5*u,0.26,'#20202a');
    eyeball(ctx,36*u,50*u,5*u,null);
    eyeball(ctx,64*u,50*u,5*u,null);
    ell(ctx,50*u,65*u,6.5*u,4.8*u,0,'#20202a');
    catMouth(ctx,50*u,69*u,11*u,7*u,2.6*u,'#20202a');
  }

  function anFrog(ctx, S) {
    var u = S/100; wash(ctx,S,'#d5f2fd','#57b3e6');
    circ(ctx,50*u,96*u,36*u,'#2f8f4e');
    ell(ctx,50*u,62*u,33*u,27*u,0,'#5fc24a');
    circ(ctx,31*u,36*u,15*u,'#5fc24a');
    circ(ctx,69*u,36*u,15*u,'#5fc24a');
    eyeball(ctx,31*u,35*u,10*u,'#f2c230');
    eyeball(ctx,69*u,35*u,10*u,'#f2c230');
    stroke(ctx,3.2*u,'#2f7d38');
    ctx.beginPath(); ctx.arc(50*u,58*u,21*u,0.20*Math.PI,0.80*Math.PI); ctx.stroke();
    circ(ctx,44*u,54*u,1.9*u,'#2f7d38');
    circ(ctx,56*u,54*u,1.9*u,'#2f7d38');
    circ(ctx,24*u,62*u,5.5*u,'rgba(255,130,130,0.45)');
    circ(ctx,76*u,62*u,5.5*u,'rgba(255,130,130,0.45)');
  }

  function anSloth(ctx, S) {
    var u = S/100; wash(ctx,S,'#e3f4d0','#69a64d');
    ctx.fillStyle = '#7a5230'; ctx.fillRect(0,12*u,S,10*u);
    stroke(ctx,9*u,'#a98a63');
    ctx.beginPath();
    ctx.moveTo(28*u,20*u); ctx.lineTo(33*u,50*u);
    ctx.moveTo(72*u,20*u); ctx.lineTo(67*u,50*u);
    ctx.stroke();
    ell(ctx,50*u,80*u,26*u,26*u,0,'#a98a63');
    ell(ctx,50*u,54*u,26*u,24*u,0,'#c6ab87');
    ell(ctx,50*u,58*u,19*u,17*u,0,'#f2e5d1');
    ell(ctx,39*u,53*u,8.5*u,7.5*u,-0.22,'#6a4a2c');
    ell(ctx,61*u,53*u,8.5*u,7.5*u,0.22,'#6a4a2c');
    dotEye(ctx,39*u,53*u,3.5*u);
    dotEye(ctx,61*u,53*u,3.5*u);
    ell(ctx,50*u,63*u,5.5*u,4*u,0,'#4a3320');
    stroke(ctx,2.3*u,'#4a3320');
    ctx.beginPath(); ctx.arc(50*u,64*u,8*u,0.12*Math.PI,0.88*Math.PI); ctx.stroke();
  }

  function anAxolotl(ctx, S) {
    var u = S/100; wash(ctx,S,'#d6f2f9','#3a9dc4');
    circ(ctx,17*u,22*u,4.5*u,'rgba(255,255,255,0.4)');
    circ(ctx,27*u,11*u,2.6*u,'rgba(255,255,255,0.35)');
    circ(ctx,85*u,28*u,3.4*u,'rgba(255,255,255,0.35)');
    poly(ctx,[[50*u,62*u],[88*u,88*u],[62*u,99*u],[38*u,99*u],[12*u,88*u]],'#f7a8c8');
    for (var s=-1; s<=1; s+=2) {
      for (var i=0; i<3; i++) {
        var a  = (s<0 ? Math.PI : 0) + s*(-0.58 + i*0.58);
        var bx = 50*u + s*20*u, by = 45*u;
        var ex = bx + Math.cos(a)*23*u, ey = by + Math.sin(a)*23*u;
        stroke(ctx,5*u,'#f489b4');
        ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(ex,ey); ctx.stroke();
        circ(ctx,ex,ey,6.5*u,'#f06fa6');
      }
    }
    ell(ctx,50*u,51*u,25*u,22*u,0,'#fbb8d2');
    dotEye(ctx,40*u,47*u,3.6*u);
    dotEye(ctx,60*u,47*u,3.6*u);
    stroke(ctx,2.6*u,'#d1568a');
    ctx.beginPath(); ctx.arc(50*u,54*u,11*u,0.16*Math.PI,0.84*Math.PI); ctx.stroke();
    circ(ctx,32*u,57*u,5*u,'rgba(238,105,160,0.45)');
    circ(ctx,68*u,57*u,5*u,'rgba(238,105,160,0.45)');
  }

  function anNarwhal(ctx, S) {
    var u = S/100; wash(ctx,S,'#3a7cb4','#0b2745');
    circ(ctx,22*u,18*u,3.6*u,'rgba(255,255,255,0.3)');
    circ(ctx,31*u,9*u,2.2*u,'rgba(255,255,255,0.25)');
    circ(ctx,80*u,22*u,2.8*u,'rgba(255,255,255,0.22)');
    poly(ctx,[[76*u,66*u],[99*u,50*u],[95*u,68*u],[100*u,84*u]],'#7fa8cf');
    /* The tusk is the whole animal, so it gets drawn fat and with obvious      */
    /* spiral grooves. Drawn before the body so its base disappears into the    */
    /* head instead of sitting on top of it.                                    */
    stroke(ctx,9*u,'#f7f1e2');
    ctx.beginPath(); ctx.moveTo(34*u,58*u); ctx.lineTo(4*u,20*u); ctx.stroke();
    stroke(ctx,2.4*u,'rgba(158,140,112,0.85)');
    ctx.beginPath();
    for (var i=1; i<7; i++) {
      var t = i/7, x1 = 34*u+(4*u-34*u)*t, y1 = 58*u+(20*u-58*u)*t;
      ctx.moveTo(x1-3.2*u,y1-1.8*u); ctx.lineTo(x1+2.6*u,y1+3.4*u);
    }
    ctx.stroke();
    ell(ctx,50*u,66*u,35*u,21*u,-0.07,'#9dc0e2');
    ell(ctx,48*u,72*u,27*u,11*u,-0.05,'#e9f2fb');
    poly(ctx,[[54*u,80*u],[68*u,83*u],[56*u,92*u]],'#7fa8cf');
    dotEye(ctx,32*u,61*u,3.8*u);
    stroke(ctx,2.3*u,'#5b83a8');
    ctx.beginPath(); ctx.arc(27*u,64*u,7.5*u,0.05*Math.PI,0.62*Math.PI); ctx.stroke();
  }

  function anBlobfish(ctx, S) {
    var u = S/100; wash(ctx,S,'#54697a','#111a24');
    /* Narrower than it wants to be, so the tail and side fin clear the body —   */
    /* without them the silhouette reads as a mole rather than a fish.           */
    poly(ctx,[[68*u,62*u],[96*u,44*u],[91*u,64*u],[97*u,86*u]],'#c98f92');
    poly(ctx,[[30*u,76*u],[16*u,92*u],[46*u,84*u]],'#cf9497');
    ctx.fillStyle = '#e3aeb0';
    ctx.beginPath();
    ctx.moveTo(18*u,68*u);
    ctx.bezierCurveTo(16*u,32*u,82*u,32*u,79*u,68*u);
    ctx.bezierCurveTo(79*u,90*u,18*u,90*u,18*u,68*u);
    ctx.closePath(); ctx.fill();
    ell(ctx,48*u,73*u,17*u,15*u,0.12,'#f2c8c9');
    stroke(ctx,3.8*u,'#b9878a');
    ctx.beginPath();
    ctx.moveTo(24*u,54*u); ctx.quadraticCurveTo(33*u,46*u,43*u,48*u);
    ctx.moveTo(57*u,48*u); ctx.quadraticCurveTo(67*u,46*u,75*u,54*u);
    ctx.stroke();
    eyeball(ctx,34*u,59*u,6.6*u,null);
    eyeball(ctx,66*u,59*u,6.6*u,null);
    stroke(ctx,3.4*u,'#a0686c');
    ctx.beginPath(); ctx.arc(48*u,74*u,12*u,0.20*Math.PI,0.80*Math.PI); ctx.stroke();
  }

  function anPlatypus(ctx, S) {
    var u = S/100; wash(ctx,S,'#cbeaf5','#3d8db4');
    ctx.fillStyle = 'rgba(24,104,144,0.32)'; ctx.fillRect(0,76*u,S,S);
    ell(ctx,86*u,60*u,17*u,10*u,-0.32,'#6a4a30');
    ell(ctx,56*u,60*u,31*u,22*u,-0.05,'#8a5f3c');
    poly(ctx,[[64*u,76*u],[84*u,82*u],[62*u,86*u]],'#5d3f28');
    circ(ctx,34*u,46*u,20*u,'#8a5f3c');
    ell(ctx,17*u,55*u,16*u,8*u,0.20,'#dd8c3a');
    ell(ctx,15*u,53*u,12*u,5*u,0.20,'#f0a95a');
    circ(ctx,12*u,52*u,1.7*u,'#a95f1e');
    dotEye(ctx,36*u,40*u,3.9*u);
    circ(ctx,27*u,38*u,2.4*u,'#6d4a2e');
  }

  function anChameleon(ctx, S) {
    var u = S/100; wash(ctx,S,'#f0fad4','#5d9c38');
    stroke(ctx,8*u,'#7a5230');
    ctx.beginPath(); ctx.moveTo(0,86*u); ctx.lineTo(100*u,78*u); ctx.stroke();
    stroke(ctx,7*u,'#3fae72');
    ctx.beginPath();
    ctx.moveTo(74*u,58*u);
    ctx.bezierCurveTo(94*u,58*u,94*u,84*u,79*u,82*u);
    ctx.bezierCurveTo(70*u,80*u,75*u,69*u,82*u,73*u);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(41*u,70*u); ctx.lineTo(37*u,84*u);
    ctx.moveTo(63*u,68*u); ctx.lineTo(67*u,80*u);
    ctx.stroke();
    ell(ctx,52*u,56*u,28*u,20*u,-0.10,'#4cc07e');
    poly(ctx,[[45*u,42*u],[31*u,16*u],[19*u,46*u]],'#38a768');
    ell(ctx,26*u,49*u,21*u,17*u,-0.12,'#4cc07e');
    circ(ctx,54*u,50*u,4.2*u,'rgba(243,201,60,0.75)');
    circ(ctx,65*u,57*u,3.6*u,'rgba(240,125,60,0.7)');
    circ(ctx,45*u,62*u,3.2*u,'rgba(243,201,60,0.6)');
    circ(ctx,24*u,43*u,9.5*u,'#3fae72');
    circ(ctx,24*u,43*u,5.8*u,'#f5c518');
    circ(ctx,24*u,43*u,2.5*u,'#141414');
    circ(ctx,22*u,41*u,1.6*u,'rgba(255,255,255,0.9)');
    stroke(ctx,2.4*u,'#2f8a58');
    ctx.beginPath(); ctx.moveTo(7*u,55*u); ctx.lineTo(30*u,56*u); ctx.stroke();
  }

  function anShark(ctx, S) {
    var u = S/100; wash(ctx,S,'#3197c9','#062f4d');
    poly(ctx,[[8*u,0],[24*u,0],[44*u,100*u],[22*u,100*u]],'rgba(255,255,255,0.10)');
    poly(ctx,[[58*u,0],[68*u,0],[86*u,100*u],[70*u,100*u]],'rgba(255,255,255,0.07)');
    poly(ctx,[[78*u,54*u],[100*u,28*u],[95*u,58*u],[100*u,84*u]],'#5f7f93');
    poly(ctx,[[44*u,36*u],[57*u,6*u],[68*u,42*u]],'#5f7f93');
    ell(ctx,48*u,58*u,39*u,23*u,0.04,'#7d99ac');
    ell(ctx,46*u,66*u,31*u,13*u,0.04,'#eef3f6');
    poly(ctx,[[42*u,70*u],[26*u,90*u],[54*u,76*u]],'#546f81');
    ctx.fillStyle = '#5a3038';
    ctx.beginPath();
    ctx.moveTo(9*u,62*u);
    ctx.quadraticCurveTo(26*u,57*u,43*u,64*u);
    ctx.quadraticCurveTo(26*u,81*u,9*u,62*u);
    ctx.closePath(); ctx.fill();
    for (var i=0; i<5; i++) {
      var tx = 11*u + i*6.6*u, ty = 60*u + i*0.7*u;
      poly(ctx,[[tx,ty],[tx+5.2*u,ty+0.6*u],[tx+2.6*u,ty+7*u]],'#ffffff');
    }
    for (var j=0; j<3; j++) {
      poly(ctx,[[(14+j*7)*u,(72+j*1.4)*u],[(19+j*7)*u,(72.6+j*1.4)*u],[(16.5+j*7)*u,(66+j*1.4)*u]],'#f2f5f7');
    }
    circ(ctx,29*u,51*u,4.8*u,'#101820');
    circ(ctx,27.6*u,49.6*u,1.7*u,'rgba(255,255,255,0.9)');
    stroke(ctx,2*u,'rgba(78,102,120,0.9)');
    ctx.beginPath();
    for (var k=0; k<3; k++) { ctx.moveTo((50+k*5)*u,48*u); ctx.lineTo((48+k*5)*u,60*u); }
    ctx.stroke();
  }

  function anTRex(ctx, S) {
    var u = S/100; wash(ctx,S,'#ffdca6','#dd5f28');
    circ(ctx,74*u,22*u,11*u,'rgba(255,240,190,0.55)');
    poly(ctx,[[0,100*u],[28*u,56*u],[58*u,100*u]],'rgba(120,58,38,0.32)');
    poly(ctx,[[48*u,100*u],[82*u,48*u],[112*u,100*u]],'rgba(88,42,28,0.38)');
    stroke(ctx,13*u,'#4d9b55');
    ctx.beginPath(); ctx.moveTo(70*u,76*u); ctx.quadraticCurveTo(96*u,76*u,99*u,52*u); ctx.stroke();
    ell(ctx,60*u,72*u,25*u,23*u,0,'#57ad60');
    stroke(ctx,11*u,'#4d9b55');
    ctx.beginPath(); ctx.moveTo(58*u,86*u); ctx.lineTo(55*u,99*u); ctx.stroke();
    /* Skull as curves, not a polygon — as straight edges it read as a box with */
    /* a corner where the brow should be.                                       */
    ctx.fillStyle = '#57ad60';
    ctx.beginPath();
    ctx.moveTo(6*u,46*u);
    ctx.bezierCurveTo(5*u,33*u,14*u,22*u,30*u,21*u);        /* snout up to brow */
    ctx.bezierCurveTo(48*u,20*u,62*u,31*u,63*u,46*u);       /* over the skull   */
    ctx.bezierCurveTo(64*u,54*u,52*u,57*u,38*u,57*u);       /* down to the neck */
    ctx.bezierCurveTo(22*u,57*u,10*u,55*u,6*u,46*u);        /* along the jawline*/
    ctx.closePath(); ctx.fill();
    /* lower jaw */
    ctx.fillStyle = '#4a9752';
    ctx.beginPath();
    ctx.moveTo(9*u,54*u);
    ctx.bezierCurveTo(22*u,60*u,36*u,61*u,45*u,58*u);
    ctx.bezierCurveTo(46*u,67*u,38*u,72*u,26*u,71*u);
    ctx.bezierCurveTo(15*u,70*u,9*u,63*u,9*u,54*u);
    ctx.closePath(); ctx.fill();
    /* the gap between them */
    ctx.fillStyle = '#8e2e3a';
    ctx.beginPath();
    ctx.moveTo(8*u,52*u);
    ctx.bezierCurveTo(22*u,57*u,36*u,58*u,45*u,56*u);
    ctx.bezierCurveTo(36*u,62*u,20*u,61*u,8*u,56*u);
    ctx.closePath(); ctx.fill();
    for (var i=0; i<6; i++) {
      var tx = 12*u + i*5.4*u, ty = 52*u + i*0.9*u;
      poly(ctx,[[tx,ty],[tx+3.6*u,ty+0.5*u],[tx+1.8*u,ty+6.4*u]],'#ffffff');
      poly(ctx,[[tx+2.4*u,ty+11*u],[tx+6*u,ty+11.2*u],[tx+4.2*u,ty+5*u]],'#f4f4f0');
    }
    circ(ctx,30*u,34*u,5.6*u,'#f7d24a');
    circ(ctx,30*u,34*u,2.4*u,'#141414');
    circ(ctx,28.3*u,32.4*u,1.7*u,'rgba(255,255,255,0.9)');
    circ(ctx,12*u,41*u,2.1*u,'#3d7d45');
    stroke(ctx,6*u,'#4d9b55');
    ctx.beginPath(); ctx.moveTo(48*u,66*u); ctx.lineTo(39*u,72*u); ctx.stroke();
  }

  function anTiger(ctx, S) {
    var u = S/100; wash(ctx,S,'#f7e8c0','#8b7838');
    circ(ctx,23*u,29*u,12.5*u,'#e07a1f');
    circ(ctx,77*u,29*u,12.5*u,'#e07a1f');
    circ(ctx,23*u,29*u,6.2*u,'#2d1c13');
    circ(ctx,77*u,29*u,6.2*u,'#2d1c13');
    ell(ctx,50*u,57*u,34*u,31*u,0,'#f2921f');
    ell(ctx,41*u,71*u,13*u,10*u,0,'#fdf7ea');
    ell(ctx,59*u,71*u,13*u,10*u,0,'#fdf7ea');
    ell(ctx,50*u,61*u,18*u,11*u,0,'#fdf7ea');
    stroke(ctx,3.6*u,'#2d1c13');
    ctx.beginPath();
    ctx.moveTo(50*u,29*u); ctx.lineTo(50*u,41*u);
    ctx.moveTo(41*u,31*u); ctx.lineTo(43*u,42*u);
    ctx.moveTo(59*u,31*u); ctx.lineTo(57*u,42*u);
    ctx.moveTo(17*u,48*u); ctx.lineTo(30*u,52*u);
    ctx.moveTo(16*u,59*u); ctx.lineTo(29*u,61*u);
    ctx.moveTo(19*u,69*u); ctx.lineTo(30*u,69*u);
    ctx.moveTo(83*u,48*u); ctx.lineTo(70*u,52*u);
    ctx.moveTo(84*u,59*u); ctx.lineTo(71*u,61*u);
    ctx.moveTo(81*u,69*u); ctx.lineTo(70*u,69*u);
    ctx.stroke();
    eyeball(ctx,38*u,53*u,7.2*u,'#f5c518');
    eyeball(ctx,62*u,53*u,7.2*u,'#f5c518');
    poly(ctx,[[44*u,64*u],[56*u,64*u],[50*u,71*u]],'#c2565f');
    catMouth(ctx,50*u,71*u,12*u,7*u,2.8*u,'#2d1c13');
  }

  /* Concentric coils read as a spiral, not a snake. An S-curve does, so the    */
  /* body is two cubics stroked twice (dark edge, lighter fill) with diamonds   */
  /* sampled along the same curve.                                              */
  function anSnake(ctx, S) {
    var u = S/100; wash(ctx,S,'#fbeaba','#c28f2c');
    var ax = [10,60,12,50], ay = [97,95,66,56];
    var bx = [50,80,74,60], by = [56,48,32,30];
    function cube(p,t) { var m=1-t; return m*m*m*p[0]+3*m*m*t*p[1]+3*m*t*t*p[2]+t*t*t*p[3]; }
    function body(w,col) {
      stroke(ctx,w,col);
      ctx.beginPath();
      ctx.moveTo(ax[0]*u,ay[0]*u);
      ctx.bezierCurveTo(ax[1]*u,ay[1]*u,ax[2]*u,ay[2]*u,ax[3]*u,ay[3]*u);
      ctx.bezierCurveTo(bx[1]*u,by[1]*u,bx[2]*u,by[2]*u,bx[3]*u,by[3]*u);
      ctx.stroke();
    }
    body(19*u,'#2f8b3f');
    body(14*u,'#57c464');
    for (var i=1; i<=11; i++) {
      var t = i/12, sx, sy;
      if (t < 0.5) { sx = cube(ax,t*2);       sy = cube(ay,t*2); }
      else         { sx = cube(bx,(t-0.5)*2); sy = cube(by,(t-0.5)*2); }
      poly(ctx,[[sx*u,(sy-5.5)*u],[(sx+5.5)*u,sy*u],[sx*u,(sy+5.5)*u],[(sx-5.5)*u,sy*u]],
           'rgba(26,100,50,0.8)');
    }
    ell(ctx,70*u,23*u,18*u,13*u,0,'#57c464');
    circ(ctx,63*u,18*u,4.8*u,'#f5c518'); circ(ctx,63.6*u,18.6*u,2.1*u,'#141414');
    circ(ctx,78*u,18*u,4.8*u,'#f5c518'); circ(ctx,78.6*u,18.6*u,2.1*u,'#141414');
    circ(ctx,84*u,25*u,1.6*u,'#2f8b3f'); circ(ctx,88*u,29*u,1.6*u,'#2f8b3f');
    stroke(ctx,2.8*u,'#e0466b');
    ctx.beginPath();
    ctx.moveTo(86*u,31*u); ctx.lineTo(96*u,37*u);
    ctx.moveTo(96*u,37*u); ctx.lineTo(105*u,33*u);
    ctx.moveTo(96*u,37*u); ctx.lineTo(104*u,43*u);
    ctx.stroke();
  }

  /* ---- Requested by name: a silly sea star and a crocodile ----------------- */
  /* "Silly" is carried by the eyes: googly, mismatched in size, pupils looking  */
  /* in different directions. Everything else stays in the house style above.    */
  function googly(ctx, x, y, r, px, py) {
    circ(ctx,x,y,r*1.12,'#1c1c1c');
    circ(ctx,x,y,r,'#ffffff');
    circ(ctx,x+px*r*0.42,y+py*r*0.42,r*0.5,'#141414');
    circ(ctx,x+px*r*0.42-r*0.16,y+py*r*0.42-r*0.18,r*0.15,'rgba(255,255,255,0.95)');
  }

  /* A five-pointed star through softPoly reads as a cookie cutter, so each arm  */
  /* is its own fat rounded wedge drawn out from the middle, and one of them is  */
  /* bent up — waving.                                                          */
  function anSeaStar(ctx, S) {
    var u = S/100; wash(ctx,S,'#dff7ff','#2c93c4');
    circ(ctx,16*u,24*u,3*u,'rgba(255,255,255,0.45)');
    circ(ctx,21*u,15*u,2*u,'rgba(255,255,255,0.45)');
    circ(ctx,84*u,78*u,2.5*u,'rgba(255,255,255,0.4)');
    ell(ctx,50*u,96*u,52*u,12*u,0,'#f3d9a0');
    var cx = 50*u, cy = 55*u, i;
    var arms = [-90, -18, 54, 126, 198];
    var lens = [38, 40, 36, 36, 37];
    function arm(deg, len, col, w) {
      var a = deg*Math.PI/180, tx = cx+Math.cos(a)*len*u, ty = cy+Math.sin(a)*len*u;
      var bend = (deg === -18) ? -0.45 : 0;   /* the waving arm */
      var mx = cx+Math.cos(a+bend*0.5)*len*0.55*u, my = cy+Math.sin(a+bend*0.5)*len*0.55*u;
      if (bend) { tx = cx+Math.cos(a+bend)*len*u; ty = cy+Math.sin(a+bend)*len*u; }
      stroke(ctx,w*u,col);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.quadraticCurveTo(mx,my,tx,ty); ctx.stroke();
      ctx.lineWidth = w*0.55*u;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.quadraticCurveTo(mx,my,tx,ty); ctx.stroke();
      return [mx,my,tx,ty];
    }
    for (i=0; i<5; i++) arm(arms[i],lens[i],'#e5532f',19);
    circ(ctx,cx,cy,22*u,'#e5532f');
    var tips = [];
    for (i=0; i<5; i++) tips.push(arm(arms[i],lens[i]-1,'#ff7d55',16));
    circ(ctx,cx,cy,20.5*u,'#ff7d55');
    /* bumps down each arm */
    for (i=0; i<5; i++) {
      for (var k=1; k<=2; k++) {
        var t = 0.45 + k*0.2, m = tips[i];
        var bx = (1-t)*(1-t)*cx + 2*(1-t)*t*m[0] + t*t*m[2];
        var by = (1-t)*(1-t)*cy + 2*(1-t)*t*m[1] + t*t*m[3];
        circ(ctx,bx,by,(2.3-k*0.4)*u,'#ffc0a3');
      }
    }
    googly(ctx,41*u,47*u,8*u,0.5,-0.6);
    googly(ctx,60*u,46*u,10*u,-0.6,0.5);
    circ(ctx,33*u,60*u,4*u,'rgba(255,90,120,0.45)');
    circ(ctx,68*u,60*u,4*u,'rgba(255,90,120,0.45)');
    /* big open grin, tongue out */
    ctx.beginPath();
    ctx.moveTo(39*u,59*u); ctx.quadraticCurveTo(50*u,61*u,62*u,58*u);
    ctx.quadraticCurveTo(58*u,74*u,50*u,73*u);
    ctx.quadraticCurveTo(41*u,73*u,39*u,59*u);
    ctx.closePath(); ctx.fillStyle = '#7a1b26'; ctx.fill();
    ell(ctx,52*u,69*u,6*u,4.2*u,0,'#ff8fa6');
    stroke(ctx,1.6*u,'#5a1019');
    ctx.beginPath(); ctx.moveTo(39*u,59*u); ctx.quadraticCurveTo(50*u,61*u,62*u,58*u); ctx.stroke();
  }

  /* Side-on, because a crocodile from the front is a pair of nostrils. The jaws */
  /* hang open in a grin with the tongue out, the eyes sit on top as two bumps,  */
  /* and the water line cuts across the bottom so there's no body to draw.      */
  function anCrocodile(ctx, S) {
    var u = S/100; wash(ctx,S,'#f1fbe0','#6fb35f');
    var dk = '#24662f', md = '#4fb153', lt = '#9bd48a';
    function shape(pts, fill) {
      ctx.beginPath(); ctx.moveTo(pts[0][0]*u,pts[0][1]*u);
      for (var i=1; i<pts.length; i++) {
        if (pts[i].length === 4) ctx.quadraticCurveTo(pts[i][0]*u,pts[i][1]*u,pts[i][2]*u,pts[i][3]*u);
        else ctx.lineTo(pts[i][0]*u,pts[i][1]*u);
      }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      stroke(ctx,2.2*u,dk); ctx.stroke();
    }
    /* lower jaw, hinged at the back and dropped open */
    shape([[6,62],[40,64],[86,73],[92,76,88,82],[50,86],[6,88]],lt);
    /* inside of the mouth: the wedge between the jaws */
    poly(ctx,[[36,58.5],[90,57],[87,73],[40,64]].map(function(p){return [p[0]*u,p[1]*u];}),'#a8283a');
    ell(ctx,70*u,70*u,11*u,4*u,0.18,'#ff7f93');
    /* lower teeth point up off the jaw's top edge */
    for (var b=0; b<5; b++) {
      var bx = 46 + b*8, by = 65.2 + b*1.6;
      poly(ctx,[[bx*u,by*u],[(bx+2.8)*u,(by-5.5)*u],[(bx+5.6)*u,(by+1.2)*u]],'#ffffff');
    }
    /* head and upper jaw */
    shape([[4,62],[2,40,18,32],[34,36],[60,40],[90,44],[98,50,92,57],[60,58],[36,59],[20,62]],md);
    /* upper teeth hang down off the jaw */
    for (var a=0; a<6; a++) {
      var ax = 40 + a*8;
      poly(ctx,[[ax*u,58.6*u],[(ax+2.8)*u,64*u],[(ax+5.6)*u,58.2*u]],'#ffffff');
    }
    /* scutes and nostrils */
    circ(ctx,50*u,46*u,2.2*u,dk); circ(ctx,60*u,48*u,2*u,dk); circ(ctx,70*u,49*u,1.8*u,dk);
    circ(ctx,16*u,50*u,2.4*u,dk); circ(ctx,24*u,54*u,2*u,dk);
    circ(ctx,88*u,46*u,1.4*u,dk); circ(ctx,92.5*u,47*u,1.4*u,dk);
    /* eye bumps, then the googly eyes */
    circ(ctx,22*u,33*u,11.5*u,dk); circ(ctx,22*u,33*u,10*u,md);
    circ(ctx,40*u,35*u,9.5*u,dk);  circ(ctx,40*u,35*u,8*u,md);
    googly(ctx,22*u,29*u,8.5*u,0.7,0.3);
    googly(ctx,40*u,32*u,6.4*u,-0.3,-0.7);
    /* water */
    ctx.beginPath(); ctx.moveTo(0,86*u);
    for (var w=0; w<10; w++) ctx.quadraticCurveTo((w*10+5)*u,(w%2?82:90)*u,(w*10+10)*u,86*u);
    ctx.lineTo(S,S); ctx.lineTo(0,S); ctx.closePath();
    ctx.fillStyle = 'rgba(46,140,200,0.9)'; ctx.fill();
  }

  var ANIMALS = [
    {name:'Fox',        fn:anFox},
    {name:'Cat',        fn:anCat},
    {name:'Penguin',    fn:anPenguin},
    {name:'Owl',        fn:anOwl},
    {name:'Panda',      fn:anPanda},
    {name:'Frog',       fn:anFrog},
    {name:'Sloth',      fn:anSloth},
    {name:'Axolotl',    fn:anAxolotl},
    {name:'Narwhal',    fn:anNarwhal},
    {name:'Blobfish',   fn:anBlobfish},
    {name:'Platypus',   fn:anPlatypus},
    {name:'Chameleon',  fn:anChameleon},
    {name:'Shark',      fn:anShark},
    {name:'T. rex',     fn:anTRex},
    {name:'Tiger',      fn:anTiger},
    {name:'Snake',      fn:anSnake},
    {name:'Sea Star',   fn:anSeaStar},
    {name:'Crocodile',  fn:anCrocodile},
  ];

  /* ---- OpenMoji animals ---------------------------------------------------- */
  /* The monkey the kids asked for, plus the animal-and-a-thing pictures they     */
  /* gave a thumbs up on a test sheet. Unlike the drawings above they are SVG,    */
  /* and an SVG image loads asynchronously while every caller of fn() draws and   */
  /* then uses the canvas straight away. So each image starts loading here, at    */
  /* page load, and any canvas painted before it's ready gets painted again once  */
  /* it is. In practice only the collection tiles built at startup ever wait.    */

  var MOJI_WASH = ['#fff6d5', '#f7cf63'];  /* the yellow disc from the test sheets */

  function svgAnimal(entry) {
    var img = new Image(), waiting = [];
    img.onload = function() {
      for (var i=0; i<waiting.length; i++) waiting[i][0].drawImage(img,0,0,waiting[i][1],waiting[i][1]);
      waiting = [];
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(entry.svg);
    return {name: entry.name, fn: function(ctx, S) {
      wash(ctx,S,MOJI_WASH[0],MOJI_WASH[1]);
      if (img.complete && img.naturalWidth) ctx.drawImage(img,0,0,S,S);
      else waiting.push([ctx,S]);
    }};
  }

  for (var mi=0; mi<RT.art.openmoji.length; mi++) ANIMALS.push(svgAnimal(RT.art.openmoji[mi]));

  RT.art.animals = ANIMALS;
}(window.RT = window.RT || {}));
