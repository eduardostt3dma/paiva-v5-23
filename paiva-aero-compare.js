/* PAIVA AERO COMPARE — comparação de silhuetas em fotos frontais.
   É geometria projetada 2D, NÃO túnel físico, CdA nem potência. */
(() => {
  'use strict';
  const W=960,H=540,MW=320,MH=180;
  const MAX_PHOTO=25*1024*1024;
  function differencePercent(a,b){
    return Number.isFinite(a)&&a>0&&Number.isFinite(b)?(b-a)*100/a:null;
  }
  function resultLabel(delta){
    if(delta===null)return 'Aguardando duas silhuetas comparáveis.';
    if(Math.abs(delta)<.05)return 'As duas posições ocupam área semelhante na imagem.';
    return 'Posição B ocupa '+Math.abs(delta).toFixed(1).replace('.',',')+
      '% '+(delta<0?'MENOS':'MAIS')+' área projetada que A.';
  }
  globalThis.PAIVA_AERO_COMPARE_MATH={differencePercent,resultLabel};
  if(typeof document==='undefined')return;

  function panel(id,title){
    return [
      '<div class="paiva-compare-card" data-position="'+id+'">',
      '<div class="paiva-compare-card-heading"><strong>POSIÇÃO '+id.toUpperCase()+
        '</strong><span>'+title+'</span></div>',
      '<div class="paiva-compare-card-actions">',
      '<label class="paiva-compare-photo">↑ Abrir foto<input type="file" accept="image/png,image/jpeg,image/webp" id="paiva-compare-'+id+'-file"></label>',
      '<button type="button" id="paiva-compare-'+id+'-frame">▣ Quadro do 2D</button>',
      '<div class="paiva-compare-curve-toolbar" id="paiva-compare-'+id+'-tools"></div>',
      '</div>',
      '<div class="paiva-compare-stage"><canvas id="paiva-compare-'+id+
        '-canvas" width="960" height="540" aria-label="Imagem '+id+' e seu contorno projetado"></canvas></div>',
      '<p class="paiva-compare-card-status" id="paiva-compare-'+id+'-status" role="status">'+
        'Abra uma foto frontal.</p>',
      '</div>'
    ].join('');
  }
  function init(){
    const athlete=document.getElementById('paiva-athlete-2d');
    if(!athlete||document.getElementById('paiva-aero-compare'))return;
    const section=document.createElement('section');
    section.className='card paiva-aero-compare';
    section.id='paiva-aero-compare';
    section.innerHTML=[
      '<div class="paiva-compare-heading">',
      '<div><span>PAIVA LAB · ANÁLISE FRONTAL</span><h2>AERO COMPARE</h2>',
      '<p>Sobreposição de postura em vulto (lateral) e área projetada (frontal) com reconhecimento automático.</p></div>',
      '<div class="paiva-compare-top-actions">',
      '<button type="button" id="paiva-compare-fullscreen">⛶ Tela cheia · Projetor</button>',
      '<button type="button" id="paiva-compare-save">↓ Salvar comparação</button>',
      '</div></div>',
      '<div class="paiva-compare-view-selector">',
      '<label>Tipo de comparação <select id="paiva-compare-view"><option value="frontal">Frontal · Área projetada</option><option value="lateral">Lateral · Vulto de postura</option></select></label>',
      '<span id="paiva-compare-view-note">Na vista frontal, compare a área ocupada no mesmo enquadramento.</span>',
      '</div>',
      '<div class="paiva-compare-grid">',
      panel('a','ANTES'),panel('b','DEPOIS'),
      '</div>',
      '<div class="paiva-compare-check">',
      '<label><input type="checkbox" id="paiva-compare-same-setup"> Confirmo que as duas imagens usam a mesma câmera, distância, zoom, ângulo e enquadramento.</label>',
      '</div>',
      '<div class="paiva-compare-metrics" aria-live="polite">',
      '<div><span>VARIAÇÃO DA ÁREA PROJETADA EM 2D</span>',
      '<output id="paiva-compare-delta">—</output>',
      '<strong id="paiva-compare-explain">Carregue A e B e confirme o enquadramento.</strong>',
      '</div><div class="paiva-compare-mini-metrics">',
      '<span id="paiva-compare-amount-a">A · aguardando imagem</span>',
      '<span id="paiva-compare-amount-b">B · aguardando imagem</span>',
      '</div></div>',
      '<details class="paiva-compare-overlay"><summary>◎ Sobrepor contornos A × B</summary>',
      '<p><b class="paiva-compare-blue">Azul = A</b> · <b class="paiva-compare-yellow">Amarelo = B</b> · branco = área comum</p>',
      '<canvas id="paiva-compare-overlay" width="960" height="540" aria-label="Áreas frontais sobrepostas"></canvas>',
      '</details>',
      '<section class="paiva-ghost" id="paiva-ghost">',
      '<div class="paiva-ghost-heading"><div><span>PAIVA LAB · ANTES × DEPOIS</span>',
      '<h3>VULTO DE POSTURA</h3><p>Posição A translúcida sobre B. Veja com clareza o que mudou no corpo.</p></div>',
      '<div><button type="button" id="paiva-compare-ghost-fullscreen">⛶ Projetor</button>',
      '<button type="button" id="paiva-compare-ghost-save">↓ Salvar vulto</button></div></div>',
      '<div class="paiva-ghost-stage"><canvas id="paiva-compare-ghost-canvas" width="960" height="540" aria-label="Foto B com vulto translúcido da posição A"></canvas></div>',
      '<div class="paiva-ghost-controls">',
      '<label>Transparência do vulto <input id="paiva-compare-ghost-opacity" type="range" min="15" max="80" value="42" step="1"><output id="paiva-compare-ghost-opacity-value">42%</output></label>',
      '<label><input id="paiva-compare-ghost-edges" type="checkbox" checked> Contornos A/B</label>',
      '<button type="button" id="paiva-compare-ghost-play">▶ Alternar posições</button>',
      '</div>',
      '<p class="paiva-ghost-status" id="paiva-compare-ghost-status" role="status">Abra A e B para comparar a postura.</p>',
      '</section>',
      '<p class="paiva-compare-notice" id="paiva-compare-notice" role="status">Recorte automático por IA (pessoa + bicicleta). O modelo é baixado uma vez e processa as fotos neste dispositivo. Desenho manual continua opcional.</p>',
      '<p class="paiva-compare-disclaimer">A área em percentual só vale para fotos FRONTAIS padronizadas. O VULTO LATERAL mostra mudanças visuais de postura, sem medir arrasto ou ganhos aerodinâmicos. Distância, zoom, ângulo, posição da bicicleta e qualidade do recorte alteram a comparação. Fotos permanecem neste aparelho.</p>'
    ].join('');
    (document.getElementById('paiva-wind-simple')||athlete).after(section);
    const titleActions=athlete.querySelector('.paiva-2d-title-actions');
    if(titleActions&&!document.getElementById('paiva-compare-open')){
      const shortcut=document.createElement('button');
      shortcut.id='paiva-compare-open';shortcut.type='button';
      shortcut.textContent='▥ A/B · Postura';
      shortcut.title='Comparar posturas lateralmente (vulto) ou área frontal projetada';
      shortcut.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      titleActions.append(shortcut);
    }
    const $=id=>document.getElementById('paiva-compare-'+id);
    const notice=text=>$('notice').textContent=text;
    const ghostCanvas=$('ghost-canvas'),ghostCtx=ghostCanvas.getContext('2d');
    const ghostCutout=document.createElement('canvas');
    ghostCutout.width=W;ghostCutout.height=H;
    const ghostCutoutCtx=ghostCutout.getContext('2d');
    const ghostSmall=document.createElement('canvas');
    ghostSmall.width=MW;ghostSmall.height=MH;
    const ghostSmallCtx=ghostSmall.getContext('2d');
    let ghostPlaying=false,ghostAnimationAlpha=null,ghostLastFrame=0;
    const frameDocument=document.createElement('canvas');
    frameDocument.width=MW;frameDocument.height=MH;
    const miniCtx=frameDocument.getContext('2d',{willReadFrequently:true});
    const overlay=$('overlay'),overlayCtx=overlay.getContext('2d');
    const slots={};
    for(const id of ['a','b']){
      const canvas=$(id+'-canvas'),ctx=canvas.getContext('2d');
      const base=document.createElement('canvas');
      base.width=W;base.height=H;
      const baseCtx=base.getContext('2d');
      const maskCanvas=document.createElement('canvas');
      maskCanvas.width=MW;maskCanvas.height=MH;
      const maskCtx=maskCanvas.getContext('2d');
      if(!ctx||!baseCtx||!maskCtx)continue;
      const mini=document.createElement('canvas');mini.width=MW;mini.height=MH;
      const miniCtx=mini.getContext('2d');
      const slot={id,canvas,ctx,base,baseCtx,maskCanvas,maskCtx,mini,miniCtx,
        imageLoaded:false,aspect:null,contour:null,source:'',tool:null,
        epoch:0,pendingAi:false,personMask:null};
      slots[id]=slot;
      slot.tool=globalThis.PAIVA_SPLINE?.attach({
        host:canvas.parentElement,target:canvas,toolbar:$(id+'-tools'),
        closeOnFinish:true,label:'Contorno da posição '+id.toUpperCase(),
        onChange:()=>{if(slot.imageLoaded)analyse(slot);}
      });
      canvas.addEventListener('dragstart',event=>event.preventDefault());
      drawSlot(slot);
      $(id+'-file').addEventListener('change',event=>{
        const input=event.target,file=input.files?.[0];
        if(!file)return;
        if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>MAX_PHOTO){
          $(id+'-status').textContent='Escolha JPG, PNG ou WebP até 25 MB.';
          input.value='';return;
        }
        const url=URL.createObjectURL(file),photo=new Image();
        photo.onload=()=>{
          setPhoto(slot,photo);URL.revokeObjectURL(url);input.value='';
        };
        photo.onerror=()=>{
          URL.revokeObjectURL(url);input.value='';
          $(id+'-status').textContent='Não consegui abrir esta foto.';
        };
        photo.src=url;
      });
      $(id+'-frame').addEventListener('click',()=>{
        const sourceVideo=document.getElementById('paiva-2d-video');
        const sourceCanvas=document.getElementById('paiva-2d-canvas');
        if(sourceVideo&&!sourceVideo.hidden&&sourceVideo.readyState>=2&&sourceVideo.videoWidth)
          setPhoto(slot,sourceVideo);
        else if(sourceCanvas&&globalThis.PAIVA_ATHLETE_2D?.hasImage?.())
          setPhoto(slot,sourceCanvas);
        else $(id+'-status').textContent='Abra um vídeo ou foto na Análise 2D primeiro.';
      });
    }
    function drawPlaceholder(ctx,label){
      ctx.fillStyle='#0c1720';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#9bb3c3';ctx.textAlign='center';
      ctx.font='600 26px system-ui';
      ctx.fillText('POSIÇÃO '+label.toUpperCase(),W/2,H/2-16);
      ctx.font='16px system-ui';
      ctx.fillText('Abra uma foto frontal para começar',W/2,H/2+16);
      ctx.textAlign='left';
    }
    function dimensions(source){
      return {width:source.videoWidth||source.naturalWidth||source.width,
        height:source.videoHeight||source.naturalHeight||source.height};
    }
    function setPhoto(slot,source){
      const size=dimensions(source);
      if(!(size.width>0&&size.height>0)){
        $(slot.id+'-status').textContent='Não foi possível obter o quadro da foto/vídeo.';
        return;
      }
      slot.epoch++;
      slot.imageLoaded=false;slot.contour=null;slot.source='';
      slot.personMask=null;
      slot.pendingAi=false;slot.tool?.reset();
      slot.aspect=size.width/size.height;
      slot.baseCtx.fillStyle='#111a22';slot.baseCtx.fillRect(0,0,W,H);
      const scale=Math.min(W/size.width,H/size.height);
      const width=size.width*scale,height=size.height*scale;
      slot.roi={left:(W-width)/2/W,top:(H-height)/2/H,
        right:(W+width)/2/W,bottom:(H+height)/2/H};
      slot.baseCtx.drawImage(source,(W-width)/2,(H-height)/2,width,height);
      slot.miniCtx.clearRect(0,0,MW,MH);
      slot.miniCtx.drawImage(slot.base,0,0,MW,MH);
      slot.imageLoaded=true;
      analyse(slot);
    }
    function manualMask(slot){
      const raw=slot.tool?.getMask(MW,MH);
      if(!raw)return null;
      return globalThis.PAIVA_AERO_CONTOUR?.contourFromSegmentation(raw)||null;
    }
    function analyse(slot){
      if(!slot.imageLoaded)return;
      try{
        const manual=manualMask(slot);
        if(!manual&&slot.source==='auto'&&slot.contour){
          // Enquanto a pessoa ainda desenha a curva, o automático anterior
          // continua visível sem recalcular pixels a cada movimento.
          drawSlot(slot);refreshCompare();return;
        }
        if(manual){
          slot.epoch++;
          slot.pendingAi=false;
          slot.personMask=null;
          slot.contour=manual;slot.source='manual';
          $(slot.id+'-status').textContent='✓ Recorte flexível manual fechado.';
          drawSlot(slot);refreshCompare();return;
        }
        if(slot.pendingAi)return;
        const ai=globalThis.PAIVA_WIND_AI;
        if(!ai)throw Error('Modelo de IA ainda não carregou. Atualize o app.');
        // Token impede que a resposta atrasada de A/B sobrescreva nova foto.
        const epoch=++slot.epoch;
        slot.pendingAi=true;
        slot.contour=null;slot.source='';
        $(slot.id+'-status').textContent='⏳ Reconhecendo ciclista e bicicleta com IA…';
        ai.segment(slot.mini).then(seg=>{
          if(slot.epoch!==epoch||!slot.imageLoaded||manualMask(slot))return;
          const contour=globalThis.PAIVA_AERO_CONTOUR?.contourFromSegmentation(seg);
          if(!contour)throw Error('IA não encontrou contorno válido.');
          slot.contour=contour;slot.source='auto';
          slot.personMask=seg.personMask||null;
          $(slot.id+'-status').textContent=seg.bicyclePixels>0?
            '✓ IA: ciclista e bicicleta identificados.':
            '✓ IA: ciclista identificado; bicicleta pouco visível.';
          drawSlot(slot);refreshCompare();
        }).catch(error=>{
          if(slot.epoch!==epoch)return;
          slot.contour=null;slot.source='';slot.personMask=null;
          $(slot.id+'-status').textContent='IA não reconheceu: '+String(error.message||error)+
            ' · Tente uma foto frontal nítida ou recorte flexível.';
          drawSlot(slot);refreshCompare();
        }).finally(()=>{
          if(slot.epoch===epoch)slot.pendingAi=false;
        });
      }catch(error){
        slot.contour=null;
        slot.personMask=null;
        $(slot.id+'-status').textContent=String(error?.message||'Contorno indisponível')+
          ' Abra nova foto ou use ✎ Recorte flexível.';
      }
      drawSlot(slot);
      refreshCompare();
    }
    function drawMask(slot,color){
      if(!slot.contour)return;
      const g=slot.maskCtx,image=g.createImageData(MW,MH),mask=slot.contour.mask;
      for(let i=0;i<mask.length;i++){
        if(!mask[i])continue;
        const p=i*4;
        image.data[p]=color[0];image.data[p+1]=color[1];
        image.data[p+2]=color[2];image.data[p+3]=70;
      }
      g.putImageData(image,0,0);
      slot.ctx.drawImage(slot.maskCanvas,0,0,W,H);
    }
    function drawSlot(slot){
      slot.ctx.clearRect(0,0,W,H);
      if(slot.imageLoaded)slot.ctx.drawImage(slot.base,0,0);
      else drawPlaceholder(slot.ctx,slot.id);
      if(slot.contour)drawMask(slot,slot.id==='a'?[78,209,239]:[255,217,109]);
      slot.ctx.fillStyle='rgba(8,18,25,.80)';
      slot.ctx.fillRect(12,12,167,39);
      slot.ctx.fillStyle=slot.id==='a'?'#67d5e8':'#f7d66b';
      slot.ctx.font='bold 20px system-ui';
      slot.ctx.fillText('POSIÇÃO '+slot.id.toUpperCase(),22,38);
    }
    function maskCoverage(slot){
      return slot?.contour?.pixels||0;
    }
    function refreshCompare(){
      const a=slots.a,b=slots.b;
      if(!a||!b)return;
      const lateral=$('view').value==='lateral';
      section.dataset.view=lateral?'lateral':'frontal';
      $('view-note').textContent=lateral?
        'Vista lateral: examine a mudança de cabeça, tronco e braços no vulto; sem percentual de área frontal.':
        'Vista frontal: compare a área ocupada, com enquadramento idêntico.';
      const ca=maskCoverage(a),cb=maskCoverage(b);
      $('amount-a').textContent=ca?'A · '+(ca*100/(MW*MH)).toFixed(2).replace('.',',')+
        '% da imagem':'A · contorno pendente';
      $('amount-b').textContent=cb?'B · '+(cb*100/(MW*MH)).toFixed(2).replace('.',',')+
        '% da imagem':'B · contorno pendente';
      const similar=a.aspect&&b.aspect&&Math.abs(a.aspect-b.aspect)<.025;
      const confirmed=$('same-setup').checked;
      const ready=ca&&cb&&similar&&confirmed;
      const delta=ready&&!lateral?differencePercent(ca,cb):null;
      $('delta').textContent=delta===null?'—':
        (delta>0?'+':'')+delta.toFixed(1).replace('.',',')+'%';
      $('delta').dataset.result=delta===null?'none':delta<0?'lower':'higher';
      $('explain').textContent=delta!==null?resultLabel(delta):
        !a.imageLoaded||!b.imageLoaded?'Carregue as fotografias A e B.':
        !ca||!cb?'Confira ou desenhe os dois contornos.':
        !similar?'Fotos com proporções diferentes. Use o mesmo enquadramento.':
        'Confirme que câmera, distância, zoom e enquadramento são os mesmos.';
      drawOverlay(a,b);
      renderGhost();
      return delta;
    }
    function drawOverlay(a,b){
      if(!overlayCtx)return;
      overlayCtx.fillStyle='#0a131c';overlayCtx.fillRect(0,0,W,H);
      if(!a.contour&&!b.contour)return;
      const merged=document.createElement('canvas');
      merged.width=MW;merged.height=MH;
      const g=merged.getContext('2d');
      const im=g.createImageData(MW,MH);
      const mA=a.contour?.mask,mB=b.contour?.mask;
      for(let i=0;i<MW*MH;i++){
        const aa=!!mA?.[i],bb=!!mB?.[i];
        if(!aa&&!bb)continue;
        const p=i*4;
        const c=aa&&bb?[239,244,250]:aa?[75,214,244]:[255,207,85];
        im.data[p]=c[0];im.data[p+1]=c[1];im.data[p+2]=c[2];
        im.data[p+3]=aa&&bb?210:172;
      }
      g.putImageData(im,0,0);
      overlayCtx.drawImage(merged,0,0,W,H);
    }
    function ghostMask(slot){
      // Na segmentação semântica, isolar SOMENTE a pessoa: a bicicleta fica
      // como referência fixa, igual à comparação translúcida do Kinovea.
      return slot.personMask||slot.contour?.mask||null;
    }
    function drawGhostEdge(mask,rgb){
      if(!ghostSmallCtx||!mask||mask.length!==MW*MH)return;
      const edge=ghostSmallCtx.createImageData(MW,MH);
      for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){
        const i=y*MW+x;
        if(!mask[i]||mask[i-1]&&mask[i+1]&&mask[i-MW]&&mask[i+MW])continue;
        const p=i*4;
        edge.data[p]=rgb[0];edge.data[p+1]=rgb[1];
        edge.data[p+2]=rgb[2];edge.data[p+3]=225;
      }
      ghostSmallCtx.putImageData(edge,0,0);
      ghostCtx.drawImage(ghostSmall,0,0,W,H);
    }
    function renderGhost(){
      if(!ghostCtx)return;
      const a=slots.a,b=slots.b;
      ghostCtx.clearRect(0,0,W,H);
      ghostCtx.fillStyle='#0b151d';ghostCtx.fillRect(0,0,W,H);
      if(!a?.imageLoaded||!b?.imageLoaded){
        ghostCtx.textAlign='center';ghostCtx.fillStyle='#b6cbd5';
        ghostCtx.font='500 19px system-ui';
        ghostCtx.fillText('ABRA AS POSIÇÕES A E B',W/2,H/2);
        ghostCtx.textAlign='left';
        $('ghost-status').textContent='Abra duas fotos do mesmo ciclista e bicicleta.';
        return;
      }
      ghostCtx.drawImage(b.base,0,0);
      const maskA=ghostMask(a),maskB=ghostMask(b);
      if(!maskA||!maskB||maskA.length!==MW*MH||maskB.length!==MW*MH){
        $('ghost-status').textContent='Aguardando o reconhecimento automático nas duas fotos.';
        return;
      }
      const compatible=Math.abs(a.aspect-b.aspect)<.025;
      if(!compatible){
        $('ghost-status').textContent='As proporções das fotos são diferentes. Use o mesmo enquadramento.';
        return;
      }
      if(ghostCutoutCtx&&ghostSmallCtx){
        ghostCutoutCtx.globalCompositeOperation='source-over';
        ghostCutoutCtx.clearRect(0,0,W,H);
        ghostCutoutCtx.drawImage(a.base,0,0);
        const image=ghostSmallCtx.createImageData(MW,MH);
        for(let i=0;i<maskA.length;i++)if(maskA[i]){
          const p=i*4;image.data[p]=255;image.data[p+1]=255;
          image.data[p+2]=255;image.data[p+3]=255;
        }
        ghostSmallCtx.putImageData(image,0,0);
        ghostCutoutCtx.globalCompositeOperation='destination-in';
        ghostCutoutCtx.drawImage(ghostSmall,0,0,W,H);
        ghostCutoutCtx.globalCompositeOperation='source-over';
        const opacity=ghostAnimationAlpha??(Number($('ghost-opacity').value)/100);
        ghostCtx.globalAlpha=opacity;
        ghostCtx.drawImage(ghostCutout,0,0);
        ghostCtx.globalAlpha=1;
      }
      if($('ghost-edges').checked){
        drawGhostEdge(maskA,[93,222,248]);
        drawGhostEdge(maskB,[255,219,102]);
      }
      ghostCtx.fillStyle='rgba(7,18,25,.69)';
      ghostCtx.fillRect(12,12,233,28);
      ghostCtx.font='600 13px system-ui';
      ghostCtx.fillStyle='#f3f7fa';
      ghostCtx.fillText('PAIVA · VULTO DE POSTURA',22,31);
      ghostCtx.font='600 10px system-ui';
      ghostCtx.textAlign='right';ghostCtx.fillStyle='#ffe285';
      ghostCtx.fillText('DESENVOLVIDO POR EDUARDO PAIVA',W-16,H-12);
      ghostCtx.textAlign='left';
      $('ghost-status').textContent=$('same-setup').checked?
        'Azul: postura A anterior · Amarelo: B atual. Observe cabeça, tronco e braços.':
        'Prévia visual: confirme mesma câmera, distância, zoom e bicicleta fixa antes de interpretar.';
    }
    function switchGhost(){
      ghostPlaying=!ghostPlaying;
      $('ghost-play').textContent=ghostPlaying?
        '⏸ Pausar transição':'▶ Alternar posições';
      if(!ghostPlaying){ghostAnimationAlpha=null;renderGhost();return;}
      requestAnimationFrame(function frame(now){
        if(!ghostPlaying)return;
        if(now-ghostLastFrame>95){
          const base=Number($('ghost-opacity').value)/100;
          ghostAnimationAlpha=base*(.12+.88*(1+Math.sin(now*.0036))/2);
          renderGhost();ghostLastFrame=now;
        }
        requestAnimationFrame(frame);
      });
    }
    $('ghost-opacity').addEventListener('input',()=>{
      $('ghost-opacity-value').textContent=$('ghost-opacity').value+'%';
      if(!ghostPlaying)renderGhost();
    });
    $('ghost-edges').addEventListener('change',renderGhost);
    $('ghost-play').addEventListener('click',switchGhost);
    $('ghost-fullscreen').addEventListener('click',async()=>{
      const stage=document.getElementById('paiva-ghost');
      try{
        if(document.fullscreenElement===stage)await document.exitFullscreen();
        else if(stage.requestFullscreen)await stage.requestFullscreen();
        else notice('Para o projetor, use F11 no Windows.');
      }catch(error){notice('O navegador bloqueou a tela cheia. Tente F11.');}
    });
    $('ghost-save').addEventListener('click',()=>{
      if(!slots.a?.contour||!slots.b?.contour){
        notice('Abra A e B e aguarde o recorte antes de salvar o vulto.');return;
      }
      ghostCanvas.toBlob(blob=>{
        if(!blob){notice('Não foi possível salvar a imagem.');return;}
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='PAIVA_VULTO_POSTURA_AB.png';
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
      },'image/png');
    });
    $('view').addEventListener('change',()=>{
      if($('view').value!=='lateral'&&ghostPlaying)switchGhost();
      refreshCompare();
    });
    $('same-setup').addEventListener('change',refreshCompare);
    $('fullscreen').addEventListener('click',async()=>{
      if(document.fullscreenElement===section){
        try{await document.exitFullscreen();}catch(_){}
      }else if(typeof section.requestFullscreen==='function'){
        try{await section.requestFullscreen();}catch(error){
          notice('O navegador bloqueou tela cheia. No Windows, tente F11.');
        }
      }else notice('Para apresentar no projetor, use F11 no navegador do Windows.');
    });
    document.addEventListener('fullscreenchange',()=>{
      $('fullscreen').textContent=document.fullscreenElement===section?
        '↙ Sair da tela cheia':'⛶ Tela cheia · Projetor';
    });
    $('save').addEventListener('click',()=>{
      if($('view').value==='lateral'){
        $('ghost-save').click();return;
      }
      if(!slots.a.imageLoaded||!slots.b.imageLoaded){
        notice('Abra as duas imagens antes de salvar a comparação.');return;
      }
      const output=document.createElement('canvas');
      output.width=1920;output.height=1660;
      const ctx=output.getContext('2d');
      if(!ctx){notice('Seu navegador não conseguiu preparar o PNG.');return;}
      ctx.fillStyle='#101820';ctx.fillRect(0,0,1920,1660);
      ctx.fillStyle='#ffda54';ctx.font='bold 45px system-ui';
      ctx.fillText('PAIVA AERO · COMPARAÇÃO FRONTAL',72,75);
      ctx.fillStyle='#dae6ed';ctx.font='bold 28px system-ui';
      ctx.fillText('POSIÇÃO A',70,135);ctx.fillText('POSIÇÃO B',1000,135);
      for(const [slot,x] of [[slots.a,60],[slots.b,990]]){
        ctx.drawImage(slot.canvas,x,155,870,490);
        if(slot.tool?.canvas)ctx.drawImage(slot.tool.canvas,x,155,870,490);
      }
      ctx.fillStyle='#172632';ctx.fillRect(60,688,1800,174);
      ctx.fillStyle='#ffe071';ctx.font='bold 80px system-ui';
      ctx.fillText($('delta').textContent,93,794);
      ctx.fillStyle='#e6f0f5';ctx.font='bold 29px system-ui';
      ctx.fillText($('explain').textContent.slice(0,83),445,789,1315);
      if(slots.a.contour||slots.b.contour){
        ctx.fillStyle='#c2d7e1';ctx.font='22px system-ui';
        ctx.fillText('SOBREPOSIÇÃO  ·  AZUL A  /  AMARELO B  /  BRANCO EM COMUM',360,907);
        ctx.drawImage(overlay,400,924,1120,630);
      }
      ctx.fillStyle='#b7cbd5';ctx.font='23px system-ui';
      ctx.fillText('Área projetada na imagem · Não mede CdA, arrasto ou watts',72,1620);
      ctx.textAlign='right';ctx.fillStyle='#ffdf80';
      ctx.fillText('DESENVOLVIDO POR EDUARDO PAIVA',1850,1620);
      ctx.textAlign='left';
      output.toBlob(blob=>{
        if(!blob){notice('Falha ao gerar o PNG.');return;}
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='PAIVA_AERO_COMPARACAO_AB.png';
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        notice('Comparação A/B salva em PNG neste aparelho.');
      },'image/png');
    });
    refreshCompare();
    window.addEventListener('load',()=>{
      for(const slot of Object.values(slots))if(slot.imageLoaded&&!slot.contour)analyse(slot);
    },{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
