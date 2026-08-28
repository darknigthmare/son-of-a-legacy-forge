(function () {
  const LF = window.LF = window.LF || {};
  const U = LF.utils;
  const R = LF.render = {};

  function withCanvas(canvas, draw) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    draw(ctx, canvas.width, canvas.height);
    ctx.restore();
  }

  function polygon(ctx, points) {
    ctx.beginPath();
    points.forEach(([x,y], index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
  }

  function line(ctx, x1, y1, x2, y2, width, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.restore();
  }

  function drawWing(ctx, type, side, colors, s, time) {
    if (!type || type === 'none') return;
    const dir = side;
    ctx.save();
    ctx.globalAlpha = .72;
    ctx.fillStyle = U.alphaColor(colors[1], .52);
    ctx.strokeStyle = U.alphaColor(colors[2], .85);
    ctx.lineWidth = 2.2 * s;
    const flap = Math.sin(time * 2.4 + side) * 5 * s;
    if (['veil','ghost','clock'].includes(type)) {
      ctx.beginPath();
      ctx.moveTo(0, -36*s);
      ctx.bezierCurveTo(dir*52*s, (-86*s)+flap, dir*83*s, -30*s, dir*42*s, 12*s);
      ctx.bezierCurveTo(dir*20*s, -2*s, dir*20*s, 34*s, 0, 27*s);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (type === 'clock') {
        ctx.globalAlpha = .42;
        ctx.beginPath(); ctx.arc(dir*38*s, -26*s, 22*s, 0, Math.PI*2); ctx.stroke();
        line(ctx, dir*38*s, -26*s, dir*38*s, -42*s, 2*s, colors[2], .6);
        line(ctx, dir*38*s, -26*s, dir*50*s, -18*s, 2*s, colors[2], .6);
      }
    } else if (['ice','insect','fin','petal'].includes(type)) {
      const count = type === 'insect' ? 2 : 3;
      for (let i=0;i<count;i++) {
        const oy = (-38 + i*30)*s;
        ctx.beginPath();
        ctx.moveTo(dir*5*s, oy);
        ctx.quadraticCurveTo(dir*(58+i*8)*s, (oy-24*s)+flap, dir*(70-i*5)*s, oy+12*s);
        ctx.quadraticCurveTo(dir*35*s, oy+25*s, dir*5*s, oy);
        ctx.fill(); ctx.stroke();
      }
    } else if (type === 'speaker') {
      for (let i=0;i<2;i++) {
        ctx.fillStyle = U.alphaColor(colors[i], .55);
        ctx.beginPath(); ctx.arc(dir*42*s, (-35+i*48)*s, (24-i*5)*s, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(dir*42*s, (-35+i*48)*s, (10-i*2)*s, 0, Math.PI*2); ctx.stroke();
      }
    } else if (type === 'thrusters') {
      ctx.fillStyle = colors[1];
      U.roundRect(ctx, dir*12*s-(dir<0?34*s:0), -45*s, 34*s, 66*s, 10*s); ctx.fill(); ctx.stroke();
      const grad = ctx.createLinearGradient(0, 12*s, 0, 74*s);
      grad.addColorStop(0, colors[2]); grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      polygon(ctx, [[dir*22*s,18*s],[dir*42*s,18*s],[dir*30*s,72*s]]); ctx.fill();
    }
    ctx.restore();
  }

  function drawTail(ctx, type, colors, s, time) {
    if (!type || type === 'none') return;
    const sway = Math.sin(time*2.1)*12*s;
    ctx.save();
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = (type === 'tentacle' ? 15 : 9)*s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 45*s);
    ctx.bezierCurveTo(58*s, 62*s, 72*s+sway, 92*s, 30*s+sway, 124*s);
    ctx.stroke();
    if (type === 'stinger') {
      ctx.fillStyle = colors[2];
      polygon(ctx, [[30*s+sway,124*s],[13*s+sway,111*s],[39*s+sway,104*s]]); ctx.fill();
    } else if (type === 'beast') {
      ctx.strokeStyle = U.lighten(colors[0],.25); ctx.lineWidth=13*s;
      ctx.beginPath(); ctx.moveTo(31*s+sway,124*s); ctx.lineTo(44*s+sway,137*s); ctx.stroke();
    } else if (type === 'vine') {
      ctx.fillStyle=colors[2];
      for (let i=0;i<3;i++){ctx.beginPath();ctx.ellipse((44+i*8)*s+sway,(88+i*12)*s,9*s,4*s,.5,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }

  function drawAura(ctx, aura, colors, s, time, seed = 1) {
    if (!aura || aura === 'none') return;
    const rng = U.seeded(`${seed}:${Math.floor(time*3)}`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const count = 10;
    for (let i=0;i<count;i++) {
      const angle = rng()*Math.PI*2;
      const radius = (45+rng()*70)*s;
      const x=Math.cos(angle+time*.4)*radius, y=Math.sin(angle+time*.55)*radius*.75;
      const size=(2+rng()*5)*s;
      ctx.fillStyle=U.alphaColor(i%2?colors[0]:colors[2], .16+rng()*.45);
      if (['rings','clock'].includes(aura)) {
        ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1.5*s;ctx.beginPath();ctx.arc(x,y,size*2.4,0,Math.PI*2);ctx.stroke();
      } else {
        ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawHair(ctx, type, colors, s, time) {
    if (!type || type === 'none') return;
    ctx.save();
    ctx.fillStyle = type === 'flame' ? colors[2] : colors[0];
    ctx.strokeStyle = U.darken(colors[0], .45);
    ctx.lineWidth = 2*s;
    if (type === 'flame') {
      for(let i=-2;i<=2;i++){
        const x=i*11*s;
        const h=(30+Math.abs(i)*5+Math.sin(time*4+i)*6)*s;
        polygon(ctx, [[x-10*s,-59*s],[x,-59*s-h],[x+10*s,-59*s]]);ctx.fill();
      }
    } else if (type === 'long' || type === 'mane' || type === 'wave') {
      ctx.beginPath();ctx.moveTo(-31*s,-51*s);ctx.bezierCurveTo(-52*s,-25*s,-44*s,20*s,-31*s,37*s);ctx.lineTo(31*s,37*s);ctx.bezierCurveTo(45*s,12*s,51*s,-28*s,31*s,-51*s);ctx.closePath();ctx.fill();ctx.stroke();
      if(type==='wave'){for(let i=0;i<3;i++){ctx.strokeStyle=U.alphaColor(colors[2],.65);ctx.beginPath();ctx.arc(0,(-26+i*13)*s,(32+i*4)*s,.1*Math.PI,.9*Math.PI);ctx.stroke();}}
    } else if (type === 'crystal') {
      for(let i=-2;i<=2;i++){const x=i*10*s;polygon(ctx,[[x-8*s,-53*s],[x,-88*s-(Math.abs(i)*5*s)],[x+8*s,-53*s]]);ctx.fill();ctx.stroke();}
    } else if (type === 'leaves') {
      for(let i=0;i<9;i++){const a=i/9*Math.PI*2;ctx.beginPath();ctx.ellipse(Math.cos(a)*26*s,-45*s+Math.sin(a)*15*s,13*s,6*s,a,0,Math.PI*2);ctx.fill();}
    } else if (type === 'tendrils' || type === 'antenna') {
      for(let i=-2;i<=2;i++){ctx.strokeStyle=colors[0];ctx.lineWidth=5*s;ctx.beginPath();ctx.moveTo(i*8*s,-54*s);ctx.quadraticCurveTo(i*18*s+Math.sin(time*2+i)*8*s,-80*s,i*13*s,-96*s);ctx.stroke();}
    } else if (type === 'mist') {
      ctx.globalAlpha=.55;for(let i=0;i<6;i++){ctx.beginPath();ctx.arc((-25+i*10)*s,(-62-Math.sin(time*2+i)*10)*s,(15-i%2*4)*s,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }

  function drawHorns(ctx, count, colors, s) {
    if (!count) return;
    ctx.save();ctx.fillStyle=colors[2];ctx.strokeStyle=U.darken(colors[2],.55);ctx.lineWidth=2*s;
    if (count === 1) { polygon(ctx,[[-8*s,-62*s],[0,-105*s],[8*s,-62*s]]);ctx.fill();ctx.stroke(); }
    else {
      [-1,1].forEach(side=>{polygon(ctx,[[side*15*s,-59*s],[side*34*s,-92*s],[side*30*s,-53*s]]);ctx.fill();ctx.stroke();});
    }
    ctx.restore();
  }

  function drawHead(ctx, visual, colors, s, time) {
    drawHair(ctx, visual.hair, colors, s, time);
    drawHorns(ctx, visual.horns, colors, s);
    ctx.save();
    const headColor = visual.head === 'golem' ? colors[0] : visual.head === 'skull' ? '#e4e0d8' : U.lighten(colors[1], .52);
    ctx.fillStyle=headColor;ctx.strokeStyle=U.darken(colors[1],.45);ctx.lineWidth=2.4*s;
    if (visual.head === 'alien' || visual.head === 'mantis') {
      ctx.beginPath();ctx.ellipse(0,-46*s,32*s,38*s,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    } else if (visual.head === 'golem') {
      U.roundRect(ctx,-31*s,-79*s,62*s,66*s,12*s);ctx.fill();ctx.stroke();
    } else if (visual.head === 'skull') {
      ctx.beginPath();ctx.arc(0,-49*s,30*s,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle=colors[1];U.roundRect(ctx,-18*s,-34*s,36*s,23*s,6*s);ctx.fill();
    } else {
      ctx.beginPath();ctx.ellipse(0,-48*s,29*s,34*s,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    if (visual.head === 'visor' || visual.head === 'masked') {
      ctx.fillStyle=colors[1];U.roundRect(ctx,-25*s,-63*s,50*s,23*s,8*s);ctx.fill();
      ctx.fillStyle=colors[2];U.roundRect(ctx,-19*s,-57*s,38*s,8*s,4*s);ctx.fill();
    } else if (visual.head === 'mantis') {
      ctx.fillStyle=colors[2];
      ctx.beginPath();ctx.ellipse(-13*s,-53*s,13*s,19*s,-.35,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(13*s,-53*s,13*s,19*s,.35,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=colors[2];
      ctx.beginPath();ctx.ellipse(-10*s,-52*s,5*s,7*s,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(10*s,-52*s,5*s,7*s,0,0,Math.PI*2);ctx.fill();
      if (visual.head !== 'skull') { ctx.strokeStyle=U.darken(headColor,.55);ctx.lineWidth=1.5*s;ctx.beginPath();ctx.arc(0,-39*s,7*s,.15*Math.PI,.85*Math.PI);ctx.stroke(); }
    }
    ctx.restore();
  }

  R.drawCharacter = function(ctx, model, options = {}) {
    if (!model) return;
    const { x=0, y=0, scale=1, time=performance.now()/1000, angle=0, alpha=1, mirror=false, shadow=true, aura=true } = options;
    const colors = model.colors || ['#9e7bff','#282044','#45f3d0'];
    const visual = model.visual || {};
    const seed = U.hashString(model.id || model.name || 'child');
    const s = scale;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(mirror?-1:1,1);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    if (shadow) {
      ctx.save();ctx.scale(1,.32);ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(0,305*s,52*s,22*s,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if (aura) drawAura(ctx, visual.aura, colors, s, time, seed);
    drawWing(ctx, visual.wings, -1, colors, s, time);
    drawWing(ctx, visual.wings, 1, colors, s, time);
    drawTail(ctx, visual.tail, colors, s, time);

    const bob = Math.sin(time*2.2 + seed%13)*2.5*s;
    ctx.translate(0,bob);
    // Legs
    const stride = Math.sin(time*4.2)*4*s;
    line(ctx,-15*s,54*s,-20*s-stride,112*s,18*s,U.darken(colors[1],.12));
    line(ctx,15*s,54*s,20*s+stride,112*s,18*s,U.darken(colors[1],.12));
    line(ctx,-21*s-stride,111*s,-28*s-stride,124*s,19*s,colors[2]);
    line(ctx,21*s+stride,111*s,28*s+stride,124*s,19*s,colors[2]);

    // Body silhouette
    const bodyWidth = ({ massive:50, android:39, insect:35, feral:41, organic:40, fluid:42, regal:38, performer:36, spectral:38, monk:36, athletic:39, slim:32 }[visual.body] || 37)*s;
    ctx.fillStyle=colors[1];ctx.strokeStyle=U.darken(colors[1],.5);ctx.lineWidth=2.4*s;
    ctx.beginPath();
    ctx.moveTo(-bodyWidth*.72,-20*s);ctx.quadraticCurveTo(-bodyWidth,25*s,-bodyWidth*.65,62*s);ctx.lineTo(bodyWidth*.65,62*s);ctx.quadraticCurveTo(bodyWidth,25*s,bodyWidth*.72,-20*s);ctx.closePath();ctx.fill();ctx.stroke();

    // Armor accents
    ctx.fillStyle=U.alphaColor(colors[0],.85);
    if (['heavy','crag','tech','carapace','bark'].includes(visual.armor)) {
      polygon(ctx,[[-bodyWidth*.9,-13*s],[0,-31*s],[bodyWidth*.9,-13*s],[bodyWidth*.6,12*s],[0,4*s],[-bodyWidth*.6,12*s]]);ctx.fill();
      ctx.fillStyle=colors[2];ctx.beginPath();ctx.arc(0,-9*s,7*s,0,Math.PI*2);ctx.fill();
    } else if (['robe','ceremonial','cloth','stage'].includes(visual.armor)) {
      polygon(ctx,[[-bodyWidth*.66,-18*s],[bodyWidth*.66,-18*s],[bodyWidth*.92,72*s],[-bodyWidth*.92,72*s]]);ctx.fill();
      ctx.fillStyle=U.alphaColor(colors[2],.7);polygon(ctx,[[-7*s,-18*s],[7*s,-18*s],[17*s,68*s],[-17*s,68*s]]);ctx.fill();
    } else {
      U.roundRect(ctx,-bodyWidth*.65,-17*s,bodyWidth*1.3,31*s,8*s);ctx.fill();
    }

    // Arms
    const armSwing=Math.sin(time*3.7)*6*s;
    line(ctx,-bodyWidth*.78,-7*s,-bodyWidth*1.24,45*s+armSwing,15*s,colors[1]);
    line(ctx,bodyWidth*.78,-7*s,bodyWidth*1.24,45*s-armSwing,15*s,colors[1]);
    ctx.fillStyle=colors[2];
    ctx.beginPath();ctx.arc(-bodyWidth*1.24,47*s+armSwing,9*s,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(bodyWidth*1.24,47*s-armSwing,9*s,0,Math.PI*2);ctx.fill();

    drawHead(ctx, visual, colors, s, time);

    if (model.mutation) {
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=model.mutation.color||'#ffffff';ctx.lineWidth=2*s;ctx.setLineDash([5*s,7*s]);ctx.beginPath();ctx.arc(0,7*s,78*s+Math.sin(time*2)*5*s,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    ctx.restore();
  };

  R.drawCard = function(canvas, model, options = {}) {
    withCanvas(canvas, (ctx,w,h) => {
      ctx.clearRect(0,0,w,h);
      const colors=model.colors||['#9e7bff','#282044','#45f3d0'];
      const grad=ctx.createLinearGradient(0,0,w,h);
      grad.addColorStop(0,U.alphaColor(colors[1],.95));
      grad.addColorStop(.6,U.alphaColor(U.darken(colors[0],.55),.9));
      grad.addColorStop(1,'#070812');
      ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
      ctx.save();ctx.globalAlpha=.24;ctx.strokeStyle=colors[2];ctx.lineWidth=1;
      for(let i=-h;i<w+h;i+=28){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i-h,h);ctx.stroke();}
      ctx.restore();
      ctx.save();ctx.globalCompositeOperation='lighter';
      const glow=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.5);
      glow.addColorStop(0,U.alphaColor(colors[0],.32));glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.restore();
      const sc=Math.min(w,h)/260*(options.scale||1);
      R.drawCharacter(ctx,model,{x:w/2,y:h*.58,scale:sc,time:options.time??performance.now()/1000,shadow:true});
      if(options.ring!==false){ctx.strokeStyle=U.alphaColor(colors[2],.35);ctx.lineWidth=2;ctx.beginPath();ctx.arc(w/2,h*.5,Math.min(w,h)*.38,0,Math.PI*2);ctx.stroke();}
    });
  };

  R.drawPortrait = function(canvas, model, options={}) {
    withCanvas(canvas,(ctx,w,h)=>{
      ctx.clearRect(0,0,w,h);
      const colors=model.colors||['#9e7bff','#282044','#45f3d0'];
      const g=ctx.createRadialGradient(w*.5,h*.42,0,w*.5,h*.5,w*.7);g.addColorStop(0,U.alphaColor(colors[0],.45));g.addColorStop(1,'#080914');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      R.drawCharacter(ctx,model,{x:w/2,y:h*.75,scale:(Math.min(w,h)/220)*(options.scale||1.25),time:options.time??performance.now()/1000,shadow:false,aura:true});
    });
  };

  R.drawReveal = function(canvas, child, time=performance.now()/1000, mode='reveal') {
    withCanvas(canvas,(ctx,w,h)=>{
      ctx.clearRect(0,0,w,h);
      const colors=child.colors;
      const g=ctx.createRadialGradient(w/2,h*.47,0,w/2,h*.47,w*.52);g.addColorStop(0,U.alphaColor(colors[0],.28));g.addColorStop(.55,U.alphaColor(colors[1],.17));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      ctx.save();ctx.translate(w/2,h*.5);
      for(let i=0;i<5;i++){
        ctx.strokeStyle=U.alphaColor(i%2?colors[0]:colors[2],.12+i*.04);ctx.lineWidth=(1+i*.7);ctx.setLineDash([8+i*4,14+i*5]);ctx.beginPath();ctx.arc(0,0,w*(.18+i*.055),time*(.12+i*.02),Math.PI*2+time*(.12+i*.02));ctx.stroke();
      }
      ctx.setLineDash([]);
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2-time*.17;const r=w*.37;ctx.fillStyle=U.alphaColor(colors[2],.55);ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3+i%3,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      const scale=w/900*.94;
      R.drawCharacter(ctx,child,{x:w/2,y:h*.59,scale,time,shadow:true,aura:true});
      ctx.save();ctx.fillStyle=U.alphaColor(colors[2],.8);ctx.font=`600 ${Math.round(w*.014)}px Oxanium, sans-serif`;ctx.textAlign='center';ctx.letterSpacing='4px';ctx.fillText(mode==='result'?'ARCHIVE DYNASTIQUE':'HÉRITIER STABILISÉ',w/2,h*.91);ctx.restore();
    });
  };

  R.startForgeAnimation = function(canvas, models=[]) {
    let active=true, frame=0;
    const list=models.length?models:LF.ORIGINS.slice(0,3);
    const draw=()=>{
      if(!active||!canvas.isConnected)return;
      frame=requestAnimationFrame(draw);
      const t=performance.now()/1000;
      withCanvas(canvas,(ctx,w,h)=>{
        ctx.clearRect(0,0,w,h);
        const cx=w/2,cy=h/2;
        const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,w*.48);glow.addColorStop(0,'rgba(126,91,255,.18)');glow.addColorStop(.5,'rgba(45,239,210,.055)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
        ctx.save();ctx.translate(cx,cy);
        for(let i=0;i<7;i++){
          const r=w*(.11+i*.045);ctx.strokeStyle=i%2?'rgba(69,243,208,.17)':'rgba(158,123,255,.17)';ctx.lineWidth=i%3===0?3:1;ctx.setLineDash([9+i*2,13+i*2]);ctx.beginPath();ctx.arc(0,0,r,t*(i%2?-.08:.06)*(i+1),Math.PI*2+t*(i%2?-.08:.06)*(i+1));ctx.stroke();
        }
        ctx.setLineDash([]);
        for(let i=0;i<24;i++){const a=i/24*Math.PI*2+t*.16;const r=w*.38;ctx.fillStyle=i%2?'#45f3d0':'#9e7bff';ctx.globalAlpha=.18+(i%4)*.08;ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,2+(i%3),0,Math.PI*2);ctx.fill();}
        ctx.restore();
        const a=list[0]||LF.ORIGINS[0],b=list[1]||LF.ORIGINS[1],c=list[2]||LF.ORIGINS[3];
        R.drawCharacter(ctx,a,{x:w*.28,y:h*.63,scale:w/1000*.62,time:t,alpha:.58,mirror:false,aura:false});
        R.drawCharacter(ctx,b,{x:w*.72,y:h*.63,scale:w/1000*.62,time:t+.7,alpha:.58,mirror:true,aura:false});
        R.drawCharacter(ctx,c,{x:w*.5,y:h*.6,scale:w/1000*.86,time:t+.3,alpha:1,aura:true});
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='rgba(69,243,208,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.34,h*.48);ctx.quadraticCurveTo(w*.5,h*.3,w*.5,h*.43);ctx.quadraticCurveTo(w*.5,h*.3,w*.66,h*.48);ctx.stroke();ctx.restore();
      });
    };
    draw();
    return ()=>{active=false;if(frame)cancelAnimationFrame(frame);};
  };

  R.startRevealAnimation = function(canvas, child, mode='reveal') {
    let active=true, frame=0;
    const draw=()=>{if(!active||!canvas.isConnected)return;frame=requestAnimationFrame(draw);R.drawReveal(canvas,child,performance.now()/1000,mode);};
    draw();return()=>{active=false;if(frame)cancelAnimationFrame(frame);};
  };

  R.drawTopDown = function(ctx, model, x, y, radius, angle=0, time=0, options={}) {
    const colors=model.colors||['#9e7bff','#282044','#45f3d0'];
    ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);
    if(options.glow!==false){ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(0,0,0,0,0,radius*2.4);g.addColorStop(0,U.alphaColor(colors[0],.28));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,radius*2.4,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(0,radius*.55,radius*.85,radius*.42,0,0,Math.PI*2);ctx.fill();
    if(model.visual?.wings&&model.visual.wings!=='none'){
      ctx.fillStyle=U.alphaColor(colors[1],.7);ctx.strokeStyle=colors[2];ctx.lineWidth=1.5;polygon(ctx,[[-radius*.4,0],[-radius*1.5,-radius*.65],[-radius*1.15,radius*.45],[-radius*.25,radius*.35]]);ctx.fill();ctx.stroke();polygon(ctx,[[radius*.4,0],[radius*1.5,-radius*.65],[radius*1.15,radius*.45],[radius*.25,radius*.35]]);ctx.fill();ctx.stroke();
    }
    ctx.fillStyle=colors[1];ctx.strokeStyle=U.lighten(colors[0],.25);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,radius*.82,radius,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=colors[0];polygon(ctx,[[-radius*.65,-radius*.2],[0,-radius*.85],[radius*.65,-radius*.2],[radius*.48,radius*.45],[0,radius*.72],[-radius*.48,radius*.45]]);ctx.fill();
    ctx.fillStyle=colors[2];ctx.beginPath();ctx.arc(0,-radius*.3,radius*.22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffffff';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(-radius*.18,-radius*.37,radius*.07,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(radius*.18,-radius*.37,radius*.07,0,Math.PI*2);ctx.fill();
    if(model.mutation){ctx.strokeStyle=model.mutation.color||'#fff';ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,radius*1.35+Math.sin(time*3)*2,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  };
})();
