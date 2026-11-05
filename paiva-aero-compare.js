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
      '<p>IA reconhece ciclista e bicicleta nas duas posições. Compare a área frontal projetada no mesmo enquadramento.</p></div>',
      '<div class="paiva-compare-top-actions">',
      '<button type="button" id="paiva-compare-fullscreen">⛶ Tela cheia · Projetor</button>',
      '<button type="button" id="paiva-compare-save">↓ Salvar comparação</button>',
      '</div></div>',
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
      '<p class="paiva-compare-notice" id="paiva-compare-notice" role="status">Recorte automático por IA (pessoa + bicicleta). O modelo é baixado uma vez e processa as fotos neste dispositivo. Desenho manual continua opcional.</p>',
      '<p class="paiva-compare-disclaimer">É uma comparação de área projetada na FOTO, em percentual relativo. NÃO é medida física de CdA, watts, arrasto ou ganho de velocidade. A perspectiva, distância, roupa, posição da bicicleta e qualidade do recorte podem alterar o resultado. Fotos permanecem neste aparelho.</p>'
    ].join('');
    (document.getElementById('paiva-wind-simple')||athlete).after(section);
    const titleActions=athlete.querySelector('.paiva-2d-title-actions');
    if(titleActions&&!document.getElementById('paiva-compare-open')){
      const shortcut=document.createElement('button');
      shortcut.id='paiva-compare-open';shortcut.type='button';
      shortcut.textContent='▥ A/B frontal';
      shortcut.title='Abrir comparador de área frontal projetada';
      shortcut.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      titleActions.append(shortcut);
    }
    const $=id=>document.getElementById('paiva-compare-'+id);
    const notice=text=>$('notice').textContent=text;
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
        epoch:0,pendingAi:false};
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
          $(slot.id+'-status').textContent=seg.bicyclePixels>0?
            '✓ IA: ciclista e bicicleta identificados.':
            '✓ IA: ciclista identificado; bicicleta pouco visível.';
          drawSlot(slot);refreshCompare();
        }).catch(error=>{
          if(slot.epoch!==epoch)return;
          slot.contour=null;slot.source='';
          $(slot.id+'-status').textContent='IA não reconheceu: '+String(error.message||error)+
            ' · Tente uma foto frontal nítida ou recorte flexível.';
          drawSlot(slot);refreshCompare();
        }).finally(()=>{
          if(slot.epoch===epoch)slot.pendingAi=false;
        });
      }catch(error){
        slot.contour=null;
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
      const ca=maskCoverage(a),cb=maskCoverage(b);
      $('amount-a').textContent=ca?'A · '+(ca*100/(MW*MH)).toFixed(2).replace('.',',')+
        '% da imagem':'A · contorno pendente';
      $('amount-b').textContent=cb?'B · '+(cb*100/(MW*MH)).toFixed(2).replace('.',',')+
        '% da imagem':'B · contorno pendente';
      const similar=a.aspect&&b.aspect&&Math.abs(a.aspect-b.aspect)<.025;
      const confirmed=$('same-setup').checked;
      const ready=ca&&cb&&similar&&confirmed;
      const delta=ready?differencePercent(ca,cb):null;
      $('delta').textContent=delta===null?'—':
        (delta>0?'+':'')+delta.toFixed(1).replace('.',',')+'%';
      $('delta').dataset.result=delta===null?'none':delta<0?'lower':'higher';
      $('explain').textContent=delta!==null?resultLabel(delta):
        !a.imageLoaded||!b.imageLoaded?'Carregue as fotografias A e B.':
        !ca||!cb?'Confira ou desenhe os dois contornos.':
        !similar?'Fotos com proporções diferentes. Use o mesmo enquadramento.':
        'Confirme que câmera, distância, zoom e enquadramento são os mesmos.';
      drawOverlay(a,b);
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
