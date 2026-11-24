/* Procedural patterns. */
(function (RT) {
  'use strict';

  var draw = RT.draw;
  var rand = draw.rand;

  /* ---- Procedural art ---------------------------------------------------- */
  /* NOTE: All transparency uses rgba() — 8-digit hex (#rrggbbaa) is          */
  /*       invalid on iOS 9 Safari and causes addColorStop to throw.          */

  function artMandala(ctx, S) {
    var cx = S/2, cy = S/2;
    var bg = ctx.createRadialGradient(cx,cy,0,cx,cy,S/2);
    bg.addColorStop(0,'#1a0535'); bg.addColorStop(1,'#07020f');
    ctx.fillStyle = bg; ctx.fillRect(0,0,S,S);
    var layers = [
      {n:16,r:S*0.46,pw:0.12,c1:'#e040fb',c2:'#7c4dff',a:0.45},
      {n:10,r:S*0.40,pw:0.28,c1:'#00e5ff',c2:'#1de9b6',a:0.70},
      {n: 8,r:S*0.30,pw:0.28,c1:'#ff6f00',c2:'#ffd740',a:0.72},
      {n:12,r:S*0.18,pw:0.28,c1:'#e040fb',c2:'#ff4081',a:0.80},
      {n: 6,r:S*0.10,pw:0.35,c1:'#ffd740',c2:'#ff6f00',a:0.90},
    ];
    layers.forEach(function(l) {
      for (var i=0; i<l.n; i++) {
        var angle = (i/l.n)*Math.PI*2;
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle); ctx.globalAlpha = l.a;
        var g = ctx.createLinearGradient(0,0,0,l.r);
        g.addColorStop(0,l.c1); g.addColorStop(1,l.c2); ctx.fillStyle = g;
        var pw = l.r*l.pw;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.bezierCurveTo(pw,l.r*0.15,pw,l.r*0.85,0,l.r);
        ctx.bezierCurveTo(-pw,l.r*0.85,-pw,l.r*0.15,0,0);
        ctx.fill(); ctx.restore();
      }
    });
    ctx.save(); ctx.globalAlpha = 1;
    var cg = ctx.createRadialGradient(cx,cy,0,cx,cy,S*0.055);
    cg.addColorStop(0,'#ffffff'); cg.addColorStop(1,'#ffd740'); ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx,cy,S*0.055,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  function artSunburst(ctx, S) {
    var cx=S/2, cy=S/2;
    ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,S,S);
    /* Palette as separate opaque and transparent rgba pairs                   */
    /* (avoids 8-digit hex which throws on iOS 9 Safari addColorStop)         */
    var palOpaque = [
      'rgba(239,68,68,1)',   'rgba(249,115,22,1)',  'rgba(234,179,8,1)',
      'rgba(34,197,94,1)',   'rgba(59,130,246,1)',   'rgba(139,92,246,1)',
      'rgba(236,72,153,1)'
    ];
    var palFade = [
      'rgba(239,68,68,0.13)', 'rgba(249,115,22,0.13)', 'rgba(234,179,8,0.13)',
      'rgba(34,197,94,0.13)', 'rgba(59,130,246,0.13)',  'rgba(139,92,246,0.13)',
      'rgba(236,72,153,0.13)'
    ];
    var n=24;
    for (var i=0; i<n; i++) {
      var a1=(i/n)*Math.PI*2-Math.PI/2, a2=((i+0.82)/n)*Math.PI*2-Math.PI/2;
      var idx = i % palOpaque.length;
      var g=ctx.createRadialGradient(cx,cy,S*0.07,cx,cy,S*0.5);
      g.addColorStop(0,'rgba(255,255,255,1)');
      g.addColorStop(0.25, palOpaque[idx]);
      g.addColorStop(1, palFade[idx]);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,S*0.5,a1,a2); ctx.closePath(); ctx.fillStyle=g; ctx.fill();
    }
    var cg=ctx.createRadialGradient(cx,cy,0,cx,cy,S*0.11);
    cg.addColorStop(0,'rgba(255,255,255,1)'); cg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(cx,cy,S*0.11,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  function artAurora(ctx, S) {
    ctx.fillStyle='#020617'; ctx.fillRect(0,0,S,S);
    /* Stars */
    ctx.save();
    for (var s=0; s<140; s++) {
      ctx.globalAlpha = rand(s*11+7)*0.55+0.25; ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(rand(s*7+1)*S, rand(s*13+2)*S, rand(s*3+5)*1.2+0.3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    /* Bands: transparent ends use rgba(r,g,b,0) instead of hex+'00'          */
    var bands=[
      {y:0.15,h:0.14,freq:2.1,phase:0.0,mid:'rgba(124,58,237,0.78)',   fade:'rgba(124,58,237,0)'},
      {y:0.28,h:0.15,freq:1.7,phase:1.0,mid:'rgba(8,145,178,0.78)',    fade:'rgba(8,145,178,0)'},
      {y:0.42,h:0.14,freq:2.5,phase:0.5,mid:'rgba(5,150,105,0.78)',    fade:'rgba(5,150,105,0)'},
      {y:0.55,h:0.13,freq:1.4,phase:2.0,mid:'rgba(14,165,233,0.78)',   fade:'rgba(14,165,233,0)'},
      {y:0.67,h:0.14,freq:2.8,phase:0.8,mid:'rgba(139,92,246,0.78)',   fade:'rgba(139,92,246,0)'},
      {y:0.80,h:0.13,freq:1.9,phase:1.5,mid:'rgba(6,182,212,0.78)',    fade:'rgba(6,182,212,0)'},
    ];
    bands.forEach(function(b) {
      var steps=80; ctx.save(); ctx.beginPath();
      for (var i=0; i<=steps; i++) {
        var x=(i/steps)*S, y=b.y*S+Math.sin((i/steps)*Math.PI*2*b.freq+b.phase)*0.055*S;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      /* Second loop uses separate index variable to avoid any redecl issues  */
      for (var j=steps; j>=0; j--) {
        var x2=(j/steps)*S, y2=(b.y+b.h)*S+Math.sin((j/steps)*Math.PI*2*b.freq+b.phase+0.6)*0.055*S;
        ctx.lineTo(x2,y2);
      }
      ctx.closePath();
      var g=ctx.createLinearGradient(0,b.y*S,0,(b.y+b.h)*S);
      g.addColorStop(0,b.fade); g.addColorStop(0.5,b.mid); g.addColorStop(1,b.fade);
      ctx.fillStyle=g; ctx.fill(); ctx.restore();
    });
  }

  function artMosaic(ctx, S) {
    var cols=10, cell=S/cols;
    var pal=['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6','#94a3b8'];
    for (var row=0; row<cols; row++) {
      for (var col=0; col<cols; col++) {
        var seed=row*cols+col;
        ctx.fillStyle = pal[Math.floor(rand(seed*7+3)*pal.length)];
        ctx.fillRect(col*cell, row*cell, cell-1.5, cell-1.5);
        ctx.fillStyle='rgba(255,255,255,0.22)';
        ctx.fillRect(col*cell+2, row*cell+2, cell*0.38, cell*0.38);
        ctx.fillStyle='rgba(0,0,0,0.18)';
        ctx.fillRect(col*cell+cell*0.55, row*cell+cell*0.55, cell*0.38, cell*0.38);
      }
    }
  }

  function artSpiral(ctx, S) {
    var cx=S/2, cy=S/2;
    var bg=ctx.createRadialGradient(cx,cy,0,cx,cy,S/2);
    bg.addColorStop(0,'#12082a'); bg.addColorStop(1,'#000000');
    ctx.fillStyle=bg; ctx.fillRect(0,0,S,S);
    ctx.save();
    for (var s=0; s<90; s++) {
      ctx.globalAlpha=rand(s*13+9)*0.5+0.2; ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(rand(s*7+3)*S, rand(s*11+5)*S, rand(s*3+7)*1.4+0.3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    /* Arm fade colors as rgba — was previously 8-digit hex like '#ff6b6b22'  */
    var arms=[
      {offset:0,              c1:'rgba(255,107,107,0.88)', c2:'rgba(255,107,107,0.13)'},
      {offset:Math.PI*2/3,   c1:'rgba(254,202,87,0.88)',  c2:'rgba(254,202,87,0.13)'},
      {offset:Math.PI*4/3,   c1:'rgba(72,219,251,0.88)',  c2:'rgba(72,219,251,0.13)'},
    ];
    arms.forEach(function(arm) {
      var steps=700, maxR=S*0.46;
      ctx.save(); ctx.globalAlpha=0.88; ctx.beginPath();
      for (var i=0; i<=steps; i++) {
        var t=i/steps, angle=arm.offset+t*Math.PI*6, r=t*maxR;
        var x=cx+r*Math.cos(angle), y=cy+r*Math.sin(angle);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      var g=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR);
      g.addColorStop(0,arm.c1); g.addColorStop(1,arm.c2);
      ctx.strokeStyle=g; ctx.lineWidth=S*0.019; ctx.lineJoin='round'; ctx.stroke(); ctx.restore();
    });
  }

  function artWaves(ctx, S) {
    var bg=ctx.createLinearGradient(0,0,0,S);
    bg.addColorStop(0,'#001f3f'); bg.addColorStop(1,'#003d80');
    ctx.fillStyle=bg; ctx.fillRect(0,0,S,S);
    var waves=[
      {y:0.18,amp:0.06,freq:2.2,phase:0.0,c:'rgba(0,210,255,0.55)',  w:S*0.028},
      {y:0.32,amp:0.05,freq:1.8,phase:0.8,c:'rgba(0,255,200,0.50)',  w:S*0.022},
      {y:0.46,amp:0.07,freq:2.6,phase:1.5,c:'rgba(100,180,255,0.60)',w:S*0.032},
      {y:0.60,amp:0.05,freq:1.5,phase:0.3,c:'rgba(0,230,240,0.50)',  w:S*0.022},
      {y:0.74,amp:0.06,freq:2.0,phase:2.1,c:'rgba(150,220,255,0.55)',w:S*0.026},
      {y:0.88,amp:0.04,freq:2.8,phase:1.0,c:'rgba(0,200,255,0.45)',  w:S*0.018},
    ];
    waves.forEach(function(wv) {
      ctx.save(); ctx.beginPath();
      var steps=120;
      for (var i=0; i<=steps; i++) {
        var x=(i/steps)*S;
        var y=wv.y*S+Math.sin((i/steps)*Math.PI*2*wv.freq+wv.phase)*wv.amp*S;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=wv.c; ctx.lineWidth=wv.w; ctx.lineJoin='round'; ctx.stroke(); ctx.restore();
    });
  }

  function artPrism(ctx, S) {
    ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,S,S);
    var cols=[
      ['rgba(255,50,50,0.85)','rgba(255,150,0,0.85)'],
      ['rgba(255,220,0,0.85)','rgba(50,220,50,0.85)'],
      ['rgba(0,180,255,0.85)','rgba(130,0,255,0.85)'],
      ['rgba(255,0,180,0.85)','rgba(255,80,80,0.85)'],
      ['rgba(0,255,200,0.85)','rgba(0,100,255,0.85)'],
      ['rgba(255,180,0,0.85)','rgba(200,0,255,0.85)'],
    ];
    var n=12;
    for (var i=0; i<n; i++) {
      var ci=i%cols.length;
      var g=ctx.createLinearGradient(0,0,S,S);
      g.addColorStop(0,cols[ci][0]); g.addColorStop(1,cols[ci][1]);
      ctx.save(); ctx.globalAlpha=0.78;
      ctx.translate(S/2,S/2); ctx.rotate(i*Math.PI/n);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(S*0.6*Math.cos(0), S*0.6*Math.sin(0));
      ctx.lineTo(S*0.6*Math.cos(Math.PI/n), S*0.6*Math.sin(Math.PI/n));
      ctx.closePath();
      ctx.fillStyle=g; ctx.fill(); ctx.restore();
    }
    var cg=ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S*0.08);
    cg.addColorStop(0,'rgba(255,255,255,1)'); cg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(S/2,S/2,S*0.08,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  function artEmber(ctx, S) {
    var bg=ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
    bg.addColorStop(0,'#3d0000'); bg.addColorStop(0.5,'#1a0000'); bg.addColorStop(1,'#000000');
    ctx.fillStyle=bg; ctx.fillRect(0,0,S,S);
    for (var p=0; p<120; p++) {
      var px=rand(p*7+1)*S, py=rand(p*11+3)*S;
      var pr=rand(p*5+9)*S*0.032+S*0.006;
      var heat=rand(p*3+5);
      var r=Math.floor(255), g2=Math.floor(heat*180), b=0;
      ctx.save(); ctx.globalAlpha=rand(p*13+7)*0.7+0.15;
      var pg=ctx.createRadialGradient(px,py,0,px,py,pr);
      pg.addColorStop(0,'rgba('+r+','+g2+','+b+',1)');
      pg.addColorStop(1,'rgba('+r+',0,0,0)');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    var cg=ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S*0.18);
    cg.addColorStop(0,'rgba(255,255,200,0.9)'); cg.addColorStop(0.4,'rgba(255,140,0,0.6)'); cg.addColorStop(1,'rgba(255,0,0,0)');
    ctx.beginPath(); ctx.arc(S/2,S/2,S*0.18,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  function artForest(ctx, S) {
    var bg=ctx.createLinearGradient(0,0,0,S);
    bg.addColorStop(0,'#001a00'); bg.addColorStop(1,'#0a2a0a');
    ctx.fillStyle=bg; ctx.fillRect(0,0,S,S);
    /* Canopy rings */
    var rings=[
      {r:S*0.48,c:'rgba(0,80,0,0.55)'},
      {r:S*0.40,c:'rgba(10,100,10,0.50)'},
      {r:S*0.32,c:'rgba(20,130,20,0.55)'},
      {r:S*0.24,c:'rgba(40,160,40,0.55)'},
      {r:S*0.16,c:'rgba(80,200,60,0.60)'},
      {r:S*0.09,c:'rgba(150,240,80,0.70)'},
    ];
    rings.forEach(function(ring) {
      ctx.beginPath(); ctx.arc(S/2,S/2,ring.r,0,Math.PI*2);
      ctx.fillStyle=ring.c; ctx.fill();
    });
    /* Leaf dots */
    for (var d=0; d<80; d++) {
      var angle=rand(d*7+1)*Math.PI*2, dist=rand(d*11+3)*S*0.44;
      var dx=S/2+dist*Math.cos(angle), dy=S/2+dist*Math.sin(angle);
      var dr=rand(d*5+9)*S*0.028+S*0.008;
      var green=Math.floor(rand(d*3+7)*80+140);
      ctx.save(); ctx.globalAlpha=0.55;
      ctx.fillStyle='rgba(50,'+green+',20,1)';
      ctx.beginPath(); ctx.arc(dx,dy,dr,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    var cg=ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S*0.07);
    cg.addColorStop(0,'rgba(200,255,120,0.9)'); cg.addColorStop(1,'rgba(100,200,50,0)');
    ctx.beginPath(); ctx.arc(S/2,S/2,S*0.07,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  function artNeon(ctx, S) {
    ctx.fillStyle='#030008'; ctx.fillRect(0,0,S,S);
    var lines=[
      {x1:0.1,y1:0.5,x2:0.9,y2:0.5,c:'rgba(0,255,255,0.9)',  g:'rgba(0,255,255,0)',  w:S*0.008},
      {x1:0.5,y1:0.1,x2:0.5,y2:0.9,c:'rgba(255,0,200,0.9)',  g:'rgba(255,0,200,0)',  w:S*0.008},
      {x1:0.15,y1:0.15,x2:0.85,y2:0.85,c:'rgba(100,255,0,0.8)',  g:'rgba(100,255,0,0)',  w:S*0.006},
      {x1:0.85,y1:0.15,x2:0.15,y2:0.85,c:'rgba(255,180,0,0.8)',  g:'rgba(255,180,0,0)',  w:S*0.006},
    ];
    lines.forEach(function(l) {
      var x1=l.x1*S,y1=l.y1*S,x2=l.x2*S,y2=l.y2*S;
      ctx.save(); ctx.shadowColor=l.c; ctx.shadowBlur=S*0.06;
      ctx.strokeStyle=l.c; ctx.lineWidth=l.w; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.restore();
    });
    var circles=[
      {r:S*0.44,c:'rgba(0,255,255,0.25)'},
      {r:S*0.33,c:'rgba(255,0,200,0.25)'},
      {r:S*0.22,c:'rgba(100,255,0,0.30)'},
      {r:S*0.11,c:'rgba(255,220,0,0.40)'},
    ];
    circles.forEach(function(ci) {
      ctx.save(); ctx.shadowColor=ci.c; ctx.shadowBlur=S*0.04;
      ctx.strokeStyle=ci.c; ctx.lineWidth=S*0.007;
      ctx.beginPath(); ctx.arc(S/2,S/2,ci.r,0,Math.PI*2); ctx.stroke(); ctx.restore();
    });
    var cg=ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S*0.06);
    cg.addColorStop(0,'rgba(255,255,255,1)'); cg.addColorStop(1,'rgba(200,100,255,0)');
    ctx.beginPath(); ctx.arc(S/2,S/2,S*0.06,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  function artNebula(ctx, S) {
    var cx=S/2, cy=S/2;
    ctx.fillStyle='#050014'; ctx.fillRect(0,0,S,S);
    for (var s=0; s<160; s++) {
      ctx.globalAlpha=rand(s*9+2)*0.7+0.15; ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(rand(s*5+1)*S, rand(s*7+3)*S, rand(s*3+6)*0.9+0.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
    var clouds=[
      {x:0.38,y:0.42,r:0.34,c:'rgba(168,85,247,0.55)'},
      {x:0.60,y:0.55,r:0.30,c:'rgba(236,72,153,0.45)'},
      {x:0.48,y:0.62,r:0.26,c:'rgba(56,189,248,0.45)'},
      {x:0.55,y:0.35,r:0.22,c:'rgba(45,212,191,0.40)'},
    ];
    clouds.forEach(function(cl) {
      var g=ctx.createRadialGradient(cl.x*S,cl.y*S,0,cl.x*S,cl.y*S,cl.r*S);
      g.addColorStop(0,cl.c); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
    });
    var core=ctx.createRadialGradient(cx,cy,0,cx,cy,S*0.13);
    core.addColorStop(0,'rgba(255,255,255,0.95)'); core.addColorStop(0.4,'rgba(224,180,255,0.6)'); core.addColorStop(1,'rgba(224,180,255,0)');
    ctx.beginPath(); ctx.arc(cx,cy,S*0.13,0,Math.PI*2); ctx.fillStyle=core; ctx.fill();
  }

  function artSunset(ctx, S) {
    var sky=ctx.createLinearGradient(0,0,0,S*0.62);
    sky.addColorStop(0,'#2e1065'); sky.addColorStop(0.45,'#c026d3'); sky.addColorStop(0.75,'#fb923c'); sky.addColorStop(1,'#fde68a');
    ctx.fillStyle=sky; ctx.fillRect(0,0,S,S*0.62);
    ctx.fillStyle='#fde68a'; ctx.fillRect(0,S*0.62,S,S*0.38);
    var sun=ctx.createRadialGradient(S/2,S*0.60,0,S/2,S*0.60,S*0.22);
    sun.addColorStop(0,'rgba(255,247,214,1)'); sun.addColorStop(0.7,'rgba(255,175,90,0.95)'); sun.addColorStop(1,'rgba(255,120,60,0)');
    ctx.beginPath(); ctx.arc(S/2,S*0.60,S*0.22,0,Math.PI*2); ctx.fillStyle=sun; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(0,0,S,S*0.62); ctx.clip();
    for (var i=0; i<7; i++) {
      var y=S*0.62-i*S*0.05;
      ctx.fillStyle='rgba(46,16,101,'+(0.22+i*0.03)+')';
      ctx.fillRect(0,y,S,S*0.012);
    }
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0,S*0.62,S,S*0.38); ctx.clip();
    var grid=8;
    for (var g=1; g<grid; g++) {
      var gy=S*0.62+Math.pow(g/grid,1.6)*S*0.38;
      ctx.strokeStyle='rgba(194,38,211,0.35)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(S,gy); ctx.stroke();
    }
    for (var v=-4; v<=4; v++) {
      ctx.strokeStyle='rgba(194,38,211,0.30)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(S/2,S*0.62); ctx.lineTo(S/2+v*S*0.16,S); ctx.stroke();
    }
    ctx.restore();
  }

  function artTerrazzo(ctx, S) {
    ctx.fillStyle='#faf7f2'; ctx.fillRect(0,0,S,S);
    var pal=['#f97316','#ec4899','#8b5cf6','#22c55e','#0ea5e9','#f43f5e','#eab308','#14b8a6'];
    for (var i=0; i<70; i++) {
      var seed=i*13+4;
      var x=rand(seed)*S, y=rand(seed+1)*S;
      var r=rand(seed+2)*S*0.05+S*0.012;
      var shape=Math.floor(rand(seed+3)*3);
      ctx.save(); ctx.translate(x,y); ctx.rotate(rand(seed+4)*Math.PI*2);
      ctx.fillStyle=pal[Math.floor(rand(seed+5)*pal.length)];
      ctx.beginPath();
      if (shape===0) { ctx.arc(0,0,r,0,Math.PI*2); }
      else if (shape===1) { ctx.moveTo(0,-r); ctx.lineTo(r,r); ctx.lineTo(-r,r); ctx.closePath(); }
      else { ctx.rect(-r*0.8,-r*0.8,r*1.6,r*1.6); }
      ctx.fill(); ctx.restore();
    }
  }

  function artKaleidoscope(ctx, S) {
    var cx=S/2, cy=S/2, wedges=10;
    ctx.fillStyle='#0b0620'; ctx.fillRect(0,0,S,S);
    var pal=['#f472b6','#facc15','#38bdf8','#a3e635','#fb923c','#c084fc'];
    for (var w=0; w<wedges; w++) {
      var ang=(w/wedges)*Math.PI*2;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,S*0.5,0,Math.PI/wedges); ctx.closePath(); ctx.clip();
      for (var t=0; t<6; t++) {
        var seed=w*7+t*3+1;
        var r0=rand(seed)*S*0.45, size=S*0.05+rand(seed+1)*S*0.10;
        var a=rand(seed+2)*Math.PI/wedges;
        var px=Math.cos(a)*r0, py=Math.sin(a)*r0;
        ctx.save(); ctx.translate(px,py); ctx.rotate(rand(seed+3)*Math.PI*2);
        ctx.fillStyle=pal[(w+t)%pal.length]; ctx.globalAlpha=0.85;
        ctx.beginPath(); ctx.moveTo(0,-size); ctx.lineTo(size*0.8,size*0.6); ctx.lineTo(-size*0.8,size*0.6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    var cg=ctx.createRadialGradient(cx,cy,0,cx,cy,S*0.07);
    cg.addColorStop(0,'rgba(255,255,255,0.95)'); cg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(cx,cy,S*0.07,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  var ARTWORKS = [
    {name:'Mandala',      fn:artMandala},
    {name:'Sunburst',     fn:artSunburst},
    {name:'Aurora',       fn:artAurora},
    {name:'Mosaic',       fn:artMosaic},
    {name:'Spiral',       fn:artSpiral},
    {name:'Waves',        fn:artWaves},
    {name:'Prism',        fn:artPrism},
    {name:'Ember',        fn:artEmber},
    {name:'Forest',       fn:artForest},
    {name:'Neon',         fn:artNeon},
    {name:'Nebula',       fn:artNebula},
    {name:'Sunset',       fn:artSunset},
    {name:'Terrazzo',     fn:artTerrazzo},
    {name:'Kaleidoscope', fn:artKaleidoscope},
  ];

  RT.art.patterns = ARTWORKS;
}(window.RT = window.RT || {}));
