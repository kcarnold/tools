/* Food. */
(function (RT) {
  'use strict';

  var draw = RT.draw;
  var ell = draw.ell,
      circ = draw.circ,
      poly = draw.poly,
      softPoly = draw.softPoly,
      wash = draw.wash,
      stroke = draw.stroke,
      dotEye = draw.dotEye;

  /* ---- Food ------------------------------------------------------------------ */
  /* Same contract and helpers as the animals. Each one gets a small face, which  */
  /* is what makes a doughnut something to collect rather than clip art.         */
  function snack(ctx, x, y, s, ink) {
    ink = ink || '#3a2016'; s *= 1.35;
    dotEye(ctx,x-s,y,s*0.32);
    dotEye(ctx,x+s,y,s*0.32);
    circ(ctx,x-s*1.6,y+s*0.75,s*0.36,'rgba(255,100,120,0.45)');
    circ(ctx,x+s*1.6,y+s*0.75,s*0.36,'rgba(255,100,120,0.45)');
    stroke(ctx,s*0.2,ink);
    ctx.beginPath(); ctx.arc(x,y+s*0.35,s*0.45,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
  }

  function fdPizza(ctx, S) {
    var u = S/100; wash(ctx,S,'#fff3df','#e9a35a');
    softPoly(ctx,[[18*u,22*u],[82*u,22*u],[50*u,90*u]],'#f6c445',3*u);
    softPoly(ctx,[[15*u,15*u],[85*u,15*u],[86*u,25*u],[14*u,25*u]],'#c9822f',4*u);
    circ(ctx,36*u,36*u,6.5*u,'#d8402f'); circ(ctx,62*u,34*u,6*u,'#d8402f');
    circ(ctx,52*u,68*u,5*u,'#d8402f'); circ(ctx,44*u,52*u,1.6*u,'#3c7a2a');
    circ(ctx,66*u,52*u,1.6*u,'#3c7a2a'); circ(ctx,30*u,28*u,1.4*u,'#3c7a2a');
    snack(ctx,50*u,46*u,5*u);
  }

  function fdDoughnut(ctx, S) {
    var u = S/100; wash(ctx,S,'#fde7f3','#e97fb4');
    circ(ctx,50*u,52*u,36*u,'#d99a55');
    ctx.beginPath();
    for (var i=0; i<=24; i++) {
      var a = i/24*Math.PI*2, r = (31 + (i%2 ? 2.5 : -1))*u;
      var x = 50*u+Math.cos(a)*r, y = 50*u+Math.sin(a)*r;
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.fillStyle = '#ff8fc3'; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 3*u; ctx.strokeStyle = '#ff8fc3'; ctx.stroke();
    circ(ctx,50*u,51*u,9*u,'#c27f3e'); circ(ctx,50*u,51*u,7.5*u,'#f6c0dc');
    var sp = ['#ffffff','#5bc0eb','#fde74c','#9bc53d','#ffffff','#5bc0eb','#fde74c','#9bc53d'];
    for (var k=0; k<14; k++) {
      var aa = k/14*Math.PI*2+0.2, rr = (k%2 ? 23 : 17)*u;
      ctx.save(); ctx.translate(50*u+Math.cos(aa)*rr,50*u+Math.sin(aa)*rr); ctx.rotate(aa*2.3);
      ctx.fillStyle = sp[k%sp.length]; ctx.fillRect(-2.4*u,-0.8*u,4.8*u,1.6*u); ctx.restore();
    }
    snack(ctx,50*u,72*u,4.5*u,'#5a2d14');
  }

  function fdWatermelon(ctx, S) {
    var u = S/100; wash(ctx,S,'#eafbe4','#79c36a');
    ctx.beginPath(); ctx.arc(50*u,34*u,44*u,0.12*Math.PI,0.88*Math.PI); ctx.closePath();
    ctx.fillStyle = '#2f8f3a'; ctx.fill();
    ctx.beginPath(); ctx.arc(50*u,34*u,39*u,0.12*Math.PI,0.88*Math.PI); ctx.closePath();
    ctx.fillStyle = '#e8f5c8'; ctx.fill();
    ctx.beginPath(); ctx.arc(50*u,34*u,36*u,0.12*Math.PI,0.88*Math.PI); ctx.closePath();
    ctx.fillStyle = '#ff5468'; ctx.fill();
    var seeds = [[28,46],[40,58],[60,58],[72,46],[50,64],[34,50]];
    for (var i=0; i<seeds.length; i++) ell(ctx,seeds[i][0]*u,seeds[i][1]*u,1.4*u,2.4*u,0.3,'#2b1a12');
    snack(ctx,50*u,46*u,5*u,'#5a1018');
  }

  function fdIceCream(ctx, S) {
    var u = S/100; wash(ctx,S,'#eaf6ff','#7fb8e8');
    poly(ctx,[[32*u,50*u],[68*u,50*u],[50*u,94*u]],'#e2a85a');
    stroke(ctx,1.4*u,'#b77c35'); ctx.beginPath();
    ctx.moveTo(38*u,55*u); ctx.lineTo(58*u,80*u); ctx.moveTo(52*u,52*u); ctx.lineTo(64*u,66*u);
    ctx.moveTo(62*u,55*u); ctx.lineTo(42*u,80*u); ctx.moveTo(48*u,52*u); ctx.lineTo(36*u,66*u);
    ctx.stroke();
    circ(ctx,50*u,38*u,21*u,'#ffb3cf');
    circ(ctx,33*u,47*u,7*u,'#ffb3cf'); circ(ctx,45*u,51*u,7*u,'#ffb3cf');
    circ(ctx,57*u,51*u,7*u,'#ffb3cf'); circ(ctx,68*u,47*u,7*u,'#ffb3cf');
    circ(ctx,50*u,15*u,5.5*u,'#e3263f'); stroke(ctx,1.4*u,'#3c7a2a');
    ctx.beginPath(); ctx.moveTo(50*u,10*u); ctx.quadraticCurveTo(53*u,4*u,58*u,5*u); ctx.stroke();
    snack(ctx,50*u,38*u,5*u,'#6a2140');
  }

  function fdStrawberry(ctx, S) {
    var u = S/100; wash(ctx,S,'#fff0f0','#f48a8a');
    ctx.beginPath();
    ctx.moveTo(50*u,90*u);
    ctx.bezierCurveTo(14*u,62*u,14*u,26*u,50*u,28*u);
    ctx.bezierCurveTo(86*u,26*u,86*u,62*u,50*u,90*u);
    ctx.fillStyle = '#e8303f'; ctx.fill();
    var seeds = [[34,40],[50,38],[66,40],[30,54],[70,54],[40,68],[60,68],[50,80],[38,48],[62,48]];
    for (var i=0; i<seeds.length; i++) ell(ctx,seeds[i][0]*u,seeds[i][1]*u,1.1*u,1.8*u,0,'#ffe27a');
    softPoly(ctx,[[32*u,28*u],[42*u,22*u],[50*u,14*u],[58*u,22*u],[68*u,28*u],[56*u,32*u],[50*u,36*u],[44*u,32*u]],'#3fa34d',1.5*u);
    snack(ctx,50*u,54*u,5*u,'#5a1018');
  }

  function fdCupcake(ctx, S) {
    var u = S/100; wash(ctx,S,'#f6efff','#b49bea');
    poly(ctx,[[28*u,56*u],[72*u,56*u],[66*u,90*u],[34*u,90*u]],'#5fb6e8');
    stroke(ctx,1.6*u,'#3f8fc2'); ctx.beginPath();
    for (var i=0; i<5; i++) { ctx.moveTo((34+i*8)*u,58*u); ctx.lineTo((37+i*6.5)*u,88*u); }
    ctx.stroke();
    ell(ctx,50*u,54*u,26*u,9*u,0,'#fff7ef');
    ell(ctx,50*u,44*u,21*u,9*u,0,'#fff7ef');
    ell(ctx,50*u,34*u,14*u,8*u,0,'#fff7ef');
    circ(ctx,50*u,22*u,6*u,'#e3263f');
    var sp = ['#ff6fae','#5bc0eb','#fde74c','#9bc53d'];
    var pos = [[34,52],[62,50],[44,40],[58,38],[50,30],[40,56],[66,56]];
    for (var k=0; k<pos.length; k++) circ(ctx,pos[k][0]*u,pos[k][1]*u,1.4*u,sp[k%4]);
    snack(ctx,50*u,72*u,4.6*u,'#16466a');
  }

  function fdBanana(ctx, S) {
    var u = S/100; wash(ctx,S,'#fffbe0','#f2cf4a');
    stroke(ctx,24*u,'#c79a12');
    ctx.beginPath(); ctx.moveTo(18*u,30*u); ctx.quadraticCurveTo(30*u,82*u,84*u,62*u); ctx.stroke();
    stroke(ctx,20*u,'#ffe14d');
    ctx.beginPath(); ctx.moveTo(19*u,31*u); ctx.quadraticCurveTo(30*u,80*u,83*u,61*u); ctx.stroke();
    stroke(ctx,4*u,'#7a5a14');
    ctx.beginPath(); ctx.moveTo(14*u,24*u); ctx.lineTo(18*u,30*u); ctx.stroke();
    circ(ctx,86*u,62*u,2.6*u,'#5a3e10');
    snack(ctx,42*u,58*u,4.8*u,'#5a3e10');
  }

  function fdPancakes(ctx, S) {
    var u = S/100; wash(ctx,S,'#fff5e6','#e3a25a');
    ell(ctx,50*u,82*u,40*u,8*u,0,'#ffffff');
    for (var i=0; i<4; i++) {
      var y = (76 - i*11)*u;
      ell(ctx,50*u,y+2*u,32*u,7*u,0,'#b06a26');
      ell(ctx,50*u,y,32*u,7*u,0,'#f0b35e');
    }
    ctx.beginPath(); ctx.moveTo(22*u,40*u);
    ctx.quadraticCurveTo(50*u,28*u,78*u,40*u); ctx.lineTo(76*u,46*u);
    ctx.quadraticCurveTo(70*u,56*u,66*u,46*u); ctx.quadraticCurveTo(50*u,52*u,36*u,46*u);
    ctx.quadraticCurveTo(30*u,58*u,26*u,46*u); ctx.closePath();
    ctx.fillStyle = 'rgba(150,72,10,0.85)'; ctx.fill();
    ctx.fillStyle = '#fff3a8'; ctx.fillRect(43*u,30*u,14*u,7*u);
    snack(ctx,50*u,58*u,4.6*u,'#5a2d0c');
  }

  function fdAvocado(ctx, S) {
    var u = S/100; wash(ctx,S,'#f1fbe4','#8cc56a');
    ctx.beginPath();
    ctx.moveTo(50*u,10*u);
    ctx.bezierCurveTo(70*u,10*u,70*u,36*u,78*u,58*u);
    ctx.bezierCurveTo(86*u,82*u,68*u,94*u,50*u,94*u);
    ctx.bezierCurveTo(32*u,94*u,14*u,82*u,22*u,58*u);
    ctx.bezierCurveTo(30*u,36*u,30*u,10*u,50*u,10*u);
    ctx.fillStyle = '#2f5d23'; ctx.fill();
    ctx.save(); ctx.translate(50*u,54*u); ctx.scale(0.88,0.9); ctx.translate(-50*u,-54*u);
    ctx.fillStyle = '#d9ec8a'; ctx.fill(); ctx.restore();
    circ(ctx,50*u,68*u,13*u,'#9a5a2a');
    circ(ctx,46*u,64*u,3*u,'rgba(255,255,255,0.35)');
    snack(ctx,50*u,40*u,4.6*u,'#2f3a14');
  }

  function fdFriedEgg(ctx, S) {
    var u = S/100; wash(ctx,S,'#eef3f7','#8ea4b8');
    ctx.beginPath();
    var blob = [[50,12],[78,18],[90,44],[82,74],[56,88],[26,84],[10,58],[18,26]];
    ctx.moveTo((blob[0][0]+blob[7][0])/2*u,(blob[0][1]+blob[7][1])/2*u);
    for (var i=0; i<8; i++) {
      var p = blob[i], q = blob[(i+1)%8];
      ctx.quadraticCurveTo(p[0]*u,p[1]*u,(p[0]+q[0])/2*u,(p[1]+q[1])/2*u);
    }
    ctx.fillStyle = '#ffffff'; ctx.fill();
    circ(ctx,52*u,52*u,18*u,'#ffb21e');
    circ(ctx,46*u,45*u,4.5*u,'rgba(255,255,255,0.55)');
    snack(ctx,52*u,53*u,4.6*u,'#7a3d00');
  }

  var FOODS = [
    {name:'Pizza',      fn:fdPizza},
    {name:'Doughnut',   fn:fdDoughnut},
    {name:'Watermelon', fn:fdWatermelon},
    {name:'Ice Cream',  fn:fdIceCream},
    {name:'Strawberry', fn:fdStrawberry},
    {name:'Cupcake',    fn:fdCupcake},
    {name:'Banana',     fn:fdBanana},
    {name:'Pancakes',   fn:fdPancakes},
    {name:'Avocado',    fn:fdAvocado},
    {name:'Fried Egg',  fn:fdFriedEgg},
  ];

  RT.art.food = FOODS;
}(window.RT = window.RT || {}));
