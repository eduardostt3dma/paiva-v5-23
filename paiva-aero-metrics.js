/* PAIVA Motion Studio V5.59 — Aero Metrics (primeiro ensaio 2D).
   Régua métrica calibrada, solo e topo da cabeça no quadro parado.
   Não estima CdA, potência ou área frontal; não afirma detecção automática. */
(() => {
  'use strict';
  function install() {
    const root=document.getElementById('paiva-athlete-2d');
    if(!root || root.querySelector('#paiva-aero-metrics'))return;
    const sidebar=root.querySelector('.paiva-2d-sidebar');
    const tools=root.querySelector('.paiva-2d-tools');
    const wrap=root.querySelector('.paiva-2d-canvas-wrap');
    const canvas=root.querySelector('#paiva-2d-canvas');
    const video=root.querySelector('#paiva-2d-video');
    if(!sidebar || !tools || !wrap || !canvas || !video)return;

    const panel=document.createElement('details');
    panel.id='paiva-aero-metrics';
    panel.className='paiva-aero-metrics';
    panel.innerHTML=`
      <summary>◈ AERO METRICS <span>ALTURA FRONTAL · 2D</span></summary>
      <div class="paiva-aero-metrics-body">
        <p>Calibre uma referência vertical no plano do atleta. No quadro parado, marque o solo e o topo da cabeça. As linhas não alteram os pontos e ângulos do 2D.</p>
        <label>Distância real da referência (cm)
          <input id="paiva-aero-reference-cm" type="number" inputmode="decimal" min="10" max="250" step="0.5" value="100" aria-label="Distância conhecida entre os dois pontos de referência em centímetros">
        </label>
        <div class="paiva-aero-metrics-buttons">
          <button type="button" data-aero-pick="reference">1 · Calibrar · 2 cliques</button>
          <button type="button" data-aero-pick="floor">2 · Marcar solo</button>
          <button type="button" data-aero-pick="head">3 · Marcar topo</button>
          <button type="button" data-aero-pick="clear">↺ Limpar Aero</button>
        </div>
        <output id="paiva-aero-height" aria-live="polite">Altura frontal: —</output>
        <small id="paiva-aero-message" role="status" aria-live="polite">Abra uma foto frontal ou pause um quadro de vídeo para iniciar.</small>
        <small class="paiva-aero-disclaimer">Primeira etapa manual. O reconhecimento automático, a largura e o comparativo A/B serão testados depois. Medidas dependem da calibração e da perspectiva.</small>
      </div>`;
    tools.after(panel);

    const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
    overlay.setAttribute('aria-label','Réguas laterais e linha da altura frontal calibrada');
    overlay.setAttribute('role','img');
    overlay.classList.add('paiva-aero-overlay');
    wrap.append(overlay);

    const refInput=panel.querySelector('#paiva-aero-reference-cm');
    const result=panel.querySelector('#paiva-aero-height');
    const status=panel.querySelector('#paiva-aero-message');
    const buttons=[...panel.querySelectorAll('[data-aero-pick]')];
    const state={a:null,b:null,floor:null,head:null,mode:null,referenceCm:100};
    const cm=()=>Number(refInput.value);
    const referenceValid=()=>Number.isFinite(cm())&&cm()>=10&&cm()<=250;
    const ratio=()=>state.a&&state.b&&referenceValid()
      ?Math.abs(state.b.y-state.a.y):0;
    const calibrated=()=>ratio()>=0.015;
    const height=()=>calibrated()&&state.floor&&state.head&&state.head.y<state.floor.y
      ?(state.floor.y-state.head.y)/ratio()*cm():null;
    const fmt=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
    const media=()=>{
      if(!video.hidden&&video.readyState>=2)return video;
      if(!canvas.hidden&&globalThis.PAIVA_ATHLETE_2D?.hasImage?.())return canvas;
      return null;
    };
    const statusText=text=>{status.textContent=text;};
    function clear(full=true){
      state.mode=null;
      state.head=null;
      if(full){state.a=null;state.b=null;state.floor=null;}
      buttons.forEach(b=>b.removeAttribute('data-active'));
      render();
    }
    function setMode(next){
      if(next==='clear'){
        clear();statusText('Réguas do Aero redefinidas. Os ângulos e pontos do 2D foram preservados.');return;
      }
      if(!media()){statusText('Carregue uma fotografia ou um quadro do vídeo antes de marcar.');return;}
      if(!video.hidden&&!video.paused){
        video.pause();statusText('Vídeo pausado. Agora clique no ponto indicado sobre a imagem.');
      }
      if(next==='reference'){
        if(!referenceValid()){
          statusText('Informe uma referência real entre 10 e 250 cm.');return;
        }
        state.a=null;state.b=null;state.mode='reference-first';
        statusText('Clique na extremidade inferior da referência vertical conhecida.');
      }else if(next==='floor'){
        state.mode='floor';statusText('Clique no nível do solo, na mesma imagem do atleta.');
      }else if(next==='head'){
        state.mode='head';statusText('Clique exatamente no ponto mais alto da cabeça (quadro parado).');
      }
      render();
    }
    buttons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.aeroPick)));
    refInput.addEventListener('input',()=>{
      render();
      if(!referenceValid())statusText('Use uma distância conhecida entre 10 e 250 cm.');
    });
    panel.addEventListener('toggle',render);

    function onPick(event){
      if(!state.mode || !panel.open)return;
      const area=overlay.getBoundingClientRect();
      if(!area.width||!area.height)return;
      const point={x:Math.max(0,Math.min(1,(event.clientX-area.left)/area.width)),
        y:Math.max(0,Math.min(1,(event.clientY-area.top)/area.height))};
      if(state.mode==='reference-first'){
        state.a=point;state.mode='reference-second';
        statusText('Agora clique na extremidade superior da MESMA referência vertical.');
      }else if(state.mode==='reference-second'){
        state.b=point;state.mode=null;
        if(!calibrated()){
          state.a=null;state.b=null;
          statusText('A referência ficou muito pequena. Marque novamente dois pontos mais afastados na vertical.');
        }else statusText('Calibração concluída. Agora marque o solo e o topo da cabeça.');
      }else if(state.mode==='floor'){
        state.floor=point;state.mode=null;
        statusText('Solo marcado. Agora escolha “Marcar topo”.');
      }else if(state.mode==='head'){
        state.head=point;state.mode=null;
        statusText(height()!==null?'Topo marcado. Confira se a referência e o plano da câmera estão corretos.':
          'Topo marcado. Falta calibrar a referência/solo ou o topo ficou abaixo do solo.');
      }
      event.preventDefault();event.stopPropagation();render();
    }
    overlay.addEventListener('pointerdown',onPick);

    function guideGeometry(w,h){
      const left=Math.max(12,w*.022),right=w-left;
      const zero=state.floor?state.floor.y*h:h-12;
      const pixPerCm=calibrated()?ratio()*h/cm():0;
      const main=[];
      if(pixPerCm>0){
        for(let k=0;k<=240;k+=10){
          const y=zero-k*pixPerCm;
          if(y<-6)break;
          if(y>h+6)continue;
          main.push({y,cm:k,label:k%20===0});
        }
      }else{
        for(let k=0;k<=10;k++)main.push({y:h*k/10,cm:null,label:false});
      }
      return {left,right,zero,main};
    }
    function svgMarkup(w,h){
      const g=guideGeometry(w,h),lineColor='#87929a',valid=height();
      const marks=g.main.map(({y,cm,label})=>{
        const len=label?12:7;
        const cap=label?`<text x="${g.left+15}" y="${Math.max(11,y-3)}" font-size="${Math.max(10,Math.min(15,w*.015))}" fill="#b7c3cb">${cm}</text>`:'';
        return `<path d="M${g.left} ${y}h${len} M${g.right} ${y}h-${len}" stroke="${lineColor}" stroke-width="1" opacity=".65"/>${cap}`;
      }).join('');
      const tick=(p,color)=>p?`<circle cx="${p.x*w}" cy="${p.y*h}" r="${Math.max(4,w*.006)}" fill="${color}" stroke="#11181e" stroke-width="2"/>`:'';
      const headY=state.head?.y*h;
      const hLine=valid!==null?`<line x1="${g.left}" x2="${g.right}" y1="${headY}" y2="${headY}" stroke="#ff5252" stroke-width="${Math.max(1.5,w*.0023)}"/>
        <rect x="${Math.max(g.left+6,g.right-185)}" y="${Math.max(1,headY-31)}" width="${Math.min(176,w*.40)}" height="25" rx="5" fill="#211719" opacity=".92"/>
        <text x="${Math.max(g.left+14,g.right-177)}" y="${Math.max(18,headY-14)}" font-size="${Math.max(11,Math.min(17,w*.019))}" font-weight="700" fill="#ff7171">ALTURA ${fmt(valid)} cm</text>`:'';
      return `<path d="M${g.left} 0V${h} M${g.right} 0V${h}" stroke="${lineColor}" stroke-width="1.2" opacity=".75"/>${marks}
        ${state.floor?`<line x1="${g.left}" x2="${g.right}" y1="${g.zero}" y2="${g.zero}" stroke="#aab6be" stroke-dasharray="5 7" stroke-width="1.4"/>`:''}
        ${hLine}${tick(state.a,'#c8d0d5')}${tick(state.b,'#c8d0d5')}${tick(state.floor,'#c8d0d5')}${tick(state.head,valid!==null?'#ff5252':'#dfb66d')}
        ${state.mode?`<rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>`:''}`;
    }
    function updateLayout(){
      const target=media();
      if(!panel.open||!target){overlay.style.display='none';return;}
      const box=wrap.getBoundingClientRect(),rect=target.getBoundingClientRect();
      if(!rect.width||!rect.height){overlay.style.display='none';return;}
      const x=rect.left-box.left+wrap.scrollLeft, y=rect.top-box.top+wrap.scrollTop;
      overlay.style.display='block';
      overlay.style.left=`${x}px`;overlay.style.top=`${y}px`;
      overlay.style.width=`${rect.width}px`;overlay.style.height=`${rect.height}px`;
      overlay.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
      overlay.style.pointerEvents=state.mode?'auto':'none';
      overlay.innerHTML=svgMarkup(rect.width,rect.height);
    }
    let scheduled=false;
    function render(){
      result.textContent=height()!==null?`Altura frontal: ${fmt(height())} cm`:'Altura frontal: —';
      buttons.forEach(b=>b.toggleAttribute('data-active',state.mode?.startsWith(b.dataset.aeroPick) || state.mode===b.dataset.aeroPick));
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;updateLayout();});
    }

    // Não transmite coordenadas nem fotos. O 2D original permanece intocado.
    [root.querySelector('#paiva-2d-file'),root.querySelector('#paiva-2d-video-file')]
      .filter(Boolean).forEach(input=>input.addEventListener('change',()=>{
        clear();statusText('Novo arquivo carregado: calibre a referência nesta imagem.');
      }));
    video.addEventListener('loadedmetadata',()=>{clear();statusText('Vídeo carregado. Pause um quadro e calibre a imagem.');});
    video.addEventListener('seeked',()=>{
      if(state.head){state.head=null;statusText('Quadro alterado. Marque novamente o topo antes de medir.');}
      render();
    });
    video.addEventListener('play',()=>{
      if(state.head){state.head=null;statusText('Durante a reprodução a linha não acompanha a cabeça nesta primeira versão. Pause e marque novamente.');}
      render();
    });
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(render):null;
    if(observer){observer.observe(wrap);observer.observe(canvas);observer.observe(video);}
    const mutations=new MutationObserver(render);
    [canvas,video].forEach(el=>mutations.observe(el,{attributes:true,attributeFilter:['hidden','style','width','height']}));
    wrap.addEventListener('scroll',render,{passive:true});
    window.addEventListener('resize',render,{passive:true});

    function drawOnCanvas(ctx,w,h){
      const value=height();
      if(!panel.open||value===null||!ctx)return;
      const g=guideGeometry(w,h);ctx.save();
      ctx.strokeStyle='rgba(184,194,202,.75)';ctx.lineWidth=Math.max(1,w*.0015);
      ctx.beginPath();ctx.moveTo(g.left,0);ctx.lineTo(g.left,h);
      ctx.moveTo(g.right,0);ctx.lineTo(g.right,h);ctx.stroke();
      for(const mark of g.main){ctx.beginPath();ctx.moveTo(g.left,mark.y);
        ctx.lineTo(g.left+(mark.label?12:7),mark.y);
        ctx.moveTo(g.right,mark.y);ctx.lineTo(g.right-(mark.label?12:7),mark.y);ctx.stroke();}
      ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(g.left,g.zero);
      ctx.lineTo(g.right,g.zero);ctx.stroke();ctx.setLineDash([]);
      const yy=state.head.y*h;ctx.strokeStyle='#ff5252';ctx.lineWidth=Math.max(2,w*.0025);
      ctx.beginPath();ctx.moveTo(g.left,yy);ctx.lineTo(g.right,yy);ctx.stroke();
      ctx.fillStyle='#ff7171';ctx.font=`700 ${Math.max(12,Math.min(24,w*.023))}px system-ui`;
      ctx.textAlign='right';ctx.fillText(`ALTURA ${fmt(value)} cm`,g.right-9,Math.max(23,yy-9));
      ctx.restore();
    }
    globalThis.PAIVA_AERO_METRICS={drawOnCanvas,getHeightCm:height};
    render();
  }
  document.addEventListener('paiva:athlete-2d-ready',install);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
