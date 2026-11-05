/* PAIVA V5.33 — Túnel de vento VISUAL, sem CFD ou medição de arrasto.
   Contorno manual: área do envelope desenhado em proporção ao quadro.
   Nenhum vídeo ou foto é enviado para servidores. */
(() => {
  'use strict';
  const W=960, H=540;
  const $=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  function polygonArea(points){
    if(!Array.isArray(points)||points.length<3)return 0;
    let twice=0;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      twice+=a.x*b.y-b.x*a.y;
    }
    return Math.abs(twice)/2;
  }
  function envelopePercent(points,width=W,height=H){
    if(width<=0||height<=0)return 0;
    return polygonArea(points)*100/(width*height);
  }
  function polygonBounds(points){
    if(!points.length)return null;
    return {
      left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),
      top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))
    };
  }
  function crossesItself(points){
    if(points.length<4)return false;
    const orientation=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const between=(p,a,b)=>p.x>=Math.min(a.x,b.x)-1e-8&&p.x<=Math.max(a.x,b.x)+1e-8&&
      p.y>=Math.min(a.y,b.y)-1e-8&&p.y<=Math.max(a.y,b.y)+1e-8;
    const intersects=(a,b,c,d)=>{
      const abC=orientation(a,b,c),abD=orientation(a,b,d);
      const cdA=orientation(c,d,a),cdB=orientation(c,d,b);
      if(abC*abD<0&&cdA*cdB<0)return true;
      return (Math.abs(abC)<1e-8&&between(c,a,b))||
        (Math.abs(abD)<1e-8&&between(d,a,b))||
        (Math.abs(cdA)<1e-8&&between(a,c,d))||
        (Math.abs(cdB)<1e-8&&between(b,c,d));
    };
    for(let i=0;i<points.length;i++){
      for(let j=i+1;j<points.length;j++){
        if(j===i+1||(i===0&&j===points.length-1))continue;
        if(intersects(points[i],points[(i+1)%points.length],
          points[j],points[(j+1)%points.length]))return true;
      }
    }
    return false;
  }
  globalThis.PAIVA_WIND_VISUAL_MATH={polygonArea,envelopePercent,polygonBounds,crossesItself};
  if(typeof document==='undefined')return;

  function init(){
    const athlete=$('paiva-athlete-2d');
    if(!athlete || $('paiva-wind-visual'))return;
    const section=document.createElement('section');
    section.id='paiva-wind-visual';
    section.className='card paiva-wind-visual';
    section.innerHTML=[
      '<div class="wind-header"><div><span>PAIVA LAB · EXPERIMENTAL</span>',
      '<h2>TÚNEL DE VENTO VISUAL</h2>',
      '<p>Movimento do ar ilustrativo + ocupação do contorno na imagem. Sem cálculo de arrasto.</p></div>',
      '<span class="wind-stamp">V5.33 · VISUAL</span></div>',
      '<div class="wind-actions">',
      '<button type="button" id="wind-capture">▣ Trazer quadro do 2D</button>',
      '<label class="wind-upload">↑ Abrir foto independente<input id="wind-image" type="file" accept="image/png,image/jpeg,image/webp" /></label>',
      '<label>Vista <select id="wind-view"><option value="lateral">Lateral · perfil</option><option value="frontal">Frontal · frente</option></select></label>',
      '</div>',
      '<div class="wind-slots" role="group" aria-label="Duas posições para comparação">',
      '<button type="button" id="wind-slot-a" class="active" aria-pressed="true">A · Posição inicial</button>',
      '<button type="button" id="wind-slot-b" aria-pressed="false">B · Posição alternativa</button>',
      '</div>',
      '<div class="wind-workspace"><canvas id="wind-canvas" width="960" height="540" aria-label="Imagem de bicicleta com contorno manual e linhas animadas de fluxo ilustrativo"></canvas>',
      '<p id="wind-message" role="status" aria-live="polite">Selecione A, traga um quadro do 2D e clique ao redor do atleta e bicicleta para desenhar o contorno externo.</p></div>',
      '<div class="wind-actions wind-trace-actions">',
      '<button type="button" id="wind-close">✓ Fechar contorno</button>',
      '<button type="button" id="wind-undo">↶ Voltar um ponto</button>',
      '<button type="button" id="wind-clear">✕ Apagar contorno atual</button>',
      '<label>Linhas de ar <input id="wind-flow" type="checkbox" checked /></label>',
      '<button type="button" id="wind-download">↓ Salvar imagem PNG</button>',
      '</div>',
      '<div class="wind-comparison" aria-live="polite">',
      '<div><span>POSIÇÃO A</span><strong id="wind-area-a">—</strong><small id="wind-view-a">Aguardando contorno</small></div>',
      '<div><span>POSIÇÃO B</span><strong id="wind-area-b">—</strong><small id="wind-view-b">Aguardando contorno</small></div>',
      '</div>',
      '<label class="wind-camera"><input type="checkbox" id="wind-same-camera" /> Confirme: mesma câmera, distância, zoom, resolução e ângulo nas posições A e B</label>',
      '<p id="wind-difference" class="wind-difference">Feche os dois contornos para comparar a ocupação relativa do enquadramento.</p>',
      '<p class="wind-warning"><strong>Importante:</strong> as linhas de ar são um recurso gráfico, não representam escoamento físico, turbulência ou pressão. ',
      'O percentual é a área do <em>polígono externo desenhado</em> em relação à imagem, incluindo vazios internos — não é área corporal real, CdA, watts, velocidade nem ganho aerodinâmico. ',
      'A vista lateral mostra o perfil; a vista frontal, a projeção frontal aproximada. Comparações só fazem sentido com enquadramento e escala idênticos. ',
      'Uma imagem menor não prova menor arrasto.</p>'
    ].join('');
    athlete.after(section);
    const titleActions=athlete.querySelector('.paiva-2d-title-actions');
    if(titleActions){
      const button=document.createElement('button');
      button.type='button';
      button.id='wind-jump';
      button.textContent='≈ Túnel visual';
      button.title='Abrir módulo gráfico de fluxo e ocupação de imagem';
      button.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      titleActions.prepend(button);
    }
    const nav=$('paiva-v524-nav');
    if(nav){
      const navButton=document.createElement('button');
      navButton.type='button';
      navButton.textContent='Vento';
      navButton.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      const pdfButton=[...nav.querySelectorAll('button')].find(b=>b.textContent==='PDF');
      if(pdfButton)nav.insertBefore(navButton,pdfButton);
      else nav.append(navButton);
    }

    const canvas=$('wind-canvas'),ctx=canvas.getContext('2d');
    if(!ctx){$('wind-message').textContent='O navegador não oferece Canvas 2D neste aparelho.';return;}
    const frame=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
    // Reutiliza o buffer de ar para evitar alocar dezenas de canvases por
    // segundo (especialmente importante nos celulares com pouca memória).
    const flowLayer=frame(),flowCtx=flowLayer.getContext('2d');
    const slots={
      a:{image:null,points:[],closed:false,view:'lateral'},
      b:{image:null,points:[],closed:false,view:'lateral'}
    };
    let selected='a',phase=0,visible=true,lastTick=0;
    const selectedSlot=()=>slots[selected];
    const note=message=>{$('wind-message').textContent=message;};
    const percentage=slot=>slot.closed?envelopePercent(slot.points):null;
    function renderStatus(){
      for(const key of ['a','b']){
        const slot=slots[key],pct=percentage(slot);
        $('wind-area-'+key).textContent=pct===null?'—':pct.toFixed(1).replace('.',',')+'% do quadro';
        $('wind-view-'+key).textContent=!slot.image?'Sem imagem':!slot.closed?'Contorno pendente':slot.view==='lateral'?'Perfil lateral · envelope':'Vista frontal · envelope';
      }
      $('wind-slot-a').classList.toggle('active',selected==='a');
      $('wind-slot-b').classList.toggle('active',selected==='b');
      $('wind-slot-a').setAttribute('aria-pressed',String(selected==='a'));
      $('wind-slot-b').setAttribute('aria-pressed',String(selected==='b'));
      $('wind-view').value=selectedSlot().view;
      const a=percentage(slots.a),b=percentage(slots.b);
      const valid=a!==null&&b!==null&&slots.a.view===slots.b.view&&$('wind-same-camera').checked;
      const status=$('wind-difference');
      if(a!==null&&b!==null&&slots.a.view!==slots.b.view)
        status.textContent='Não compare vistas diferentes. Use ambas laterais ou ambas frontais.';
      else if(a!==null&&b!==null&&!$('wind-same-camera').checked)
        status.textContent='Marque a confirmação do mesmo enquadramento e escala para liberar a comparação.';
      else if(valid){
        const difference=b-a;
        const word=Math.abs(difference)<.05?'ocupação equivalente':difference<0?'contorno B ocupa menos':'contorno B ocupa mais';
        status.textContent='Comparação geométrica: '+word+' · '+Math.abs(difference).toFixed(1).replace('.',',')+' ponto(s) percentual(is) do quadro. Não é diferença de arrasto.';
      } else status.textContent='Feche os contornos A e B para comparar a ocupação relativa do enquadramento.';
    }
    function outlinePath(points){
      ctx.beginPath();
      for(let i=0;i<points.length;i++){
        const p=points[i];
        if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
      }
    }
    function drawFlow(slot){
      if(!$('wind-flow').checked)return;
      const lc=flowCtx;
      if(!lc)return;
      lc.globalCompositeOperation='source-over';
      lc.clearRect(0,0,W,H);
      const b=slot.closed?polygonBounds(slot.points):null;
      const cy=b?(b.top+b.bottom)/2:H/2;
      const bh=b?Math.max(30,b.bottom-b.top):1;
      lc.lineWidth=1.5;
      lc.strokeStyle='#79daf7';
      lc.globalAlpha=.72;
      lc.setLineDash([11,14]);
      lc.lineDashOffset=-phase;
      for(let y=12;y<=H-12;y+=25){
        lc.beginPath();
        for(let x=-12;x<=W+12;x+=12){
          let shift=0;
          if(b){
            const dist=Math.abs(y-cy)/bh;
            const near=clamp(1-dist*1.45,0,1);
            const center=(b.left+b.right)/2;
            const influence=Math.exp(-Math.pow((x-center)/(Math.max(70,b.right-b.left)*.79),2));
            shift=(y<cy?-1:1)*near*bh*.62*influence;
          }
          if(x===-12)lc.moveTo(x,y+shift);else lc.lineTo(x,y+shift);
        }
        lc.stroke();
      }
      if(slot.closed){
        lc.globalCompositeOperation='destination-out';
        lc.setLineDash([]);
        lc.beginPath();
        slot.points.forEach((p,i)=>i?lc.lineTo(p.x,p.y):lc.moveTo(p.x,p.y));
        lc.closePath();
        lc.fill();
      }
      ctx.drawImage(flowLayer,0,0);
    }
    function draw(){
      const slot=selectedSlot();
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#0b141d';ctx.fillRect(0,0,W,H);
      if(slot.image)ctx.drawImage(slot.image,0,0,W,H);
      else{
        ctx.fillStyle='#d3e2e9';ctx.font='bold 28px system-ui';
        ctx.textAlign='center';ctx.fillText('PAIVA · TÚNEL VISUAL',W/2,H/2-12);
        ctx.font='17px system-ui';ctx.fillText('Traga um quadro do 2D ou abra uma foto',W/2,H/2+28);
        ctx.textAlign='left';
      }
      if(slot.image)drawFlow(slot);
      if(slot.points.length){
        ctx.save();
        outlinePath(slot.points);
        if(slot.closed){
          ctx.closePath();ctx.fillStyle='rgba(244,212,70,.11)';ctx.fill();
        }
        ctx.strokeStyle='#ffe054';ctx.lineWidth=3;ctx.setLineDash(slot.closed?[]:[9,7]);ctx.stroke();
        ctx.setLineDash([]);
        for(let i=0;i<slot.points.length;i++){
          const p=slot.points[i];ctx.beginPath();ctx.arc(p.x,p.y,i===0?6:4,0,Math.PI*2);
          ctx.fillStyle=i===0?'#f9fff7':'#ffe054';ctx.fill();
          ctx.strokeStyle='#101419';ctx.lineWidth=1;ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(8,8,402,36);
      ctx.fillStyle='#ffe054';ctx.font='bold 17px system-ui';
      ctx.fillText('PAIVA · VENTO VISUAL · '+selected.toUpperCase()+' · '+(slot.view==='lateral'?'LATERAL':'FRONTAL'),18,32);
      ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(8,H-42,W-16,34);
      ctx.fillStyle='#f3f4f5';ctx.font='13px system-ui';
      const pct=percentage(slot);
      ctx.fillText((pct===null?'CONTORNO PENDENTE':'ENVELOPE: '+pct.toFixed(1).replace('.',',')+'% DO QUADRO')+
        ' · FLUXO ILUSTRATIVO · NÃO MEDE CdA, ARRASTO OU WATTS',20,H-20);
    }
    function loop(now){
      if(now-lastTick>=33){
        if(visible&&!document.hidden){
          if($('wind-flow').checked)phase=(phase+1.8)%200;
          draw();
        }
        lastTick=now;
      }
      requestAnimationFrame(loop);
    }
    if(typeof IntersectionObserver==='function'){
      const watcher=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);});
      watcher.observe(section);
    }
    function assignImage(source){
      const target=frame(),tc=target.getContext('2d');
      const sw=source.videoWidth||source.naturalWidth||source.width;
      const sh=source.videoHeight||source.naturalHeight||source.height;
      if(!(sw>0&&sh>0)){note('Imagem não carregada ou vídeo sem quadro disponível.');return false;}
      tc.fillStyle='#0b141d';tc.fillRect(0,0,W,H);
      const scale=Math.min(W/sw,H/sh);
      tc.drawImage(source,(W-sw*scale)/2,(H-sh*scale)/2,sw*scale,sh*scale);
      const slot=selectedSlot();
      slot.image=target;
      slot.points=[];
      slot.closed=false;
      $('wind-same-camera').checked=false;
      renderStatus();draw();
      note('Imagem carregada na posição '+selected.toUpperCase()+'. Clique ao redor do envelope externo (atleta + bicicleta) e depois em Fechar contorno.');
      return true;
    }
    $('wind-capture').addEventListener('click',()=>{
      const sourceCanvas=$('paiva-2d-canvas'),video=$('paiva-2d-video');
      if(video&&!video.hidden&&video.readyState>=2&&video.videoWidth>0){
        assignImage(video);
      }else if(globalThis.PAIVA_ATHLETE_2D?.hasImage?.()&&sourceCanvas){
        assignImage(sourceCanvas);
      }else note('Primeiro abra uma foto ou vídeo no módulo Análise Angular 2D. Ou abra uma foto aqui.');
    });
    $('wind-image').addEventListener('change',event=>{
      const file=event.target.files?.[0];
      if(!file)return;
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>25*1024*1024){
        note('Use uma foto JPG, PNG ou WebP de até 25 MB.');event.target.value='';return;
      }
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>{assignImage(image);URL.revokeObjectURL(url);event.target.value='';};
      image.onerror=()=>{note('Não foi possível abrir esta foto.');URL.revokeObjectURL(url);event.target.value='';};
      image.src=url;
    });
    function choose(key){
      selected=key;renderStatus();draw();
      note('Posição '+key.toUpperCase()+': '+(selectedSlot().image?'ajuste o contorno ou carregue outro quadro.':'traga um quadro do 2D ou uma foto.'));
    }
    $('wind-slot-a').addEventListener('click',()=>choose('a'));
    $('wind-slot-b').addEventListener('click',()=>choose('b'));
    $('wind-view').addEventListener('change',event=>{
      selectedSlot().view=event.target.value;
      renderStatus();
    });
    function canvasPoint(event){
      const rect=canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return null;
      return {x:clamp((event.clientX-rect.left)*W/rect.width,0,W),
        y:clamp((event.clientY-rect.top)*H/rect.height,0,H)};
    }
    canvas.addEventListener('click',event=>{
      const slot=selectedSlot();
      if(!slot.image){note('Traga uma imagem antes de desenhar.');return;}
      if(slot.closed){note('Contorno já fechado. Use Voltar um ponto ou Apagar contorno para editar.');return;}
      const point=canvasPoint(event);
      if(!point)return;
      slot.points.push(point);
      note(slot.points.length+' ponto(s). Contorne o envelope externo, depois clique em Fechar contorno.');
      renderStatus();draw();
    });
    $('wind-close').addEventListener('click',()=>{
      const slot=selectedSlot();
      if(slot.points.length<3){note('Marque pelo menos três pontos ao redor do atleta e bicicleta.');return;}
      if(crossesItself(slot.points)){
        note('O contorno cruza sobre ele mesmo. Volte os últimos pontos e siga a borda externa sem cruzamentos.');
        return;
      }
      if(polygonArea(slot.points)<100){note('Contorno muito pequeno; confira os pontos.');return;}
      slot.closed=true;renderStatus();draw();
      note('Contorno '+selected.toUpperCase()+' fechado. O percentual descreve apenas o envelope desenhado no quadro.');
    });
    $('wind-undo').addEventListener('click',()=>{
      const slot=selectedSlot();
      if(!slot.points.length)return;
      slot.closed=false;slot.points.pop();renderStatus();draw();
      note('Último ponto removido; você pode continuar o desenho.');
    });
    $('wind-clear').addEventListener('click',()=>{
      const slot=selectedSlot();
      slot.points=[];slot.closed=false;renderStatus();draw();
      note('Apenas o contorno '+selected.toUpperCase()+' foi apagado; imagem preservada.');
    });
    $('wind-flow').addEventListener('change',draw);
    $('wind-same-camera').addEventListener('change',renderStatus);
    $('wind-download').addEventListener('click',()=>{
      if(!selectedSlot().image){note('Abra uma imagem antes de salvar.');return;}
      draw();
      canvas.toBlob(blob=>{
        if(!blob){note('Não foi possível gerar a imagem PNG.');return;}
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='PAIVA_Tunel_Visual_'+selected.toUpperCase()+'.png';
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        note('Imagem experimental salva em PNG com aviso de fluxo ilustrativo.');
      },'image/png');
    });
    renderStatus();draw();requestAnimationFrame(loop);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
