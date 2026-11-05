/* PAIVA · Curvas flexíveis independentes da medição de ângulos.
   Caminho original Catmull-Rom / Bézier, sem código do Kinovea. */
(() => {
  'use strict';
  const BASE_W=960,BASE_H=540;
  const copy=p=>({x:p.x,y:p.y});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function pointOnCurve(points,i,t,closed){
    const n=points.length;
    const p0=points[closed?(i+n-1)%n:Math.max(0,i-1)];
    const p1=points[i],p2=points[(i+1)%n];
    const p3=points[closed?(i+2)%n:Math.min(n-1,i+2)];
    const a={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6};
    const b={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};
    const k=1-t;
    return {x:k*k*k*p1.x+3*k*k*t*a.x+3*k*t*t*b.x+t*t*t*p2.x,
      y:k*k*k*p1.y+3*k*k*t*a.y+3*k*t*t*b.y+t*t*t*p2.y};
  }
  function trace(ctx,points,closed=false){
    if(!points?.length)return;
    ctx.moveTo(points[0].x,points[0].y);
    if(points.length===1)return;
    if(points.length===2&&!closed){
      ctx.lineTo(points[1].x,points[1].y);return;
    }
    const n=points.length,limit=closed?n:n-1;
    for(let i=0;i<limit;i++){
      const p0=points[closed?(i+n-1)%n:Math.max(0,i-1)];
      const p1=points[i],p2=points[(i+1)%n];
      const p3=points[closed?(i+2)%n:Math.min(n-1,i+2)];
      ctx.bezierCurveTo(
        p1.x+(p2.x-p0.x)/6,p1.y+(p2.y-p0.y)/6,
        p2.x-(p3.x-p1.x)/6,p2.y-(p3.y-p1.y)/6,
        p2.x,p2.y);
    }
    if(closed)ctx.closePath();
  }
  function attach({host,target,toolbar,closeOnFinish=false,onChange=()=>{},label='Curva'}={}){
    if(!host||!target||!toolbar)return null;
    if(host.querySelector('.paiva-spline-layer'))return null;
    host.classList.add('paiva-spline-host');
    const layer=document.createElement('canvas');
    layer.className='paiva-spline-layer';
    layer.width=BASE_W;layer.height=BASE_H;
    layer.setAttribute('aria-label','Curva flexível com pontos arrastáveis');
    host.append(layer);
    const ctx=layer.getContext('2d');
    if(!ctx){layer.remove();return null;}
    const controls=document.createElement('div');
    controls.className='paiva-spline-controls';
    controls.innerHTML=
      '<button type="button" class="paiva-spline-toggle" aria-pressed="false">✎ Curva</button>'+
      '<button type="button" class="paiva-spline-finish" disabled>'+
      (closeOnFinish?'✓ Fechar recorte':'✓ Concluir curva')+'</button>'+
      '<button type="button" class="paiva-spline-clear" disabled>✕ Limpar curvas</button>';
    toolbar.append(controls);
    const toggle=controls.querySelector('.paiva-spline-toggle');
    const finish=controls.querySelector('.paiva-spline-finish');
    const clear=controls.querySelector('.paiva-spline-clear');
    toggle.textContent=closeOnFinish?'✎ Recorte flexível':'✎ Desenhar curva';
    toggle.title='Clique na imagem para criar pontos; arraste as bolinhas para maleá-la';
    finish.title=closeOnFinish?
      'Fechar o contorno para o vento desviar da área desenhada':
      'Finalizar a curva sem fechar as duas extremidades';
    let enabled=false,current=null,paths=[],drag=null;
    function updateUI(){
      toggle.setAttribute('aria-pressed',String(enabled));
      finish.disabled=!current||current.points.length<(closeOnFinish?3:2);
      clear.disabled=!current&&!paths.length;
      finish.hidden=!enabled;
      clear.hidden=!enabled||(!current&&!paths.length);
      layer.style.pointerEvents=enabled?'auto':'none';
      layer.style.cursor=enabled?'crosshair':'default';
    }
    function syncLayer(){
      const element=!target.hidden?target:
        (host.querySelector('video:not([hidden])')||target);
      const hostBox=host.getBoundingClientRect();
      const box=element.getBoundingClientRect();
      layer.style.left=(box.left-hostBox.left+host.scrollLeft)+'px';
      layer.style.top=(box.top-hostBox.top+host.scrollTop)+'px';
      layer.style.width=Math.max(1,box.width)+'px';
      layer.style.height=Math.max(1,box.height)+'px';
    }
    function paint(){
      ctx.clearRect(0,0,BASE_W,BASE_H);
      const all=current?[...paths,current]:paths;
      for(const line of all){
        if(!line.points.length)continue;
        ctx.beginPath();trace(ctx,line.points,line.closed);
        if(line.closed){
          ctx.fillStyle='rgba(72,198,226,.07)';ctx.fill();
        }
        ctx.lineWidth=2.1;ctx.lineJoin='round';ctx.lineCap='round';
        ctx.strokeStyle=closeOnFinish?'#5fe0ec':'#ffe37d';
        ctx.stroke();
        if(!enabled)continue;
        for(const p of line.points){
          ctx.beginPath();ctx.arc(p.x,p.y,5.2,0,Math.PI*2);
          ctx.fillStyle='#101a22';ctx.fill();
          ctx.lineWidth=2;ctx.strokeStyle='#f8f9f9';ctx.stroke();
        }
      }
    }
    function changed(){
      paint();updateUI();onChange({paths:paths.map(line=>({
        closed:line.closed,points:line.points.map(copy)}))});
    }
    function pointOf(event){
      const box=layer.getBoundingClientRect();
      if(!box.width||!box.height)return null;
      return {x:Math.max(0,Math.min(BASE_W,(event.clientX-box.left)*BASE_W/box.width)),
        y:Math.max(0,Math.min(BASE_H,(event.clientY-box.top)*BASE_H/box.height))};
    }
    function hit(p){
      const all=current?[...paths,current]:paths;
      for(let i=all.length-1;i>=0;i--)for(let j=all[i].points.length-1;j>=0;j--){
        const q=all[i].points[j];
        if(Math.hypot(q.x-p.x,q.y-p.y)<=15)return {line:all[i],point:j};
      }
      return null;
    }
    function hitStroke(p){
      const all=current?[...paths,current]:paths;
      let best=null;
      for(const line of all){
        const n=line.points.length;
        if(n<2)continue;
        const parts=line.closed?n:n-1;
        for(let i=0;i<parts;i++){
          for(let step=1;step<16;step++){
            const sample=pointOnCurve(line.points,i,step/16,line.closed);
            const d=distance(sample,p);
            if(d<=13&&(!best||d<best.distance))best={line,index:i,distance:d};
          }
        }
      }
      return best;
    }
    layer.addEventListener('pointerdown',event=>{
      if(!enabled)return;
      event.preventDefault();event.stopPropagation();
      const p=pointOf(event);if(!p)return;
      const matched=hit(p);
      const segment=matched?null:hitStroke(p);
      if(matched)drag=matched;
      else if(segment){
        // Ao arrastar a própria linha, surge um ponto flexível exatamente
        // onde a pessoa puxou. Os pontos antigos permanecem intactos.
        segment.line.points.splice(segment.index+1,0,p);
        drag={line:segment.line,point:segment.index+1};
      }
      else {
        if(!current)current={closed:false,points:[]};
        current.points.push(p);
        drag={line:current,point:current.points.length-1};
      }
      try{layer.setPointerCapture(event.pointerId);}catch(_){}
      changed();
    });
    layer.addEventListener('pointermove',event=>{
      if(!drag||!enabled)return;
      const p=pointOf(event);if(!p)return;
      drag.line.points[drag.point]=p;
      changed();
    });
    const end=event=>{
      if(!drag)return;
      drag=null;
      try{layer.releasePointerCapture(event.pointerId);}catch(_){}
    };
    layer.addEventListener('pointerup',end);
    layer.addEventListener('pointercancel',end);
    toggle.addEventListener('click',()=>{
      enabled=!enabled;updateUI();paint();
    });
    finish.addEventListener('click',()=>{
      if(!current||current.points.length<(closeOnFinish?3:2))return;
      current.closed=closeOnFinish;
      paths.push(current);current=null;changed();
    });
    clear.addEventListener('click',()=>{
      paths=[];current=null;changed();
    });
    const observer=typeof ResizeObserver==='function'?
      new ResizeObserver(syncLayer):null;
    observer?.observe(host);observer?.observe(target);
    const vid=host.querySelector('video');
    if(vid)observer?.observe(vid);
    const mutation=typeof MutationObserver==='function'?
      new MutationObserver(syncLayer):null;
    mutation?.observe(target,{attributes:true,attributeFilter:['hidden','style','class']});
    if(vid)mutation?.observe(vid,{attributes:true,attributeFilter:['hidden','style','class']});
    window.addEventListener('resize',syncLayer);
    host.addEventListener('scroll',syncLayer,{passive:true});
    // Observa mudanças de tamanho e a troca de canvas para vídeo, sem criar
    // um processo permanente a cada quadro e sem controlar a reprodução.
    updateUI();paint();syncLayer();
    return {
      canvas:layer,
      getPaths:()=>paths.map(line=>({closed:line.closed,points:line.points.map(copy)})),
      getMask(width,height){
        const closed=paths.filter(line=>line.closed&&line.points.length>=3);
        if(!closed.length)return null;
        const surface=document.createElement('canvas');
        surface.width=width;surface.height=height;
        const g=surface.getContext('2d',{willReadFrequently:true});
        if(!g)return null;
        g.scale(width/BASE_W,height/BASE_H);
        for(const line of closed){g.beginPath();trace(g,line.points,true);g.fill();}
        const pixels=g.getImageData(0,0,width,height).data;
        const mask=new Uint8Array(width*height);
        for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4+3]>127?1:0;
        return {mask,width,height};
      },
      redraw:paint,
      close:()=>{enabled=false;updateUI();paint();},
      reset:()=>{paths=[];current=null;enabled=false;changed();}
    };
  }
  globalThis.PAIVA_SPLINE={trace,attach};
})();
