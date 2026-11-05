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
      '<span class="wind-stamp">V5.34 · SILHUETA</span></div>',
      '<div class="wind-actions">',
      '<button type="button" id="wind-capture">▣ Trazer quadro do 2D</button>',
      '<label class="wind-upload">↑ Abrir foto independente<input id="wind-image" type="file" accept="image/png,image/jpeg,image/webp" /></label>',
      '<label>Vista <select id="wind-view"><option value="lateral">Lateral · perfil</option><option value="frontal">Frontal · frente</option></select></label>',
      '</div>',
      '<div class="wind-studio"><div class="wind-studio-heading">CAPTURA INDEPENDENTE · SEM ALTERAR O 2D</div>',
      '<div class="wind-actions">',
      '<button type="button" id="wind-camera-start">◉ Ligar webcam</button>',
      '<button type="button" id="wind-camera-stop">■ Desligar webcam</button>',
      '<label class="wind-upload">↑ Abrir vídeo<input id="wind-video-file" type="file" accept="video/*,.mp4,.mov,.webm,.m4v" /></label>',
      '<button type="button" id="wind-video-toggle">▶ Reproduzir/pausar</button>',
      '<button type="button" id="wind-video-snapshot">▣ Guardar quadro em A/B</button>',
      '<button type="button" id="wind-live-toggle">▶ Ler silhueta ao vivo</button>',
      '</div><video id="wind-live-video" playsinline muted hidden></video>',
      '<small id="wind-camera-info">Captura local. Webcam exige HTTPS e permissão; foto/vídeo não são enviados a servidores.</small>',
      '<p id="wind-live-status" class="wind-live-status">Ao vivo desligado. Primeiro calibre o fundo.</p></div>',
      '<div class="wind-studio"><div class="wind-studio-heading">RECORTE DA SILHUETA</div>',
      '<div class="wind-actions">',
      '<label>Leitura <select id="wind-analysis"><option value="auto">Automática · pixels</option><option value="manual">Manual · contorno externo</option></select></label>',
      '<label>Fundo <select id="wind-background-mode"><option value="green">Verde liso</option><option value="wall">Parede comum</option></select></label>',
      '<label>Sensibilidade <input id="wind-threshold" type="range" min="12" max="100" value="36" step="2" /><output id="wind-threshold-value">36</output></label>',
      '</div>',
      '<div class="wind-actions">',
      '<button type="button" id="wind-empty-capture">▣ Capturar fundo VAZIO</button>',
      '<label class="wind-upload">↑ Foto do fundo vazio<input id="wind-empty-file" type="file" accept="image/png,image/jpeg,image/webp" /></label>',
      '<button type="button" id="wind-roi-select">▣ Delimitar área (2 cliques)</button>',
      '<button type="button" id="wind-roi-reset">Área inteira</button>',
      '<button type="button" id="wind-auto-run">✓ Identificar silhueta A/B</button>',
      '</div><small id="wind-bg-info">Verde: luz uniforme e boa separação da roupa. Parede comum: grave primeiro a parede sem ninguém, sem mover câmera ou iluminação.</small>',
      '</div>',
      '<div class="wind-slots" role="group" aria-label="Duas posições para comparação">',
      '<button type="button" id="wind-slot-a" class="active" aria-pressed="true">A · Posição inicial</button>',
      '<button type="button" id="wind-slot-b" aria-pressed="false">B · Posição alternativa</button>',
      '</div>',
      '<div class="wind-workspace"><canvas id="wind-canvas" width="960" height="540" aria-label="Imagem de bicicleta com contorno manual e linhas animadas de fluxo ilustrativo"></canvas>',
      '<p id="wind-message" role="status" aria-live="polite">Traga uma foto ou vídeo. Escolha Fundo verde ou Parede comum e clique em Identificar silhueta. O contorno manual continua disponível.</p></div>',
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
      'Na leitura automática, o percentual é a proporção de pixels não classificados como fundo dentro do recorte escolhido; pode incluir objetos, sombras e falhas de iluminação. ',
      'No modo manual, é a área do <em>polígono externo desenhado</em> em relação à imagem e inclui vazios internos. ',
      'Nenhuma leitura equivale a área real em m², CdA, watts, velocidade ou ganho aerodinâmico. ',
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
      a:{image:null,points:[],closed:false,view:'lateral',segmentation:null},
      b:{image:null,points:[],closed:false,view:'lateral',segmentation:null}
    };
    section.dataset.analysis='auto';
    let selected='a',phase=0,visible=true,lastTick=0;
    const liveVideo=$('wind-live-video');
    let webcamStream=null,videoURL=null,liveMode=false,liveFrame=null,liveSegmentation=null,lastLiveSample=0;
    const liveBuffer=frame();
    let emptyBackground=null,roi={left:0,top:0,right:1,bottom:1},roiSelecting=false,roiFirst=null;
    const maskSize={width:320,height:180};
    const selectedSlot=()=>slots[selected];
    const note=message=>{$('wind-message').textContent=message;};
    const isAuto=()=>$('wind-analysis').value==='auto';
    const percentage=slot=>isAuto()?(slot.segmentation?.warning?null:(slot.segmentation?.percent??null)):
      slot.closed?envelopePercent(slot.points):null;
    const currentMode=()=>$('wind-background-mode').value;
    const threshold=()=>Number($('wind-threshold').value)||36;
    const roiEquals=(a,b)=>a&&b&&['left','top','right','bottom'].every(k=>Math.abs(a[k]-b[k])<.00001);
    function toSample(source){
      const resized=document.createElement('canvas');
      resized.width=maskSize.width;resized.height=maskSize.height;
      const context=resized.getContext('2d',{willReadFrequently:true});
      if(!context)return null;
      context.drawImage(source,0,0,maskSize.width,maskSize.height);
      return context.getImageData(0,0,maskSize.width,maskSize.height);
    }
    function makeSegmentation(source){
      const current=toSample(source);
      if(!current)throw new Error('Não foi possível ler os pixels desta imagem.');
      const result=globalThis.PAIVA_WIND_SEGMENT?.segmentPixels(
        current,emptyBackground?toSample(emptyBackground):null,
        {mode:currentMode(),threshold:threshold(),roi});
      if(!result)throw new Error('Motor de silhueta indisponível. Atualize o site para V5.34.');
      const bitmap=document.createElement('canvas');
      bitmap.width=result.width;bitmap.height=result.height;
      const c=bitmap.getContext('2d');
      const rgba=c.createImageData(result.width,result.height);
      for(let i=0;i<result.mask.length;i++){
        if(!result.mask[i])continue;
        const p=i*4;
        rgba.data[p]=33;rgba.data[p+1]=226;rgba.data[p+2]=232;rgba.data[p+3]=255;
      }
      c.putImageData(rgba,0,0);
      const b=result.bounds;
      const bounds=b?{
        left:b.left*W/result.width,right:(b.right+1)*W/result.width,
        top:b.top*H/result.height,bottom:(b.bottom+1)*H/result.height
      }:null;
      return {...result,maskCanvas:bitmap,bounds,roi:{...roi},
        mode:currentMode(),threshold:threshold()};
    }
    function analyzeSlot(slot,quiet=false){
      if(!slot.image){if(!quiet)note('Carregue primeiro uma imagem na posição '+selected.toUpperCase()+'.');return;}
      try{
        slot.segmentation=makeSegmentation(slot.image);
        if(!quiet)note(slot.segmentation.warning||'Silhueta identificada. O percentual descreve pixels na região analisada, não CdA.');
      }catch(error){
        slot.segmentation=null;
        if(!quiet)note(error.message);
      }
    }
    function invalidateMasks(){
      slots.a.segmentation=null;slots.b.segmentation=null;liveSegmentation=null;
      $('wind-same-camera').checked=false;
    }
    function renderStatus(){
      for(const key of ['a','b']){
        const slot=slots[key],pct=percentage(slot);
        $('wind-area-'+key).textContent=pct===null?'—':
          pct.toFixed(1).replace('.',',')+'% '+(isAuto()?'da região':'do quadro');
        const view=slot.view==='lateral'?'Perfil lateral':'Vista frontal';
        $('wind-view-'+key).textContent=!slot.image?'Sem imagem':
          isAuto()?(slot.segmentation?.warning?'Revisar fundo · '+view:slot.segmentation?'Pixels · '+view:'Recorte pendente'):
          !slot.closed?'Contorno pendente':view+' · envelope';
      }
      $('wind-slot-a').classList.toggle('active',selected==='a');
      $('wind-slot-b').classList.toggle('active',selected==='b');
      $('wind-slot-a').setAttribute('aria-pressed',String(selected==='a'));
      $('wind-slot-b').setAttribute('aria-pressed',String(selected==='b'));
      $('wind-view').value=selectedSlot().view;
      const a=percentage(slots.a),b=percentage(slots.b);
      const valid=a!==null&&b!==null&&slots.a.view===slots.b.view&&
        (!isAuto()||(slots.a.segmentation?.mode===slots.b.segmentation?.mode&&
        roiEquals(slots.a.segmentation?.roi,slots.b.segmentation?.roi)))&&
        $('wind-same-camera').checked;
      const status=$('wind-difference');
      if(a!==null&&b!==null&&slots.a.view!==slots.b.view)
        status.textContent='Não compare vistas diferentes. Use ambas laterais ou ambas frontais.';
      else if(a!==null&&b!==null&&!$('wind-same-camera').checked)
        status.textContent='Marque a confirmação do mesmo enquadramento e escala para liberar a comparação.';
      else if(valid){
        const difference=b-a;
        const word=Math.abs(difference)<.05?'ocupação semelhante':difference<0?'B ocupa menos pixels':'B ocupa mais pixels';
        status.textContent='Comparação de imagem: '+word+' · '+Math.abs(difference).toFixed(1).replace('.',',')+
          ' ponto(s) percentual(is). Não é diferença de arrasto.';
      } else status.textContent=isAuto()?'Identifique a silhueta A e B para comparar as duas posturas.':
        'Feche os contornos A e B para comparar a ocupação relativa do enquadramento.';
    }
    function outlinePath(points){
      ctx.beginPath();
      for(let i=0;i<points.length;i++){
        const p=points[i];
        if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
      }
    }
    function drawFlow(slot,segmentation=null){
      if(!$('wind-flow').checked)return;
      const lc=flowCtx;
      if(!lc)return;
      lc.globalCompositeOperation='source-over';
      lc.globalAlpha=1;
      lc.clearRect(0,0,W,H);
      const b=isAuto()?segmentation?.bounds:(slot.closed?polygonBounds(slot.points):null);
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
      if(isAuto()&&segmentation?.maskCanvas){
        lc.globalCompositeOperation='destination-out';
        lc.globalAlpha=1;
        lc.drawImage(segmentation.maskCanvas,0,0,W,H);
      }else if(!isAuto()&&slot.closed){
        lc.globalCompositeOperation='destination-out';
        lc.globalAlpha=1;
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
      const showingLive=liveMode&&!!liveFrame;
      const pictured=showingLive?liveFrame:slot.image;
      const segmentation=isAuto()?(showingLive?liveSegmentation:slot.segmentation):null;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#0b141d';ctx.fillRect(0,0,W,H);
      if(pictured)ctx.drawImage(pictured,0,0,W,H);
      else{
        ctx.fillStyle='#d3e2e9';ctx.font='bold 28px system-ui';
        ctx.textAlign='center';ctx.fillText('PAIVA · TÚNEL VISUAL',W/2,H/2-12);
        ctx.font='17px system-ui';ctx.fillText('Traga um quadro do 2D ou abra uma foto',W/2,H/2+28);
        ctx.textAlign='left';
      }
      if(pictured)drawFlow(slot,segmentation);
      if(isAuto()&&segmentation?.maskCanvas){
        ctx.save();
        ctx.globalAlpha=.24;
        ctx.drawImage(segmentation.maskCanvas,0,0,W,H);
        ctx.restore();
      }
      if(!isAuto()&&slot.points.length&&!showingLive){
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
      if(isAuto()&&pictured){
        ctx.save();
        ctx.strokeStyle='#ffe054';ctx.lineWidth=2;ctx.setLineDash([8,6]);
        ctx.strokeRect(roi.left*W,roi.top*H,(roi.right-roi.left)*W,(roi.bottom-roi.top)*H);
        ctx.restore();
        if(roiFirst){
          ctx.beginPath();ctx.arc(roiFirst.x,roiFirst.y,7,0,Math.PI*2);
          ctx.fillStyle='#ffdd56';ctx.fill();
        }
      }
      ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(8,8,402,36);
      ctx.fillStyle='#ffe054';ctx.font='bold 17px system-ui';
      ctx.fillText('PAIVA · VENTO VISUAL · '+(showingLive?'AO VIVO':selected.toUpperCase())+
        ' · '+(slot.view==='lateral'?'LATERAL':'FRONTAL'),18,32);
      ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(8,H-42,W-16,34);
      ctx.fillStyle='#f3f4f5';ctx.font='13px system-ui';
      const pct=showingLive?(segmentation?.warning?null:segmentation?.percent):percentage(slot);
      const label=pct===null||pct===undefined?'LEITURA PENDENTE':
        (isAuto()?'PIXELS: ':'ENVELOPE: ')+pct.toFixed(1).replace('.',',')+
        '% '+(isAuto()?'DA REGIÃO':'DO QUADRO');
      ctx.fillText(label+
        ' · FLUXO ILUSTRATIVO · NÃO MEDE CdA, ARRASTO OU WATTS',20,H-20);
    }
    function loop(now){
      if(now-lastTick>=33){
        if(visible&&!document.hidden){
          if(liveMode&&now-lastLiveSample>=300&&liveVideo.readyState>=2&&
            liveVideo.videoWidth>0&&!liveVideo.paused){
            const frameCanvas=sourceFrame(liveVideo,liveBuffer);
            if(frameCanvas){
              liveFrame=frameCanvas;
              if(isAuto()){
                try{
                  liveSegmentation=makeSegmentation(liveFrame);
                  const result=liveSegmentation;
                  $('wind-live-status').textContent=result.warning||('Leitura ao vivo · '+
                    result.percent.toFixed(1).replace('.',',')+'% da região · '+
                    (selectedSlot().view==='lateral'?'perfil lateral':'projeção frontal')+
                    ' · não é CdA.');
                }catch(error){
                  liveSegmentation=null;
                  $('wind-live-status').textContent=error.message;
                }
              }
            }
            lastLiveSample=now;
          }
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
    function sourceFrame(source,target=frame()){
      const tc=target.getContext('2d');
      const sw=source.videoWidth||source.naturalWidth||source.width;
      const sh=source.videoHeight||source.naturalHeight||source.height;
      if(!(sw>0&&sh>0))return null;
      tc.fillStyle='#0b141d';tc.fillRect(0,0,W,H);
      const scale=Math.min(W/sw,H/sh);
      tc.drawImage(source,(W-sw*scale)/2,(H-sh*scale)/2,sw*scale,sh*scale);
      return target;
    }
    function assignImage(source){
      const target=sourceFrame(source);
      if(!target){note('Imagem não carregada ou vídeo sem quadro disponível.');return false;}
      const slot=selectedSlot();
      slot.image=target;
      slot.points=[];
      slot.closed=false;
      slot.segmentation=null;
      $('wind-same-camera').checked=false;
      if(isAuto())analyzeSlot(slot,true);
      renderStatus();draw();
      note(isAuto()?
        'Imagem '+selected.toUpperCase()+' carregada. Confira o recorte automático; se necessário, delimite a área e ajuste a sensibilidade.':
        'Imagem '+selected.toUpperCase()+' carregada. Clique ao redor do contorno externo e depois em Fechar contorno.');
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
    function refreshMasks(){
      invalidateMasks();
      if(isAuto()){
        analyzeSlot(slots.a,true);
        analyzeSlot(slots.b,true);
      }
      renderStatus();draw();
    }
    function explainBackground(){
      $('wind-bg-info').textContent=currentMode()==='green'?
        'Fundo verde: coloque tecido liso bem iluminado atrás do ciclista, sem roupa verde. Ajuste sensibilidade se houver falhas.':
        'Parede comum: CAPTURE PRIMEIRO a cena vazia. Câmera, luz, zoom e objetos devem permanecer imóveis. Movimentos do fundo falseiam a silhueta.';
    }
    $('wind-background-mode').addEventListener('change',()=>{
      explainBackground();refreshMasks();
      note(currentMode()==='green'?'Modo de fundo verde selecionado.':
        'Modo parede comum. Capture ou carregue primeiro o fundo vazio com câmera fixa.');
    });
    $('wind-analysis').addEventListener('change',()=>{
      section.dataset.analysis=$('wind-analysis').value;
      if(!isAuto()&&liveMode){
        liveMode=false;liveFrame=null;liveSegmentation=null;
        $('wind-live-toggle').textContent='▶ Ler silhueta ao vivo';
        $('wind-live-status').textContent='Modo manual: vídeo pausado para permitir desenhar.';
      }
      if(isAuto())refreshMasks();
      else{renderStatus();draw();}
      note(isAuto()?'Modo automático: recorte por pixels e fundo calibrado.':
        'Modo manual: clique ao redor do contorno externo e feche a forma.');
    });
    $('wind-threshold').addEventListener('input',event=>{
      $('wind-threshold-value').textContent=event.target.value;
    });
    $('wind-threshold').addEventListener('change',()=>{
      refreshMasks();
      note('Sensibilidade atualizada. Confira a máscara colorida antes de apresentar qualquer comparação.');
    });
    $('wind-roi-select').addEventListener('click',()=>{
      roiSelecting=true;roiFirst=null;
      note('Clique nos dois cantos opostos de uma região que contenha a bicicleta e o ciclista, com fundo uniforme.');
    });
    $('wind-roi-reset').addEventListener('click',()=>{
      roi={left:0,top:0,right:1,bottom:1};roiSelecting=false;roiFirst=null;
      refreshMasks();note('Região restaurada para a imagem inteira.');
    });
    $('wind-auto-run').addEventListener('click',()=>{
      if(!selectedSlot().image){note('Carregue ou guarde um quadro primeiro.');return;}
      $('wind-analysis').value='auto';
      analyzeSlot(selectedSlot());renderStatus();draw();
    });
    function readStill(file,action,input){
      if(!file)return;
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>25*1024*1024){
        note('Use foto JPG, PNG ou WebP de até 25 MB.');input.value='';return;
      }
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>{
        action(image);
        URL.revokeObjectURL(url);input.value='';
      };
      image.onerror=()=>{URL.revokeObjectURL(url);input.value='';note('Não foi possível abrir a foto do fundo vazio.');};
      image.src=url;
    }
    function setBackground(source){
      const copy=sourceFrame(source);
      if(!copy){note('Abra ou ligue a câmera com a cena vazia antes de calibrar.');return;}
      emptyBackground=copy;
      refreshMasks();
      note('Fundo vazio registrado. Agora coloque a bicicleta e o ciclista SEM MOVER a câmera nem mudar a luz.');
    }
    $('wind-empty-capture').addEventListener('click',()=>{
      if(liveVideo.readyState>=2&&liveVideo.videoWidth>0)setBackground(liveVideo);
      else if(selectedSlot().image)setBackground(selectedSlot().image);
      else note('Aponte a câmera para o fundo VAZIO, ou carregue uma foto sem ciclista.');
    });
    $('wind-empty-file').addEventListener('change',event=>{
      readStill(event.target.files?.[0],setBackground,event.target);
    });
    function stopSource(){
      liveMode=false;liveFrame=null;liveSegmentation=null;
      if(webcamStream){
        for(const track of webcamStream.getTracks())track.stop();
        webcamStream=null;
      }
      liveVideo.pause();
      liveVideo.srcObject=null;
      liveVideo.removeAttribute('src');
      liveVideo.load();
      if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}
      $('wind-live-toggle').textContent='▶ Ler silhueta ao vivo';
      $('wind-live-status').textContent='Ao vivo desligado.';
    }
    $('wind-camera-start').addEventListener('click',async()=>{
      if(!navigator.mediaDevices?.getUserMedia){
        note('Webcam indisponível. Use HTTPS no GitHub e libere a permissão do navegador.');return;
      }
      stopSource();
      try{
        webcamStream=await navigator.mediaDevices.getUserMedia({
          video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});
        liveVideo.srcObject=webcamStream;
        await liveVideo.play();
        $('wind-camera-info').textContent='Webcam ligada no PAIVA AERO. Enquadre o ciclista e fotografe o fundo vazio antes de posicioná-lo.';
        note('Webcam independente ligada. Ajuste a vista frontal ou lateral; câmera e fundo devem permanecer fixos.');
      }catch(error){
        stopSource();
        note('Não foi possível ligar a webcam: '+(error?.name||'permissão ou dispositivo indisponível')+'.');
      }
    });
    $('wind-camera-stop').addEventListener('click',()=>{
      stopSource();note('Webcam/vídeo independente desligado. As imagens A e B foram preservadas.');
    });
    $('wind-video-file').addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      if(!file)return;
      stopSource();
      videoURL=URL.createObjectURL(file);
      liveVideo.src=videoURL;
      liveVideo.loop=true;
      try{
        await liveVideo.play();
        note('Vídeo carregado. Pause no quadro desejado e clique em Guardar quadro em A/B.');
      }catch(error){note('Não foi possível reproduzir este formato. Tente MP4 H.264 ou WebM no navegador.');}
      event.target.value='';
    });
    $('wind-video-toggle').addEventListener('click',async()=>{
      if(!liveVideo.srcObject&&!liveVideo.getAttribute('src')){
        note('Abra um vídeo ou ligue a webcam neste módulo.');return;
      }
      if(liveVideo.paused){
        try{await liveVideo.play();note('Vídeo reproduzindo.');}
        catch(error){note('O navegador não conseguiu reproduzir o vídeo.');}
      }else{
        liveVideo.pause();liveMode=false;liveFrame=null;
        $('wind-live-toggle').textContent='▶ Ler silhueta ao vivo';
        note('Vídeo pausado. Agora você pode guardar o quadro.');
      }
      draw();
    });
    $('wind-video-snapshot').addEventListener('click',()=>{
      if(liveVideo.readyState<2||!liveVideo.videoWidth){
        note('Primeiro abra um vídeo ou ligue a webcam independente.');return;
      }
      assignImage(liveVideo);
      note('Quadro atual guardado em '+selected.toUpperCase()+'. Para comparar, selecione a outra posição e guarde um novo quadro.');
    });
    $('wind-live-toggle').addEventListener('click',async()=>{
      if(liveMode){
        liveMode=false;liveFrame=null;liveSegmentation=null;
        $('wind-live-toggle').textContent='▶ Ler silhueta ao vivo';
        $('wind-live-status').textContent='Leitura pausada; posições A e B preservadas.';
        draw();return;
      }
      if(!isAuto()){
        note('Selecione Leitura automática para acompanhar a silhueta ao vivo.');return;
      }
      if(liveVideo.readyState<2||!liveVideo.videoWidth){
        note('Ligue a webcam ou abra um vídeo neste módulo para leitura ao vivo.');return;
      }
      try{if(liveVideo.paused)await liveVideo.play();}
      catch(error){note('Não foi possível reproduzir o vídeo para leitura.');return;}
      liveMode=true;lastLiveSample=0;
      $('wind-live-toggle').textContent='⏸ Parar leitura';
      note(currentMode()==='wall'&&!emptyBackground?
        'Prévia ao vivo ligada. Enquadre a parede VAZIA e clique em Capturar fundo VAZIO antes de colocar o ciclista.':
        'Leitura de pixels ao vivo iniciada. Guarde o quadro em A ou B para comparar duas posturas. Não mede arrasto.');
    });
    window.addEventListener('pagehide',stopSource,{once:true});
    function choose(key){
      selected=key;renderStatus();draw();
      note('Posição '+key.toUpperCase()+': '+(selectedSlot().image?
        'imagem pronta; ajuste a leitura ou carregue outro quadro.':'traga um quadro do 2D, vídeo ou uma foto.'));
    }
    $('wind-slot-a').addEventListener('click',()=>choose('a'));
    $('wind-slot-b').addEventListener('click',()=>choose('b'));
    $('wind-view').addEventListener('change',event=>{
      selectedSlot().view=event.target.value;
      $('wind-same-camera').checked=false;
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
      const point=canvasPoint(event);
      if(!point)return;
      if(roiSelecting){
        if(!roiFirst){
          roiFirst=point;
          note('Primeiro canto registrado. Clique no canto oposto para delimitar a área de leitura.');
        }else{
          const candidate={
            left:Math.min(roiFirst.x,point.x)/W,right:Math.max(roiFirst.x,point.x)/W,
            top:Math.min(roiFirst.y,point.y)/H,bottom:Math.max(roiFirst.y,point.y)/H
          };
          if(candidate.right-candidate.left<.12||candidate.bottom-candidate.top<.12){
            note('Região muito pequena. Clique novamente no canto oposto, mais distante.');
            return;
          }
          roi=candidate;roiFirst=null;roiSelecting=false;
          refreshMasks();
          note('Região delimitada. A mesma área será aplicada às posições A e B.');
        }
        draw();return;
      }
      if(isAuto()){
        note('Leitura automática ativa. Clique em Delimitar área (2 cliques) para definir a região ou escolha Leitura manual.');
        return;
      }
      if(!slot.image){note('Traga uma imagem antes de desenhar.');return;}
      if(slot.closed){note('Contorno já fechado. Use Voltar um ponto ou Apagar contorno para editar.');return;}
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
