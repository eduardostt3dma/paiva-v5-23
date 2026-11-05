/* PAIVA MOTION FLOW V5.50 — trajetórias e ângulos, exclusivo do Aero.
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
  const TRAILS={
    knee:{label:'Joelho',color:'#55e8ff',maxJump:145},
    hip:{label:'Quadril',color:'#ffe17c',maxJump:65},
    shoulder:{label:'Ombro',color:'#c8b6ff',maxJump:65}
  };
  function pushTrail(trails,key,p,time){
    if(!Object.hasOwn(TRAILS,key)||!visible(p)||!Number.isFinite(time))return false;
    const list=trails[key],x=p.x*W,y=p.y*H;
    const previous=list[list.length-1];
    if(previous&&(time-previous.t>1350||
      Math.hypot(x-previous.x,y-previous.y)>TRAILS[key].maxJump))list.length=0;
    list.push({x,y,t:time});
    while(list.length>1&&(time-list[0].t>4200||list.length>20))list.shift();
    return true;
  }
  // Núcleo puro disponível para testes automatizados, sem abrir navegador.
  globalThis.PAIVA_AERO_POSE_MATH={angle3,trunkAngle,chooseSide,measure,confidence,pushTrail};
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
      <summary><span>✧ PAIVA MOTION FLOW</span><span class="pose-experimental">IA · TESTE</span></summary>
      <div class="pose-interior">
        <p class="pose-intro">Rastros fluidos acompanham joelho, quadril e ombro durante a pedalada. Os traços representam movimentos detectados na imagem original — não vento nem aerodinâmica.</p>
        <div class="pose-actions">
          <button type="button" id="pose-toggle">▶ Iniciar leitura IA</button>
          <label class="pose-trail-toggle"><input type="checkbox" id="pose-trails" checked> ≈ Mostrar rastros</label>
          <button type="button" id="pose-reset">↺ Reiniciar rastros</button>
          <button type="button" id="pose-export">↓ Salvar análise</button>
        </div>
        <p class="pose-status" id="pose-status" role="status" aria-live="polite">Abra uma foto ou vídeo no Aero e clique em Iniciar. Primeiro acesso exige internet.</p>
        <div class="pose-canvas-wrap"><canvas id="pose-view" width="960" height="540" aria-label="Rastros de movimento do ciclista e ângulos aproximados identificados por IA"></canvas></div>
        <p class="pose-legend"><span><i style="background:#55e8ff"></i>Joelho</span><span><i style="background:#ffe17c"></i>Quadril</span><span><i style="background:#c8b6ff"></i>Ombro</span></p>
        <div class="pose-stats" aria-live="polite">
          <div><span>Joelho · atual</span><strong id="pose-knee">—</strong></div>
          <div><span>Tronco · horizontal</span><strong id="pose-trunk">—</strong></div>
          <div><span>Cotovelo</span><strong id="pose-elbow">—</strong></div>
          <div><span>Quadril · 2D</span><strong id="pose-hip">—</strong></div>
          <div class="pose-extreme"><span>Extensão observada · maior ângulo de joelho</span><strong id="pose-extension">—</strong></div>
          <div class="pose-extreme"><span>Flexão observada · menor ângulo de joelho</span><strong id="pose-flexion">—</strong></div>
          <div class="pose-extreme"><span>Variação do tronco · nesta pedalada</span><strong id="pose-trunk-delta">—</strong></div>
        </div>
        <p class="pose-hint" id="pose-hint">Use vídeo de perfil e câmera fixa. Os rastros são trajetórias dos pontos detectados; pequenas oscilações também podem vir de erros da IA. Se uma articulação estiver oculta, não inventamos graus.</p>
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
    let trunkSamples=0,minTrunk=Infinity,maxTrunk=-Infinity;
    const trails={knee:[],hip:[],shoulder:[]};
    let results=null,lastSource=null;
    const fmt=x=>x===null||!Number.isFinite(x)?'—':x.toFixed(1).replace('.',',')+'°';
    const setText=(id,v)=>{el(id).textContent=v;};
    const status=message=>setText('pose-status',message);
    function reset(){
      samples=0;minKnee=Infinity;maxKnee=-Infinity;
      trunkSamples=0;minTrunk=Infinity;maxTrunk=-Infinity;
      Object.values(trails).forEach(list=>{list.length=0;});
      results=null;lastVideoTime=null;side=null;
      ['knee','trunk','elbow','hip','extension','flexion','trunk-delta'].forEach(k=>setText('pose-'+k,'—'));
    }
    function drawTrails(){
      if(!el('pose-trails').checked)return;
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
      for(const [key,opts] of Object.entries(TRAILS)){
        const points=trails[key];
        if(points.length<2)continue;
        ctx.strokeStyle=opts.color;
        ctx.shadowColor=opts.color;ctx.shadowBlur=8;ctx.lineWidth=2.6;
        for(let i=1;i<points.length;i++){
          const previous=points[i-1],current=points[i];
          ctx.globalAlpha=.13+.78*(i/points.length);
          ctx.beginPath();
          if(i===1)ctx.moveTo(previous.x,previous.y);
          else{
            const before=points[i-2];
            ctx.moveTo((before.x+previous.x)*.5,(before.y+previous.y)*.5);
          }
          if(i===points.length-1){
            ctx.quadraticCurveTo(previous.x,previous.y,current.x,current.y);
          }else{
            ctx.quadraticCurveTo(previous.x,previous.y,
              (previous.x+current.x)*.5,(previous.y+current.y)*.5);
          }
          ctx.stroke();
        }
        const newest=points[points.length-1];
        ctx.globalAlpha=1;ctx.shadowBlur=12;ctx.fillStyle=opts.color;
        ctx.beginPath();ctx.arc(newest.x,newest.y,4.2,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
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
      drawTrails();
      if(results)drawSkeleton(results);
      ctx.fillStyle='rgba(9,16,23,.76)';ctx.fillRect(12,12,250,31);
      ctx.fillStyle='#ffe476';ctx.font='600 14px system-ui';
      ctx.fillText('PAIVA MOTION FLOW · LEITURA 2D',22,33);
      ctx.fillStyle='rgba(10,18,26,.8)';ctx.fillRect(12,H-32,W-24,24);
      ctx.fillStyle='#c8d3dc';ctx.font='12px system-ui';
      ctx.fillText('RASTROS DE PONTOS RECONHECIDOS · LEITURA EXPERIMENTAL',20,H-15);
    }
    function publish(data,source){
      ['knee','trunk','elbow','hip'].forEach(k=>setText('pose-'+k,fmt(data?.[k]??null)));
      if(source?.mode==='photo'){
        setText('pose-extension','—');setText('pose-flexion','—');setText('pose-trunk-delta','—');
        el('pose-hint').textContent='Foto: somente os ângulos visíveis neste instante. Para extensão e flexão observadas, abra um vídeo lateral da pedalada.';
      }else{
        if(data?.knee!==null&&data?.knee!==undefined){
          minKnee=Math.min(minKnee,data.knee);maxKnee=Math.max(maxKnee,data.knee);
          samples++;
        }
        setText('pose-extension',samples>=5?fmt(maxKnee):'—');
        setText('pose-flexion',samples>=5?fmt(minKnee):'—');
        if(data?.trunk!==null&&data?.trunk!==undefined){
          minTrunk=Math.min(minTrunk,data.trunk);maxTrunk=Math.max(maxTrunk,data.trunk);
          trunkSamples++;
        }
        setText('pose-trunk-delta',trunkSamples>=5?fmt(maxTrunk-minTrunk):'—');
        el('pose-hint').textContent=samples<5?
          'Aguarde cinco quadros válidos. Rastros e extremos exigem pedalada em vídeo, com câmera fixa.':
          'Ângulos e rastros observados ('+samples+' quadros válidos). Oscilações podem incluir imprecisão do rastreador; não são metas de ajuste.';
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
          if(source.mode!=='photo'&&source.playing){
            for(const key of Object.keys(TRAILS)){
              pushTrail(trails,key,results.points[key],now);
            }
          }
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
      if(active&&now-lastSample>=360){lastSample=now;void sample(now);}
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
    el('pose-reset').addEventListener('click',()=>{reset();draw();status('Rastros e ângulos extremos reiniciados.');});
    el('pose-trails').addEventListener('change',()=>{draw();status(el('pose-trails').checked?
      'Rastros visíveis: acompanham pontos reais do movimento.':'Rastros ocultos. Ângulos continuam visíveis.');});
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
      c.fillText('Extensão '+el('pose-extension').textContent+'   Flexão '+el('pose-flexion').textContent+
        '   Variação do tronco '+el('pose-trunk-delta').textContent,20,H+63);
      c.fillStyle='#a9b8c5';c.font='12px system-ui';
      c.fillText('ESTIMATIVAS 2D EXPERIMENTAIS · NÃO RECOMENDAM AJUSTES · Eduardo Paiva',20,H+90);
      saved.toBlob(blob=>{
        if(!blob)return;
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='PAIVA_Motion_Flow_Experimental.png';
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
