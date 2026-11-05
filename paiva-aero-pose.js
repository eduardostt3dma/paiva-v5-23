/* PAIVA AERO V5.49 — leitura experimental das articulações, exclusiva do Aero.
   Estimativas de ângulos projetados em 2D; nunca ajuste biomecânico automático.
   Não altera ou reutiliza ferramentas, eventos ou medidas do módulo Análise 2D. */
(() => {
  'use strict';
  const W=960,H=540,MIN_VIS=.63;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const point=(p)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const confidence=p=>p?Math.min(p.visibility??1,p.presence??1):0;
  const visible=p=>point(p)&&confidence(p)>=MIN_VIS;
  function angle3(a,b,c,w=W,h=H){
    if(!point(a)||!point(b)||!point(c))return null;
    const ux=(a.x-b.x)*w,uy=(a.y-b.y)*h;
    const vx=(c.x-b.x)*w,vy=(c.y-b.y)*h;
    const len=Math.hypot(ux,uy)*Math.hypot(vx,vy);
    if(len<20)return null;
    return Math.acos(clamp((ux*vx+uy*vy)/len,-1,1))*180/Math.PI;
  }
  function trunkAngle(shoulder,hip,w=W,h=H){
    if(!point(shoulder)||!point(hip))return null;
    const dx=(shoulder.x-hip.x)*w,dy=(shoulder.y-hip.y)*h;
    return Math.hypot(dx,dy)<12?null:Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI;
  }
  const ANATOMY={
    left:{shoulder:11,elbow:13,wrist:15,hip:23,knee:25,ankle:27},
    right:{shoulder:12,elbow:14,wrist:16,hip:24,knee:26,ankle:28}
  };
  function chooseSide(points,previous){
    const score=name=>{
      const p=ANATOMY[name];
      return ['shoulder','elbow','wrist','hip','knee','ankle']
        .reduce((sum,key)=>sum+confidence(points?.[p[key]]),0);
    };
    const left=score('left'),right=score('right');
    if(previous&&Math.abs(left-right)<.9)return previous;
    return left>=right?'left':'right';
  }
  function measure(points,side){
    const indices=ANATOMY[side]||ANATOMY.left;
    const p=Object.fromEntries(Object.entries(indices).map(([key,i])=>[key,points?.[i]]));
    const value=(keys,compute)=>keys.every(key=>visible(p[key]))?compute():null;
    const reasonable=(v,min,max)=>v!==null&&v>=min&&v<=max?v:null;
    return {side,points:p,
      knee:reasonable(value(['hip','knee','ankle'],()=>angle3(p.hip,p.knee,p.ankle)),40,180),
      trunk:reasonable(value(['shoulder','hip'],()=>trunkAngle(p.shoulder,p.hip)),0,90),
      elbow:reasonable(value(['shoulder','elbow','wrist'],()=>angle3(p.shoulder,p.elbow,p.wrist)),15,180),
      hip:reasonable(value(['shoulder','hip','knee'],()=>angle3(p.shoulder,p.hip,p.knee)),15,180)};
  }
  // Núcleo puro disponível para testes automatizados, sem abrir navegador.
  globalThis.PAIVA_AERO_POSE_MATH={angle3,trunkAngle,chooseSide,measure,confidence};
  if(typeof document==='undefined')return;

  const PACKAGE='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs';
  const WASM='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
  const MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  let landmarker=null,loading=null;
  async function getModel(){
    if(landmarker)return landmarker;
    if(loading)return loading;
    loading=(async()=>{
      const {FilesetResolver,PoseLandmarker}=await import(PACKAGE);
      const files=await FilesetResolver.forVisionTasks(WASM);
      return PoseLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},
        runningMode:'VIDEO',numPoses:1,
        minPoseDetectionConfidence:.58,
        minPosePresenceConfidence:.58,
        minTrackingConfidence:.55
      });
    })();
    try{landmarker=await loading;return landmarker;}
    finally{loading=null;}
  }

  function mount(){
    const aero=document.getElementById('paiva-wind-simple');
    if(!aero||document.getElementById('paiva-aero-pose'))return false;
    const panel=document.createElement('details');
    panel.id='paiva-aero-pose';panel.className='paiva-aero-pose';
    panel.innerHTML=`
      <summary><span>✧ IA · LEITURA DE ÂNGULOS</span><span class="pose-experimental">EXPERIMENTAL</span></summary>
      <div class="pose-interior">
        <p class="pose-intro">O Aero identifica pontos do corpo sobre a imagem original e calcula ângulos visuais em 2D. Opcional, sem interferir nas ferramentas da Análise 2D.</p>
        <div class="pose-actions">
          <button type="button" id="pose-toggle">▶ Iniciar leitura IA</button>
          <button type="button" id="pose-reset">↺ Zerar extremos</button>
          <button type="button" id="pose-export">↓ Salvar análise</button>
        </div>
        <p class="pose-status" id="pose-status" role="status" aria-live="polite">Abra uma foto ou vídeo no Aero e clique em Iniciar. Primeiro acesso exige internet.</p>
        <div class="pose-canvas-wrap"><canvas id="pose-view" width="960" height="540" aria-label="Foto do ciclista com pontos e ângulos aproximados identificados por IA"></canvas></div>
        <div class="pose-stats" aria-live="polite">
          <div><span>Joelho · atual</span><strong id="pose-knee">—</strong></div>
          <div><span>Tronco · horizontal</span><strong id="pose-trunk">—</strong></div>
          <div><span>Cotovelo</span><strong id="pose-elbow">—</strong></div>
          <div><span>Quadril · 2D</span><strong id="pose-hip">—</strong></div>
          <div class="pose-extreme"><span>Extensão observada · maior ângulo de joelho</span><strong id="pose-extension">—</strong></div>
          <div class="pose-extreme"><span>Flexão observada · menor ângulo de joelho</span><strong id="pose-flexion">—</strong></div>
        </div>
        <p class="pose-hint" id="pose-hint">Vista lateral, câmera fixa e ciclo completo de pedalada. Extremos aparecem somente após leituras válidas de vídeo. Se um ponto estiver oculto, exibimos —.</p>
        <p class="pose-disclaimer">⚠️ Teste exploratório: graus projetados em 2D, dependentes de câmera e visibilidade. Pontos estimados por IA não equivalem aos centros anatômicos palpados do bike fit, nem determinam posição ideal. Fotos e quadros são processados neste dispositivo; o modelo e os arquivos de execução precisam ser baixados na primeira utilização.</p>
      </div>`;
    aero.querySelector('.aero-measure')?.before(panel);
    if(!panel.isConnected)aero.append(panel);
    const el=id=>panel.querySelector('#'+id);
    const canvas=el('pose-view'),ctx=canvas.getContext('2d');
    const raw=document.createElement('canvas');raw.width=W;raw.height=H;
    const rawCtx=raw.getContext('2d');
    if(!ctx||!rawCtx){el('pose-status').textContent='Canvas indisponível neste navegador.';return true;}
    let active=false,busy=false,lastSample=0,stopped=false;
    let currentEpoch=null,lastVideoTime=null,side=null;
    let samples=0,minKnee=Infinity,maxKnee=-Infinity;
    let latest=null,results=null,lastSource=null;
    const fmt=x=>x===null||!Number.isFinite(x)?'—':x.toFixed(1).replace('.',',')+'°';
    const setText=(id,v)=>{el(id).textContent=v;};
    const status=message=>setText('pose-status',message);
    function reset(){
      samples=0;minKnee=Infinity;maxKnee=-Infinity;
      latest=null;results=null;lastVideoTime=null;side=null;
      ['knee','trunk','elbow','hip','extension','flexion'].forEach(k=>setText('pose-'+k,'—'));
    }
    function drawLabel(x,y,text,color){
      if(!text||text==='—')return;
      ctx.save();ctx.font='700 18px "Segoe UI",system-ui,sans-serif';
      const left=clamp(x+12,8,W-90),top=clamp(y-22,12,H-34);
      ctx.fillStyle='rgba(7,15,21,.86)';ctx.fillRect(left-6,top-5,ctx.measureText(text).width+12,26);
      ctx.fillStyle=color;ctx.fillText(text,left,top+14);ctx.restore();
    }
    const coords=p=>[p.x*W,p.y*H];
    function drawSkeleton(data){
      if(!data)return;
      const p=data.points;
      const lines=[['shoulder','elbow'],['elbow','wrist'],['shoulder','hip'],['hip','knee'],['knee','ankle']];
      ctx.save();ctx.lineCap='round';
      for(const [a,b] of lines){
        if(!visible(p[a])||!visible(p[b]))continue;
        const [x1,y1]=coords(p[a]),[x2,y2]=coords(p[b]);
        ctx.strokeStyle='rgba(0,0,0,.87)';ctx.lineWidth=7;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.strokeStyle='#ffd85d';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      }
      for(const key of Object.keys(p)){
        if(!visible(p[key]))continue;
        const [x,y]=coords(p[key]);
        ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);
        ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#f2b722';ctx.stroke();
      }
      if(data.knee!==null&&visible(p.knee)){
        const [x,y]=coords(p.knee);drawLabel(x,y,fmt(data.knee),'#ffe578');
      }
      if(data.trunk!==null&&visible(p.hip)){
        const [x,y]=coords(p.hip);drawLabel(x,y,fmt(data.trunk),'#66e9ff');
      }
      if(data.elbow!==null&&visible(p.elbow)){
        const [x,y]=coords(p.elbow);drawLabel(x,y,fmt(data.elbow),'#d4ffa5');
      }
      ctx.restore();
    }
    function draw(){
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#0b131b';ctx.fillRect(0,0,W,H);
      if(lastSource)ctx.drawImage(raw,0,0);
      else{
        ctx.textAlign='center';ctx.fillStyle='#aebac5';ctx.font='18px system-ui';
        ctx.fillText('Abra uma imagem ou vídeo no Aero para iniciar',W/2,H/2);
        ctx.textAlign='left';
      }
      if(results)drawSkeleton(results);
      ctx.fillStyle='rgba(9,16,23,.76)';ctx.fillRect(12,12,250,31);
      ctx.fillStyle='#ffe476';ctx.font='600 14px system-ui';
      ctx.fillText('PAIVA AERO · LEITURA 2D',22,33);
      ctx.fillStyle='rgba(10,18,26,.8)';ctx.fillRect(12,H-32,W-24,24);
      ctx.fillStyle='#c8d3dc';ctx.font='12px system-ui';
      ctx.fillText('ÂNGULOS ESTIMADOS POR IA · APENAS DEMONSTRATIVO',20,H-15);
    }
    function publish(data,source){
      ['knee','trunk','elbow','hip'].forEach(k=>setText('pose-'+k,fmt(data?.[k]??null)));
      if(source?.mode==='photo'){
        setText('pose-extension','—');setText('pose-flexion','—');
        el('pose-hint').textContent='Foto: somente os ângulos visíveis neste instante. Para extensão e flexão observadas, abra um vídeo lateral da pedalada.';
      }else{
        if(data?.knee!==null&&data?.knee!==undefined){
          minKnee=Math.min(minKnee,data.knee);maxKnee=Math.max(maxKnee,data.knee);
          samples++;
        }
        setText('pose-extension',samples>=5?fmt(maxKnee):'—');
        setText('pose-flexion',samples>=5?fmt(minKnee):'—');
        el('pose-hint').textContent=samples<5?
          'Aguarde ao menos cinco leituras válidas. Os extremos exigem uma pedalada completa e boa visibilidade.':
          'Extremos observados nesta sessão ('+samples+' quadros válidos); não são metas ou referências de ajuste.';
      }
    }
    async function sample(now){
      if(busy||!active||!panel.open||document.hidden)return;
      const aeroSource=globalThis.PAIVA_WIND_SIMPLE;
      if(!aeroSource?.getAnalysisFrame)return;
      const source=aeroSource.getAnalysisFrame(rawCtx);
      if(!source){
        if(!lastSource)status('Abra uma foto ou vídeo na área do Aero para iniciar a leitura.');
        return;
      }
      if(currentEpoch!==source.epoch){
        currentEpoch=source.epoch;reset();
      }
      if(source.mode==='photo'&&lastSource?.mode==='photo'&&lastSource.epoch===source.epoch)return;
      if(source.mode!=='photo'&&source.videoTime===lastVideoTime)return;
      lastSource=source;lastVideoTime=source.videoTime;
      busy=true;
      try{
        const model=await getModel();
        // detectForVideo é síncrono: a frequência baixa limita o custo no PC.
        const detection=model.detectForVideo(raw,Math.max(now,performance.now()));
        const landmarks=detection.landmarks?.[0];
        if(landmarks?.length>=29){
          const newSide=chooseSide(landmarks,side);
          if(side&&newSide!==side){reset();}
          side=newSide;
          results=measure(landmarks,side);
          publish(results,source);
          const valid=['knee','trunk','elbow','hip'].filter(k=>results[k]!==null);
          status(valid.length?'● '+valid.length+' leituras visíveis · lado '+(side==='left'?'esquerdo':'direito')+
            ' · pontos claros em amarelo.':'Articulações ocultas ou fora do enquadramento: sem estimativa confiável.');
        }else{
          results=null;publish(null,source);
          status('Não identifiquei uma pessoa com pontos suficientemente visíveis neste quadro.');
        }
        draw();
      }catch(error){
        active=false;
        el('pose-toggle').textContent='↻ Tentar novamente';
        status('IA indisponível: '+(error?.message||String(error))+'. Confira sua internet e tente outra vez.');
      }finally{busy=false;}
    }
    function schedule(now){
      if(stopped)return;
      if(active&&now-lastSample>=460){lastSample=now;void sample(now);}
      requestAnimationFrame(schedule);
    }
    el('pose-toggle').addEventListener('click',async()=>{
      if(active){active=false;el('pose-toggle').textContent='▶ Continuar leitura';status('Leitura pausada.');return;}
      if(!globalThis.PAIVA_WIND_SIMPLE?.getAnalysisFrame){status('Aguarde o Aero terminar de carregar.');return;}
      active=true;
      el('pose-toggle').textContent='⏸ Pausar leitura';
      status('⏳ Carregando modelo de articulações neste dispositivo…');
      try{await getModel();if(active){status('Modelo pronto. Buscando articulações no Aero…');lastSample=0;}}
      catch(error){active=false;el('pose-toggle').textContent='↻ Tentar novamente';status('Modelo de articulações não carregou: '+(error?.message||error));}
    });
    el('pose-reset').addEventListener('click',()=>{reset();draw();status('Histórico de extensão/flexão reiniciado.');});
    el('pose-export').addEventListener('click',()=>{
      if(!lastSource){status('Primeiro carregue uma imagem e inicie a leitura.');return;}
      const saved=document.createElement('canvas');saved.width=W;saved.height=H+108;
      const c=saved.getContext('2d');if(!c)return;
      c.fillStyle='#0a121b';c.fillRect(0,0,saved.width,saved.height);
      c.drawImage(canvas,0,0);
      c.fillStyle='#e9f0f5';c.font='bold 17px system-ui';
      c.fillText('Joelho '+el('pose-knee').textContent+'   Tronco '+el('pose-trunk').textContent+
        '   Cotovelo '+el('pose-elbow').textContent+'   Quadril '+el('pose-hip').textContent,20,H+32);
      c.font='15px system-ui';c.fillStyle='#ffe277';
      c.fillText('Extensão observada '+el('pose-extension').textContent+
        '   Flexão observada '+el('pose-flexion').textContent,20,H+63);
      c.fillStyle='#a9b8c5';c.font='12px system-ui';
      c.fillText('ESTIMATIVAS 2D EXPERIMENTAIS · NÃO RECOMENDAM AJUSTES · Eduardo Paiva',20,H+90);
      saved.toBlob(blob=>{
        if(!blob)return;
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='PAIVA_AERO_Angulos_IA_Experimental.png';
        document.body.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        status('Imagem demonstrativa salva. Use os graus somente como estimativas 2D.');
      },'image/png');
    });
    panel.addEventListener('toggle',()=>{
      if(!panel.open&&active){active=false;el('pose-toggle').textContent='▶ Continuar leitura';}
    });
    window.addEventListener('pagehide',()=>{stopped=true;active=false;},{once:true});
    draw();requestAnimationFrame(schedule);
    return true;
  }
  function whenReady(){
    if(mount())return;
    const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',whenReady,{once:true});
  else whenReady();
})();
