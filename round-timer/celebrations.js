/* End-of-timer effects; one is picked at random each time the timer finishes.  */
/*                                                                              */
/* Each effect is a function (ctx, S, elapsed, look), drawn over the revealed   */
/* picture. look is {onLight, ink, fade}: whether the picture is a light one,   */
/* the ink that shows up on it, and an alpha to multiply into everything.       */
(function (RT) {
  'use strict';

  var rand = RT.draw.rand;

  var DURATION = 8000;
  var FADE     = 1200;   /* tail of DURATION spent fading the effect out */

  function rings(ctx, S, elapsed, look) {
    var cx=S/2, cy=S/2, t=elapsed/DURATION;
    var cols=look.onLight
      ? ['180,120,0','0,120,180','170,20,110','0,130,70','180,70,0','90,50,170']
      : ['255,220,50','80,220,255','255,100,200','100,255,160','255,160,60','200,150,255'];
    for (var i=0; i<6; i++) {
      var phase=(t*2+i/6)%1;
      ctx.beginPath(); ctx.arc(cx,cy,phase*S*0.52,0,Math.PI*2);
      ctx.strokeStyle='rgba('+cols[i]+','+(1-phase)*0.75*look.fade+')';
      ctx.lineWidth=5-phase*3; ctx.stroke();
    }
  }

  function confetti(ctx, S, elapsed, look) {
    var cols=['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6'];
    var n=70, life=3600;
    for (var i=0; i<n; i++) {
      var seed=i*17+3;
      var delay=rand(seed)*(DURATION-life-FADE);
      var te=elapsed-delay;
      if (te<0) continue;
      var tt=Math.min(te/life,1);
      var x=rand(seed+1)*S+(rand(seed+2)-0.5)*S*0.3*tt;
      var y=-S*0.08+tt*S*1.15;
      var rot=rand(seed+3)*Math.PI*2+tt*8*(rand(seed+4)>0.5?1:-1);
      var w=S*0.02+rand(seed+5)*S*0.02, h=w*0.6;
      var alpha=(tt>0.82 ? Math.max(0,(1-tt)/0.18) : 1)*look.fade;
      ctx.save(); ctx.globalAlpha=alpha;
      ctx.translate(x,y); ctx.rotate(rot);
      ctx.fillStyle=cols[i%cols.length];
      ctx.fillRect(-w/2,-h/2,w,h);
      ctx.restore();
    }
  }

  function sparkle(ctx, S, elapsed, look) {
    var cx=S/2, cy=S/2, t=elapsed/DURATION;
    var n=80, waves=2;   /* two passes so the longer window keeps re-seeding    */
    for (var w=0; w<waves; w++) {
      var wt=(t*waves)-w;
      if (wt<0 || wt>1) continue;
      for (var i=0; i<n; i++) {
        var seed=i*23+5+w*331;
        var angle=rand(seed)*Math.PI*2;
        var speed=0.22+rand(seed+1)*0.55;
        var dist=wt*speed*S;
        if (dist>S*0.56) continue;
        var x=cx+Math.cos(angle)*dist, y=cy+Math.sin(angle)*dist;
        var twinkle=0.5+0.5*Math.sin(wt*40+seed);
        var alpha=Math.max(0,1-wt)*twinkle*look.fade;
        var r=S*0.006+rand(seed+2)*S*0.011;
        ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=look.ink;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function fireworks(ctx, S, elapsed, look) {
    var cols=look.onLight
      ? ['200,30,30','190,120,0','0,120,190','110,50,200','0,140,80','190,40,130']
      : ['255,80,80','255,190,60','120,220,255','170,120,255','120,255,170','255,120,200'];
    var bursts=8, burstDur=1700, particles=22;
    for (var b=0; b<bursts; b++) {
      var seed=b*101+7;
      var startT=rand(seed)*(DURATION-burstDur-FADE);
      var te=elapsed-startT;
      if (te<0 || te>burstDur) continue;
      var cx=S*(0.25+rand(seed+1)*0.5), cy=S*(0.22+rand(seed+2)*0.5);
      var tt=te/burstDur, col=cols[b%cols.length];
      for (var p=0; p<particles; p++) {
        var pseed=seed+p*3+1;
        var angle=(p/particles)*Math.PI*2+rand(pseed)*0.3;
        var speed=S*(0.2+rand(pseed+1)*0.13);
        var x=cx+Math.cos(angle)*speed*tt;
        var y=cy+Math.sin(angle)*speed*tt+tt*tt*S*0.12;
        var alpha=Math.max(0,1-tt*1.15)*look.fade;
        ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle='rgba('+col+',1)';
        ctx.beginPath(); ctx.arc(x,y,S*0.008,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function pulse(ctx, S, elapsed, look) {
    var cx=S/2, cy=S/2, t=(elapsed%1400)/1400;
    var pulses=3;
    for (var i=0; i<pulses; i++) {
      var phase=(t+i/pulses)%1;
      var r=phase*S*0.55;
      var alpha=(1-phase)*(look.onLight?0.7:0.55)*look.fade;
      ctx.save(); ctx.globalAlpha=alpha;
      ctx.strokeStyle=look.ink; ctx.lineWidth=S*0.015;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }

  var EFFECTS = [rings, confetti, sparkle, fireworks, pulse];

  /* Whether what's on the canvas is mostly light. */
  function isLight(ctx, S) {
    try {
      var d=ctx.getImageData(0,0,S,S).data, sum=0, n=0;
      /* Stride is a prime multiple of the 4-byte stride so the samples don't    */
      /* land on a repeating column of a patterned artwork.                      */
      for (var i=0; i<d.length; i+=4*37) {
        if (d[i+3]<128) continue;                       /* outside the circle    */
        sum += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        n++;
      }
      return n > 0 && sum/n > 140;
    } catch (e) { return false; }   /* tainted canvas */
  }

  RT.celebrations = {
    DURATION: DURATION,

    /* Call with the revealed picture on the canvas. Returns draw(elapsed). */
    start: function(ctx, S) {
      var onLight = isLight(ctx, S);
      var look = {onLight: onLight, ink: onLight ? '#0b1220' : '#ffffff', fade: 1};
      var effect = EFFECTS[Math.floor(Math.random()*EFFECTS.length)];
      return function(elapsed) {
        look.fade = Math.max(0, Math.min(1, (DURATION-elapsed)/FADE));
        ctx.save(); ctx.beginPath(); ctx.arc(S/2,S/2,S/2,0,Math.PI*2); ctx.clip();
        /* A dark halo under everything keeps bright confetti and rings legible  */
        /* on a pale picture. The effects' own save()/restore() inherit it.      */
        if (onLight) { ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=S*0.022; }
        effect(ctx, S, elapsed, look);
        ctx.restore();
      };
    }
  };
}(window.RT = window.RT || {}));
