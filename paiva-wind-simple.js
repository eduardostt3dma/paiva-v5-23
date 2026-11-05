/* PAIVA AERO V5.36 — vento ilustrativo + inclinação de tronco em 2D.
   Painel independente, com autoria Eduardo Paiva. */
(() => {
  'use strict';
  const W=960,H=540;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const COLORS={
    electric:{line:'#1de0ff',bright:'#bdffff',particle:'#35b8ff',wake:'#45cfff'},
    sun:{line:'#ffe443',bright:'#fff9ae',particle:'#ffc431',wake:'#fbc25d'},
    magenta:{line:'#ff4de8',bright:'#ffd0fb',particle:'#b68aff',wake:'#e87cdb'},
    laser:{line:'#61ff79',bright:'#d8ffb5',particle:'#19dfa2',wake:'#60e9a2'}
  };
  function wavePosition(x,y,ellipse,phase=0,intensity=3,direction=1){
    const rx=Math.max(35,ellipse.rx),ry=Math.max(28,ellipse.ry);
    const p=direction===1?x:W-x;
    const center=direction===1?ellipse.cx:W-ellipse.cx;
    const distance=p-center;
    const focus=Math.exp(-1.5*Math.pow(distance/(rx*1.32),2));
    const nearness=clamp(1-Math.abs(y-ellipse.cy)/(ry*1.45),0,1);
    const side=y<ellipse.cy?-1:1;
    const bend=side*ry*.46*focus*nearness*(.55+intensity*.11);
    const tail=Math.max(0,distance-rx);
    const wake=distance>rx?
      Math.sin(tail*.037-phase*.075)*ry*.13*nearness*
        Math.exp(-tail/(rx*1.7))*(.5+intensity*.13):0;
    return y+bend+wake;
  }
  // Ombro/acrômio -> quadril/trocânter, em vista lateral.
  // Retorna a inclinação aguda relativa à horizontal da imagem.
  function trunkInclination(shoulder,hip){
    if(!shoulder||!hip||![shoulder.x,shoulder.y,hip.x,hip.y].every(Number.isFinite))
      return null;
    const dx=Math.abs(shoulder.x-hip.x),dy=Math.abs(shoulder.y-hip.y);
    return Math.hypot(dx,dy)<12?null:Math.atan2(dy,dx)*180/Math.PI;
  }
  globalThis.PAIVA_WIND_SIMPLE_MATH={wavePosition,trunkInclination};
  if(typeof document==='undefined')return;

  function init(){
    const athlete=document.getElementById('paiva-athlete-2d');
    if(!athlete||document.getElementById('paiva-wind-simple'))return;
    const section=document.createElement('section');
    section.className='card paiva-wind-simple';
    section.id='paiva-wind-simple';
    section.innerHTML=[
      '<div class="aero-heading"><div><span>PAIVA LAB · VISUAL</span>',
      '<h2>TÚNEL DE VENTO</h2>',
      '<p>Reconhecimento automático do ciclista e da bicicleta · vento visual independente do 2D.</p></div>',
      '<span class="aero-badge">V5.46</span></div>',
      '<div class="aero-toolbar">',
      '<label class="aero-file">📷 Abrir foto<input id="aero-photo" type="file" accept="image/png,image/jpeg,image/webp"></label>',
      '<label class="aero-file">▶ Abrir vídeo<input id="aero-video-file" type="file" accept="video/*,.mp4,.mov,.webm,.m4v"></label>',
      '<button type="button" id="aero-webcam">◉ Usar webcam</button>',
      '<button type="button" id="aero-capture">▣ Usar quadro do 2D</button>',
      '</div>',
      '<div class="aero-detection">',
      '<label>Reconhecimento <select id="aero-background"><option value="auto" selected>IA · pessoa + bicicleta</option><option value="contrast">Contraste antigo · experimental</option><option value="green">Fundo verde</option><option value="wall">Parede comum</option></select></label>',
      '<button type="button" id="aero-empty-capture" hidden>▣ Memorizar fundo vazio</button>',
      '<label class="aero-file" id="aero-empty-file-wrap" hidden>↑ Foto da parede vazia<input id="aero-empty-file" type="file" accept="image/png,image/jpeg,image/webp"></label>',
      '<details class="aero-advanced"><summary>⚙ Ajustes finos</summary>',
      '<label>Separação do fundo (sem IA) <input id="aero-threshold" type="range" min="12" max="100" value="36" step="2"></label>',
      '<label>Vento próximo ao corpo <input id="aero-proximity" type="range" min="1" max="5" value="4" step="1"></label></details>',
      '<span id="aero-detection-status" role="status" aria-live="polite">Aguardando foto ou vídeo.</span>',
      '<button type="button" id="aero-ai-retry" hidden>↻ Tentar IA novamente</button>',
      '</div>',
      '<div class="aero-stage"><canvas id="aero-canvas" width="960" height="540" aria-label="Foto ou vídeo com ondas de vento ilustrativas atravessando a imagem"></canvas>',
      '<video id="aero-source-video" muted playsinline hidden></video></div>',
      '<p class="aero-guidance" id="aero-message" role="status" aria-live="polite">Abra uma foto ou vídeo: a IA tentará reconhecer automaticamente pessoa e bicicleta. Primeira utilização precisa de internet.</p>',
      '<details class="aero-advanced"><summary>✎ Recorte flexível (opcional)</summary><p class="aero-curve-hint">Clique nos pontos, arraste as bolinhas ou a linha e escolha ✓ Fechar recorte. Para retornar à IA, use ✕ Limpar curvas.</p></details>',
      '<div class="aero-measure">',
      '<button type="button" id="aero-trunk">📐 Medir tronco (2 pontos)</button>',
      '<div><strong id="aero-trunk-value">Ângulo do tronco: —</strong>',
      '<small>Somente vista lateral: clique no acrômio/ombro e depois no trocânter maior/quadril. Ângulo relativo à horizontal da foto.</small></div>',
      '</div>',
      '<div class="aero-toolbar aero-controls">',
      '<button type="button" id="aero-wind" class="aero-main">⏸ Pausar vento</button>',
      '<button type="button" id="aero-direction" title="A direção deve vir da frente da bike. Para ciclista olhando para direita, use vento para esquerda.">← Vento para a esquerda</button>',
      '<label class="aero-strength">Ondas <input type="range" id="aero-strength" min="1" max="5" step="1" value="3" aria-label="Intensidade visual das ondas de ar"><span>leve → forte</span></label>',
      '<label class="aero-palette">Cor <select id="aero-wave-palette" aria-label="Cor ilustrativa das ondas de vento"><option value="electric" selected>Azul elétrico</option><option value="sun">Amarelo solar</option><option value="magenta">Magenta</option><option value="laser">Verde laser</option></select></label>',
      '<button type="button" id="aero-play" hidden>⏸ Pausar vídeo</button>',
      '<button type="button" id="aero-stop-camera" hidden>■ Desligar câmera</button>',
      '<button type="button" id="aero-save">↓ Salvar imagem</button>',
      '</div>',
      '<p class="aero-disclaimer">O reconhecimento automático utiliza um modelo de segmentação por IA processado no próprio dispositivo; no primeiro acesso, é preciso baixar o modelo. ',
      'Fotos com oclusões, pouca luz ou bicicletas muito finas ainda podem falhar. ',
      'As ondas são <strong>ilustrativas</strong>: não representam dinâmica real do ar, CdA, arrasto ou watts.</p>'
    ].join('');
    athlete.after(section);
    const compareJump=document.createElement('button');
    compareJump.type='button';
    compareJump.textContent='▥ Comparar A/B frontal';
    compareJump.title='Abrir comparação de área projetada na vista frontal';
    compareJump.addEventListener('click',()=>{
      const comparison=document.getElementById('paiva-aero-compare');
      if(comparison)comparison.scrollIntoView({behavior:'smooth',block:'start'});
    });
    section.querySelector('.aero-toolbar')?.append(compareJump);
    const actions=athlete.querySelector('.paiva-2d-title-actions');
    if(actions){
      const shortcut=document.createElement('button');
      shortcut.id='aero-open';
      shortcut.type='button';
      shortcut.textContent='≈ Túnel visual';
      shortcut.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      actions.prepend(shortcut);
    }
    const nav=document.getElementById('paiva-v524-nav');
    if(nav){
      const button=document.createElement('button');
      button.type='button';button.textContent='Vento';
      button.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      const pdf=[...nav.querySelectorAll('button')].find(b=>b.textContent==='PDF');
      if(pdf)nav.insertBefore(button,pdf);else nav.append(button);
    }
    // Assinatura discreta junto à identidade do aplicativo. Posicionamento
    // no fluxo do cabeçalho evita sobrepor o botão flutuante "Bloquear".
    if(!document.getElementById('paiva-author-watermark')){
      const watermark=document.createElement('div');
      watermark.id='paiva-author-watermark';
      watermark.setAttribute('aria-label','Idealizado e desenvolvido por Eduardo Paiva');
      watermark.innerHTML='<strong>Desenvolvido por Eduardo Paiva</strong>';
      const brand=document.querySelector('main > header .brand-tag');
      (brand||document.querySelector('main > header')||document.body).append(watermark);
    }
    const footer=document.querySelector('main > footer');
    if(footer&&!footer.querySelector('.paiva-author-credit')){
      const credit=document.createElement('p');
      credit.className='paiva-author-credit';
      credit.textContent='Idealizado e desenvolvido por Eduardo Paiva · PAIVA Bike Fit Studio';
      footer.append(credit);
    }

    const el=id=>document.getElementById(id);
    const canvas=el('aero-canvas'),ctx=canvas.getContext('2d');
    if(!ctx){el('aero-message').textContent='Seu navegador não permite esta animação.';return;}
    const air=document.createElement('canvas');air.width=W;air.height=H;
    const ac=air.getContext('2d');
    const still=document.createElement('canvas');still.width=W;still.height=H;
    const sc=still.getContext('2d');
    const video=el('aero-source-video');
    const detectBase=document.createElement('canvas');detectBase.width=W;detectBase.height=H;
    const detectBaseCtx=detectBase.getContext('2d');
    const detectMini=document.createElement('canvas');detectMini.width=320;detectMini.height=180;
    const detectMiniCtx=detectMini.getContext('2d',{willReadFrequently:true});
    const maskCanvas=document.createElement('canvas');maskCanvas.width=320;maskCanvas.height=180;
    const maskCtx=maskCanvas.getContext('2d');
    // O ciclista padrão da vista lateral olha para a direita: vento contrário
    // ao deslocamento entra pelo lado DIREITO e segue para a esquerda.
    // O botão continua invertendo o sentido para outras fotografias.
    let mode='demo',videoURL=null,stream=null,playing=true,direction=-1,phase=0;
    let visible=true,lastTime=0;
    let lastAnalysis=0,blankReference=null,detection=null,manualContour=null;
    let imageEpoch=0,aiBusy=false,aiPending=false,aiFailed=false;
    let contentRoi={left:0,top:0,right:1,bottom:1};
    let ellipse={cx:W*.53,cy:H*.53,rx:W*.32,ry:H*.35};
    let pointerStart=null,dragging=false;
    let trunkPoints=[],measuringTrunk=false;
    // O automático segue como padrão. Um contorno manual opcional, quando
    // fechado, tem prioridade para a área que o vento deve contornar.
    const curveTool=globalThis.PAIVA_SPLINE?.attach({
      host:section.querySelector('.aero-stage'),target:canvas,
      toolbar:section.querySelector('.aero-toolbar'),
      closeOnFinish:true,label:'Recorte do vento',
      onChange:()=>{
        const previous=manualContour;
        const mask=curveTool?.getMask(320,180);
        manualContour=mask?
          globalThis.PAIVA_AERO_CONTOUR?.contourFromSegmentation(mask):null;
        if(previous||manualContour){
          if(mode!=='demo')identifySilhouette();
          render();
        }
      }
    });
    const notify=message=>{el('aero-message').textContent=message;};
    const strength=()=>Number(el('aero-strength').value)||3;
    const proximity=()=>Number(el('aero-proximity').value)||4;
    const palette=()=>COLORS[el('aero-wave-palette').value]||COLORS.electric;
    function resetTrunk(){
      trunkPoints=[];measuringTrunk=false;
      el('aero-trunk-value').textContent='Ângulo do tronco: —';
    }
    const sourceDims=source=>({
      width:source.videoWidth||source.naturalWidth||source.width,
      height:source.videoHeight||source.naturalHeight||source.height
    });
    function drawFitted(target,source){
      const size=sourceDims(source);
      if(!(size.width>0&&size.height>0))return false;
      target.fillStyle='#0b131c';
      target.fillRect(0,0,W,H);
      const ratio=Math.min(W/size.width,H/size.height);
      const x=(W-size.width*ratio)/2,y=(H-size.height*ratio)/2;
      contentRoi={left:x/W,top:y/H,
        right:(x+size.width*ratio)/W,bottom:(y+size.height*ratio)/H};
      target.drawImage(source,x,y,
        size.width*ratio,size.height*ratio);
      return true;
    }
    const backgroundMode=()=>el('aero-background').value;
    const sensitivity=()=>Number(el('aero-threshold').value)||36;
    function setRecognition(contour,source){
      if(!contour)throw Error('O recorte não encontrou uma silhueta suficiente.');
      detection=contour;
      const tinted=maskCtx.createImageData(320,180);
      for(let i=0;i<contour.mask.length;i++){
        if(!contour.mask[i])continue;
        const p=i*4;
        tinted.data[p]=81;tinted.data[p+1]=220;
        tinted.data[p+2]=242;tinted.data[p+3]=255;
      }
      maskCtx.putImageData(tinted,0,0);
      el('aero-detection-status').textContent=source;
      el('aero-detection-status').dataset.detected='true';
      el('aero-ai-retry').hidden=true;
      render();
    }
    function noteRecognitionFailure(message){
      detection=null;
      maskCtx.clearRect(0,0,320,180);
      el('aero-detection-status').textContent=message;
      el('aero-detection-status').dataset.detected='false';
      render();
    }
    function semanticRecognition(){
      if(aiFailed||mode==='demo')return;
      if(aiBusy){aiPending=true;return;}
      const pixels=currentPixels();
      if(!pixels){noteRecognitionFailure('Aguardando imagem válida para a IA.');return;}
      const ai=globalThis.PAIVA_WIND_AI;
      if(!ai){noteRecognitionFailure('Módulo de IA não carregou. Atualize a página.');return;}
      aiBusy=true;
      const currentEpoch=imageEpoch;
      el('aero-detection-status').textContent='⏳ IA reconhecendo ciclista e bicicleta…';
      el('aero-detection-status').dataset.detected='false';
      // A foto é analisada localmente. A importação baixa APENAS código e
      // modelo público; não há upload da foto para o provedor.
      ai.segment(detectMini).then(mask=>{
        if(currentEpoch!==imageEpoch||backgroundMode()!=='auto'||manualContour)return;
        const contour=globalThis.PAIVA_AERO_CONTOUR?.contourFromSegmentation(mask);
        setRecognition(contour,mask.bicyclePixels>0?
          '● IA: pessoa + bicicleta reconhecidas':
          '● IA: pessoa reconhecida · bicicleta parcialmente visível');
        notify('O vento visual agora acompanha o contorno identificado automaticamente pela IA.');
      }).catch(error=>{
        if(currentEpoch!==imageEpoch||backgroundMode()!=='auto'||manualContour)return;
        aiFailed=true;
        noteRecognitionFailure('IA não reconheceu: '+String(error.message||error));
        el('aero-ai-retry').hidden=false;
        notify('Não vou inventar um contorno: confira a foto ou tente a IA novamente. Fundo verde e parede vazia continuam disponíveis.');
      }).finally(()=>{
        aiBusy=false;
        if(aiPending){aiPending=false;identifySilhouette();}
      });
    }
    function currentPixels(){
      if(mode==='demo'||!detectMiniCtx||!detectBaseCtx)return null;
      if(mode==='photo'){
        detectBaseCtx.clearRect(0,0,W,H);
        detectBaseCtx.drawImage(still,0,0);
      }else if(video.readyState>=2&&video.videoWidth){
        if(!drawFitted(detectBaseCtx,video))return null;
      }else return null;
      detectMiniCtx.clearRect(0,0,320,180);
      detectMiniCtx.drawImage(detectBase,0,0,320,180);
      return detectMiniCtx.getImageData(0,0,320,180);
    }
    function identifySilhouette(){
      if(!manualContour&&backgroundMode()==='auto'){
        semanticRecognition();return;
      }
      try{
        let contour=manualContour;
        if(!contour){
          const pixels=currentPixels();
          if(!pixels){detection=null;return;}
          const segmentation=globalThis.PAIVA_WIND_SEGMENT?.segmentPixels(
            pixels,blankReference,
            {mode:backgroundMode()==='contrast'?'auto':backgroundMode(),
              threshold:sensitivity(),roi:contentRoi});
          if(!segmentation)throw new Error('O módulo visual ainda não carregou completamente.');
          if(segmentation.warning)throw new Error(segmentation.warning);
          contour=globalThis.PAIVA_AERO_CONTOUR?.contourFromSegmentation(segmentation);
        }
        if(!contour)throw new Error('Silhueta pouco definida. Use fundo uniforme, sem roupas da mesma cor.');
        setRecognition(contour,manualContour?
          '● Recorte flexível manual · área escolhida por você':
          backgroundMode()==='contrast'?
          '● Contraste experimental · confira o contorno':
          '● Contorno separado do fundo · confira o resultado');
      }catch(error){
        noteRecognitionFailure(error.message);
      }
    }
    function stopVideo(){
      video.pause();
      video.srcObject=null;
      video.removeAttribute('src');
      video.load();
      if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
      if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}
      el('aero-play').hidden=true;
      el('aero-stop-camera').hidden=true;
    }
    function setPhoto(source){
      stopVideo();
      if(!drawFitted(sc,source)){notify('Não foi possível ler esta imagem.');return;}
      mode='photo';
      imageEpoch++;aiFailed=false;detection=null;
      // O recorte de uma foto anterior não pode ser aplicado à nova pessoa.
      manualContour=null;curveTool?.reset();
      resetTrunk();
      identifySilhouette();
      notify(backgroundMode()==='auto'&&!manualContour?
        'Foto carregada. Reconhecimento de pessoa e bicicleta em andamento; o vento aparece após a análise.':
        'Foto carregada. Confira se o contorno corresponde ao atleta e à bicicleta.');
      render();
    }
    function airPath(){
      if(!ac)return;
      ac.globalCompositeOperation='source-over';ac.globalAlpha=1;
      ac.clearRect(0,0,W,H);
      // Uma linha reta atravessando um atleta não identificado parece uma
      // simulação válida, mas não é. Sem detecção não desenhamos vento falso.
      if(mode!=='demo'&&!detection)return;
      const amount=strength();
      const near=proximity(),colors=palette();
      ac.lineWidth=1.65;
      ac.strokeStyle=colors.line;
      ac.globalAlpha=.93;
      ac.setLineDash([8+amount,16]);
      ac.lineDashOffset=-phase*direction;
      for(let y=15;y<H;y+=23){
        ac.beginPath();
        for(let x=-12;x<=W+12;x+=8){
          const shifted=globalThis.PAIVA_AERO_CONTOUR?.automaticWaveY(
            x,y,detection,phase,amount,direction,W,H,near)??y;
          if(x===-12)ac.moveTo(x,shifted);else ac.lineTo(x,shifted);
        }
        ac.stroke();
      }
      ac.setLineDash([]);
      // Pequenas partículas deixam o movimento evidente mesmo em foto parada.
      ac.globalAlpha=.9;
      for(let i=0;i<84;i++){
        const travel=(phase*(2+amount*.7)+i*71+i*i*9)%(W+80)-40;
        const x=direction===1?travel:W-travel;
        const y=(i*43+19)%(H-24)+12;
        const shifted=globalThis.PAIVA_AERO_CONTOUR?.automaticWaveY(
          x,y,detection,phase,amount,direction,W,H,near)??y;
        ac.beginPath();ac.arc(x,shifted,i%5===0?2.1:1.15,0,Math.PI*2);
        ac.fillStyle=i%3===0?colors.bright:colors.particle;ac.fill();
      }
      // Oclusão por pixels DETECTADOS: o vento não atravessa a silhueta.
      if(detection){
        ac.globalCompositeOperation='destination-out';
        ac.globalAlpha=1;
        ac.drawImage(maskCanvas,0,0,W,H);
      }
      ac.globalCompositeOperation='source-over';
      ac.globalAlpha=1;
    }
    function drawWake(){
      if(!detection)return;
      const amount=strength(),colors=palette();
      const {width,height,bounds}=detection;
      const centerY=(bounds.top+bounds.bottom)*.5*H/height;
      const halfHeight=Math.max(30,(bounds.bottom-bounds.top)*.5*H/height);
      ctx.save();
      for(let j=0;j<9;j++){
        const origin=(direction===1?bounds.right:bounds.left)*W/width;
        const lane=(j-4)*halfHeight*.12;
        ctx.beginPath();
        for(let t=0;t<450;t+=7){
          const x=origin+direction*t;
          if(x<-20||x>W+20)break;
          const decay=Math.exp(-t/350);
          const y=centerY+lane+
            Math.sin(t*.043-phase*.095+j*.6)*halfHeight*.16*decay*
              (amount/3);
          if(t===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=colors.wake;
        ctx.globalAlpha=j%3===0?.45:.24;
        ctx.lineWidth=j%3===0?1.7:1.1;
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawTrunk(){
      if(!trunkPoints.length)return;
      ctx.save();
      const shoulder=trunkPoints[0],hip=trunkPoints[1];
      ctx.lineWidth=3.2;
      if(hip){
        ctx.strokeStyle='#ffdf65';
        ctx.beginPath();ctx.moveTo(shoulder.x,shoulder.y);ctx.lineTo(hip.x,hip.y);
        ctx.stroke();
        ctx.strokeStyle='rgba(227,247,255,.82)';
        ctx.setLineDash([7,6]);ctx.lineWidth=1.8;
        const side=shoulder.x<hip.x?-1:1;
        ctx.beginPath();ctx.moveTo(hip.x,hip.y);
        ctx.lineTo(hip.x+side*Math.max(55,Math.abs(shoulder.x-hip.x)),hip.y);
        ctx.stroke();ctx.setLineDash([]);
        const angle=trunkInclination(shoulder,hip);
        if(angle!==null){
          const label=angle.toFixed(1).replace('.',',')+'°';
          const x=clamp((hip.x+shoulder.x)/2+12,20,W-105);
          const y=clamp((hip.y+shoulder.y)/2-14,54,H-55);
          ctx.fillStyle='rgba(10,18,26,.83)';ctx.fillRect(x-7,y-27,100,33);
          ctx.fillStyle='#ffe46f';ctx.font='bold 23px system-ui';
          ctx.fillText(label,x,y);
        }
      }
      for(let i=0;i<trunkPoints.length;i++){
        const point=trunkPoints[i],label=i===0?'Ombro':'Quadril';
        ctx.beginPath();ctx.arc(point.x,point.y,6,0,Math.PI*2);
        ctx.fillStyle='#ffe36f';ctx.fill();
        ctx.lineWidth=1.7;ctx.strokeStyle='#0a151e';ctx.stroke();
        ctx.font='bold 12px system-ui';ctx.fillStyle='#fff';
        ctx.fillText(label,clamp(point.x+10,10,W-70),clamp(point.y+17,15,H-8));
      }
      ctx.restore();
    }
    function render(){
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#0c141f';ctx.fillRect(0,0,W,H);
      if(mode==='photo')ctx.drawImage(still,0,0);
      else if(['video','camera'].includes(mode)&&video.readyState>=2&&video.videoWidth)
        drawFitted(ctx,video);
      else{
        const glow=ctx.createRadialGradient(W*.45,H*.47,8,W*.45,H*.47,700);
        glow.addColorStop(0,'#243a4b');glow.addColorStop(1,'#09131c');
        ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#f3f5f5';ctx.textAlign='center';
        ctx.font='600 26px "Segoe UI",Arial,sans-serif';
        ctx.fillText('PAIVA AERO',W/2,H/2-38);
        ctx.fillStyle='#bdcedc';ctx.font='400 15px "Segoe UI",Arial,sans-serif';
        ctx.fillText('Abra uma foto ou vídeo para começar',W/2,H/2+2);
        ctx.textAlign='left';
      }
      // Com imagem real, as linhas só aparecem se a silhueta foi reconhecida.
      airPath();ctx.drawImage(air,0,0);
      drawWake();
      if(detection){
        ctx.save();ctx.globalAlpha=.11;ctx.drawImage(maskCanvas,0,0,W,H);ctx.restore();
      }
      drawTrunk();
      // Título leve, com a identidade amarela preservada e sem cobrir o atleta.
      ctx.fillStyle='rgba(4,11,17,.64)';ctx.fillRect(12,12,242,26);
      ctx.fillStyle='#ffe05e';ctx.font='600 12px "Segoe UI",Arial,sans-serif';
      if('letterSpacing' in ctx)ctx.letterSpacing='1.3px';
      ctx.fillText('PAIVA AERO · ONDA VISUAL',20,29);
      if('letterSpacing' in ctx)ctx.letterSpacing='0px';
      ctx.fillStyle='rgba(4,11,17,.62)';ctx.fillRect(12,H-32,W-24,23);
      ctx.fillStyle='#deedf7';ctx.font='400 10px "Segoe UI",Arial,sans-serif';
      ctx.fillText('VENTO ILUSTRATIVO · NÃO MEDE ARRASTO, CdA OU WATTS',20,H-17);
      ctx.textAlign='right';ctx.fillStyle='rgba(255,226,115,.82)';
      ctx.font='500 9px "Segoe UI",Arial,sans-serif';
      ctx.fillText('DESENVOLVIDO POR EDUARDO PAIVA',W-18,29);
      ctx.textAlign='left';
    }
    function tick(now){
      if(now-lastTime>32){
        if(visible&&!document.hidden){
          if((mode==='video'||mode==='camera')&&
            video.readyState>=2&&!video.paused&&
            now-lastAnalysis>=(backgroundMode()==='auto'?800:260)){
            identifySilhouette();
            lastAnalysis=now;
          }
          if(playing)phase=(phase+.65+strength()*.27)%8000;
          render();
        }
        lastTime=now;
      }
      requestAnimationFrame(tick);
    }
    if(typeof IntersectionObserver==='function'){
      const obs=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);});
      obs.observe(section);
    }
    function canvasCoords(event){
      const rect=canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return null;
      return {x:clamp((event.clientX-rect.left)*W/rect.width,0,W),
        y:clamp((event.clientY-rect.top)*H/rect.height,0,H)};
    }
    canvas.addEventListener('pointerdown',event=>{
      const p=canvasCoords(event);
      if(!p)return;
      if(!measuringTrunk)return;
      if(measuringTrunk){
        trunkPoints.push(p);
        if(trunkPoints.length===1){
          notify('Ombro marcado. Agora clique no trocânter maior (quadril) para medir o tronco.');
        }else{
          const angle=trunkInclination(trunkPoints[0],trunkPoints[1]);
          if(angle===null){
            trunkPoints.pop();
            notify('Pontos muito próximos. Marque o quadril um pouco mais distante do ombro.');
          }else{
            measuringTrunk=false;
            el('aero-trunk-value').textContent='Inclinação do tronco: '+
              angle.toFixed(1).replace('.',',')+'°';
            notify('Inclinação 2D registrada. É a linha ombro–quadril contra a horizontal, não um ângulo de quadril.');
          }
        }
        render();return;
      }
      pointerStart=p;dragging=true;
      try{canvas.setPointerCapture(event.pointerId);}catch(error){}
    });
    canvas.addEventListener('pointermove',event=>{
      if(!dragging||!pointerStart)return;
      const p=canvasCoords(event);
      if(!p)return;
      const rx=Math.abs(p.x-pointerStart.x)/2,ry=Math.abs(p.y-pointerStart.y)/2;
      if(rx<12||ry<12)return;
      ellipse={cx:(p.x+pointerStart.x)/2,cy:(p.y+pointerStart.y)/2,
        rx:clamp(rx,35,W*.48),ry:clamp(ry,28,H*.48)};
      render();
    });
    function finishDrag(){
      if(!dragging)return;
      dragging=false;pointerStart=null;
      notify('Área visual ajustada. As ondas agora desviam pela região marcada. Você pode arrastar novamente.');
      render();
    }
    canvas.addEventListener('pointerup',finishDrag);
    canvas.addEventListener('pointercancel',finishDrag);

    el('aero-trunk').addEventListener('click',()=>{
      if(mode==='demo'){
        notify('Abra uma foto lateral ou capture um quadro do vídeo para medir o tronco.');return;
      }
      if(mode==='video'||mode==='camera'){
        if(video.readyState<2||!video.videoWidth||!drawFitted(sc,video)){
          notify('Aguarde o vídeo carregar um quadro nítido antes da medição.');return;
        }
        stopVideo();
        mode='photo';
      }
      trunkPoints=[];measuringTrunk=true;dragging=false;pointerStart=null;
      el('aero-trunk-value').textContent='Ângulo do tronco: aguardando dois pontos';
      notify('Quadro congelado. Clique no ACRÔMIO/OMBRO e depois no TROCÂNTER MAIOR/QUADRIL, na vista lateral.');
      render();
    });

    el('aero-photo').addEventListener('change',event=>{
      const input=event.target,file=input.files?.[0];
      if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>25*1024*1024){
        notify('Escolha JPG, PNG ou WebP de até 25 MB.');input.value='';return;
      }
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>{setPhoto(image);URL.revokeObjectURL(url);input.value='';};
      image.onerror=()=>{URL.revokeObjectURL(url);input.value='';notify('Não foi possível abrir esta foto.');};
      image.src=url;
    });
    async function openWindVideo(file,label=file?.name){
      if(!(file instanceof Blob)||!file.size){
        notify('Escolha primeiro um vídeo válido para abrir no Túnel de Vento.');
        return false;
      }
      stopVideo();videoURL=URL.createObjectURL(file);
      imageEpoch++;aiFailed=false;detection=null;blankReference=null;
      manualContour=null;curveTool?.reset();
      el('aero-detection-status').textContent='Aguardando reconhecimento no vídeo.';
      video.src=videoURL;video.loop=true;mode='video';resetTrunk();
      el('aero-play').hidden=false;el('aero-stop-camera').hidden=true;
      section.scrollIntoView({behavior:'smooth',block:'start'});
      try{
        await video.play();el('aero-play').textContent='⏸ Pausar vídeo';
        notify('Vídeo '+String(label||'')+' carregado. O reconhecimento do atleta será tentado automaticamente.');
        return true;
      }catch(error){
        notify('O navegador não reproduziu este vídeo. Para Windows, tente MP4 H.264.');
        return false;
      }
    }
    el('aero-video-file').addEventListener('change',async event=>{
      const input=event.target,file=input.files?.[0];
      if(!file)return;
      await openWindVideo(file,file.name);
      input.value='';
    });
    globalThis.PAIVA_WIND_SIMPLE={openVideo:openWindVideo};
    el('aero-webcam').addEventListener('click',async()=>{
      if(!navigator.mediaDevices?.getUserMedia){
        notify('Webcam exige HTTPS e permissão do navegador.');return;
      }
      stopVideo();
      imageEpoch++;aiFailed=false;detection=null;blankReference=null;
      manualContour=null;curveTool?.reset();
      try{
        stream=await navigator.mediaDevices.getUserMedia({
          video:{width:{ideal:1280},height:{ideal:720}},audio:false});
        video.srcObject=stream;mode='camera';resetTrunk();await video.play();
        el('aero-stop-camera').hidden=false;el('aero-play').hidden=true;
        notify('Webcam ligada. Coloque fundo verde atrás do ciclista, ou use Parede comum com captura vazia.');
      }catch(error){
        stopVideo();mode='demo';
        notify('Não foi possível ligar a webcam: '+(error?.name||'acesso não permitido')+'.');
      }
    });
    el('aero-stop-camera').addEventListener('click',()=>{
      stopVideo();mode='demo';detection=null;resetTrunk();
      el('aero-detection-status').textContent='Webcam desligada.';
      notify('Webcam desligada.');render();
    });
    el('aero-capture').addEventListener('click',()=>{
      const sourceVideo=document.getElementById('paiva-2d-video');
      const sourceCanvas=document.getElementById('paiva-2d-canvas');
      if(sourceVideo&&!sourceVideo.hidden&&sourceVideo.readyState>=2&&sourceVideo.videoWidth){
        setPhoto(sourceVideo);
      }else if(globalThis.PAIVA_ATHLETE_2D?.hasImage?.()&&sourceCanvas){
        setPhoto(sourceCanvas);
      }else notify('Primeiro abra uma foto ou vídeo no módulo 2D, ou escolha Abrir foto aqui.');
    });
    el('aero-background').addEventListener('change',()=>{
      imageEpoch++;aiFailed=false;detection=null;
      el('aero-ai-retry').hidden=true;
      const wall=backgroundMode()==='wall';
      el('aero-empty-capture').hidden=!wall;
      el('aero-empty-file-wrap').hidden=!wall;
      if(mode!=='demo')identifySilhouette();
      notify(wall?
        'Parede comum: capture primeiro o fundo VAZIO. Não mova a câmera, a iluminação nem os objetos depois.':
        backgroundMode()==='green'?
        'Fundo verde selecionado. O contorno será separado pela cor do fundo.':
        backgroundMode()==='contrast'?
        'Contraste experimental antigo. Confira com cuidado: sombras e objetos podem ser confundidos com atleta.':
        'IA selecionada: o modelo reconhecerá pessoa e bicicleta automaticamente. A primeira análise exige internet.');
      render();
    });
    el('aero-ai-retry').addEventListener('click',()=>{
      aiFailed=false;imageEpoch++;
      el('aero-ai-retry').hidden=true;
      identifySilhouette();
      notify('Nova tentativa de reconhecimento por IA iniciada.');
    });
    el('aero-threshold').addEventListener('change',()=>{
      identifySilhouette();
      notify(detection?'Separação ajustada. Confira a silhueta azulada.':
        'O contraste ainda não permitiu reconhecer o ciclista. Ajuste o fundo ou a sensibilidade.');
      render();
    });
    el('aero-empty-capture').addEventListener('click',()=>{
      const pixels=currentPixels();
      if(!pixels){notify('Ligue a câmera ou abra o vídeo da parede VAZIA antes de memorizar.');return;}
      blankReference=pixels;
      detection=null;
      el('aero-detection-status').textContent='Fundo vazio memorizado. Coloque o ciclista sem mexer na câmera.';
      notify('Parede vazia registrada. Agora entre com o ciclista na mesma cena; o recorte se atualiza sozinho.');
    });
    el('aero-empty-file').addEventListener('change',event=>{
      const input=event.target,file=input.files?.[0];
      if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>25*1024*1024){
        notify('Use JPG, PNG ou WebP de até 25 MB para o fundo vazio.');input.value='';return;
      }
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>{
        drawFitted(detectBaseCtx,image);
        detectMiniCtx.clearRect(0,0,320,180);
        detectMiniCtx.drawImage(detectBase,0,0,320,180);
        blankReference=detectMiniCtx.getImageData(0,0,320,180);
        identifySilhouette();
        notify('Foto da parede VAZIA carregada. O ciclista será separado por diferença visual, com câmera fixa.');
        URL.revokeObjectURL(url);input.value='';render();
      };
      image.onerror=()=>{
        URL.revokeObjectURL(url);input.value='';
        notify('Não foi possível abrir a foto do fundo vazio.');
      };
      image.src=url;
    });
    el('aero-wind').addEventListener('click',()=>{
      playing=!playing;
      el('aero-wind').textContent=playing?'⏸ Pausar vento':'▶ Soltar vento';
      notify(playing?'Onda de vento ativada.':'Onda pausada para observar a imagem.');
      render();
    });
    el('aero-direction').addEventListener('click',()=>{
      direction*=-1;
      el('aero-direction').textContent=direction===1?
        '→ Vento para a direita':'← Vento para a esquerda';
      render();
    });
    el('aero-strength').addEventListener('input',render);
    el('aero-proximity').addEventListener('input',render);
    el('aero-wave-palette').addEventListener('change',render);
    el('aero-play').addEventListener('click',async()=>{
      if(mode!=='video')return;
      if(video.paused){
        try{await video.play();el('aero-play').textContent='⏸ Pausar vídeo';}
        catch(error){notify('Não foi possível reproduzir este vídeo.');}
      }else{video.pause();el('aero-play').textContent='▶ Reproduzir vídeo';}
    });
    el('aero-save').addEventListener('click',()=>{
      render();
      const saved=document.createElement('canvas');
      saved.width=W;saved.height=H;
      const savedCtx=saved.getContext('2d');
      if(!savedCtx){notify('Não foi possível salvar a imagem.');return;}
      savedCtx.drawImage(canvas,0,0);
      if(curveTool?.canvas)savedCtx.drawImage(curveTool.canvas,0,0,W,H);
      saved.toBlob(blob=>{
        if(!blob){notify('Não foi possível salvar a imagem.');return;}
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='PAIVA_AERO_Onda_Visual.png';
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        notify('Imagem com a onda de vento salva em PNG.');
      },'image/png');
    });
    window.addEventListener('pagehide',stopVideo,{once:true});
    render();requestAnimationFrame(tick);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
