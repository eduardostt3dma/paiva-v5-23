/* PAIVA MOTION SIGNATURE V5.57 — motor 2D manual paralelo, IA preservada.
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
  function footAngle(heel,toe,w=W,h=H){
    if(!point(heel)||!point(toe))return null;
    const dx=(toe.x-heel.x)*w,dy=(toe.y-heel.y)*h;
    return Math.hypot(dx,dy)<12?null:Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI;
  }
  const ANATOMY={
    left:{shoulder:11,elbow:13,wrist:15,hip:23,knee:25,ankle:27,heel:29,toe:31},
    right:{shoulder:12,elbow:14,wrist:16,hip:24,knee:26,ankle:28,heel:30,toe:32}
  };
  const MARKER_GROUPS={
    all:['shoulder','elbow','wrist','hip','knee','ankle','heel','toe'],
    upper:['hip','shoulder','elbow','wrist'],
    leg:['hip','knee','ankle'],
    foot:['ankle','heel','toe'],
    free:['free']
  };
  function viewByGroup(data,group){
    if(!data||group==='all'||!MARKER_GROUPS[group])return data;
    const keys=new Set(MARKER_GROUPS[group]);
    const pts=Object.fromEntries(Object.entries(data.points||{}).map(([key,value])=>
      [key,keys.has(key)?value:null]));
    const has=(...names)=>names.every(key=>keys.has(key));
    return {...data,points:pts,
      knee:has('hip','knee','ankle')?data.knee:null,
      trunk:has('hip','shoulder')?data.trunk:null,
      elbow:has('shoulder','elbow','wrist')?data.elbow:null,
      hip:has('shoulder','hip','knee')?data.hip:null,
      foot:has('heel','toe')?data.foot:null};
  }
  const hueDistance=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
  function rgbHue(r,g,b){
    r/=255;g/=255;b/=255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
    let h=0;
    if(delta){
      if(max===r)h=60*((g-b)/delta%6);
      else if(max===g)h=60*((b-r)/delta+2);
      else h=60*((r-g)/delta+4);
    }
    return {h:(h+360)%360,s:max===0?0:delta/max,v:max};
  }
  function markerPixel(data,w,x,y){
    const i=(Math.round(y)*w+Math.round(x))*4;
    return rgbHue(data[i],data[i+1],data[i+2]);
  }
  // A amostra usa apenas pixels saturados, impedindo que a roupa escura
  // misturada à bolinha altere a cor de referência do marcador.
  function sampleColorMarker(image,w,h,at,radius=6){
    if(!image?.data||!point(at))return null;
    const bins=Array.from({length:12},()=>[]);
    for(let y=Math.max(0,Math.floor(at.y-radius));y<=Math.min(h-1,Math.ceil(at.y+radius));y++)
      for(let x=Math.max(0,Math.floor(at.x-radius));x<=Math.min(w-1,Math.ceil(at.x+radius));x++){
        if(Math.hypot(x-at.x,y-at.y)>radius)continue;
        const pixel=markerPixel(image.data,w,x,y);
        if(pixel.s<.32||pixel.v<.28)continue;
        bins[Math.floor(pixel.h/30)%12].push(pixel);
      }
    let best=0;
    bins.forEach((items,i)=>{if(items.length>bins[best].length)best=i;});
    if(bins[best].length<3)return null;
    const colors=[...bins[(best+11)%12],...bins[best],...bins[(best+1)%12]];
    const cx=colors.reduce((n,p)=>n+Math.cos(p.h*Math.PI/180),0);
    const cy=colors.reduce((n,p)=>n+Math.sin(p.h*Math.PI/180),0);
    return {h:(Math.atan2(cy,cx)*180/Math.PI+360)%360,
      s:colors.reduce((n,p)=>n+p.s,0)/colors.length};
  }
  // Segmentação local + pequenos componentes conexos. Somente o grupo de
  // cor próximo ao ponto anterior é aceito; não há teleporte para outro ponto.
  function followColorMarker(image,w,h,at,reference,search=25){
    if(!image?.data||!point(at)||!reference)return null;
    const x0=Math.max(0,Math.floor(at.x-search)),x1=Math.min(w-1,Math.ceil(at.x+search));
    const y0=Math.max(0,Math.floor(at.y-search)),y1=Math.min(h-1,Math.ceil(at.y+search));
    const iw=x1-x0+1,ih=y1-y0+1,mask=new Uint8Array(iw*ih);
    for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){
      if(Math.hypot(x+x0-at.x,y+y0-at.y)>search)continue;
      const p=markerPixel(image.data,w,x+x0,y+y0);
      if(p.s>.32&&p.v>.25&&hueDistance(p.h,reference.h)<27)
        mask[y*iw+x]=1;
    }
    let best=null,bestScore=Infinity;
    for(let seed=0;seed<mask.length;seed++){
      if(mask[seed]!==1)continue;
      const queue=[seed];mask[seed]=2;
      let n=0,sumX=0,sumY=0;
      for(let q=0;q<queue.length;q++){
        const j=queue[q],x=j%iw,y=Math.floor(j/iw);
        n++;sumX+=x+x0;sumY+=y+y0;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx,ny=y+dy;
          if(nx<0||nx>=iw||ny<0||ny>=ih)continue;
          const k=ny*iw+nx;
          if(mask[k]===1){mask[k]=2;queue.push(k);}
        }
      }
      if(n<3||n>420)continue;
      const x=sumX/n,y=sumY/n,dist=Math.hypot(x-at.x,y-at.y);
      const score=dist+5/Math.sqrt(n);
      if(dist<=search&&score<bestScore){best={x,y,confidence:Math.min(1,n/12)};bestScore=score;}
    }
    return best;
  }
  // Limites espaciais de deslocamento por quadro (em um vídeo normalizado
  // para 960x540). Cada ponto tem mobilidade diferente: quadril/ombro ficam
  // mais estáveis, enquanto joelho, tornozelo e pé se movimentam mais.
  const POINT_MOTION={shoulder:40,elbow:95,wrist:115,hip:42,knee:100,
    ankle:155,heel:155,toe:165};
  function stabilizeLandmarks(points,poseSide,time,mode,history,ghosts){
    const indices=ANATOMY[poseSide];if(!indices)return points;
    const output=points.slice();
    const setting={stable:{blend:.24,jump:1},balanced:{blend:.43,jump:1.22},
      responsive:{blend:.67,jump:1.55}}[mode]||{blend:.24,jump:1};
    for(const [joint,index] of Object.entries(indices)){
      const current=points[index],previous=history[joint];
      if(!visible(current)||current.x<0||current.x>1||current.y<0||current.y>1){
        if(previous&&time-previous.t<650)
          ghosts[joint]={x:previous.x,y:previous.y};
        else delete ghosts[joint];
        continue;
      }
      if(!previous||!Number.isFinite(time-previous.t)||time-previous.t>1050){
        history[joint]={x:current.x,y:current.y,t:time};
        delete ghosts[joint];continue;
      }
      const dt=Math.max(32,time-previous.t);
      const distance=Math.hypot((current.x-previous.x)*W,(current.y-previous.y)*H);
      const threshold=POINT_MOTION[joint]*(.48+dt/260)*setting.jump;
      if(distance>threshold){
        const candidate=previous.candidate;
        const nearby=candidate&&Math.hypot((current.x-candidate.x)*W,
          (current.y-candidate.y)*H)<38;
        previous.candidate={x:current.x,y:current.y};
        previous.candidateCount=nearby?(previous.candidateCount||1)+1:1;
        if(previous.candidateCount<3){
          // Sem inventar ângulo: conserva só um círculo vazado no último
          // local confiável; a medida deste quadro fica indisponível.
          ghosts[joint]={x:previous.x,y:previous.y};
          output[index]={...current,x:previous.x,y:previous.y,visibility:0,presence:0};
          continue;
        }
        // Mudança persistente, troca de câmera ou busca de nova referência:
        // volta a rastrear, sem prolongar a trajetória anterior.
        history[joint]={x:current.x,y:current.y,t:time,reacquired:true};
        delete ghosts[joint];continue;
      }
      const alpha=clamp(setting.blend+distance/Math.max(1,threshold)*.27,
        setting.blend,.86);
      const x=previous.x+(current.x-previous.x)*alpha;
      const y=previous.y+(current.y-previous.y)*alpha;
      history[joint]={x,y,t:time};
      output[index]={...current,x,y};
      delete ghosts[joint];
    }
    return output;
  }
  function chooseSide(points,previous){
    const score=name=>{
      const p=ANATOMY[name];
      return ['shoulder','elbow','wrist','hip','knee','ankle']
        .reduce((sum,key)=>sum+confidence(points?.[p[key]]),0);
    };
    const left=score('left'),right=score('right');
    // Mantém a perna já escolhida se a outra tiver vantagem pequena:
    // alternar lados a cada pedalada faz os pontos parecerem "fugir".
    if(previous&&Math.abs(left-right)<1.5)return previous;
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
      hip:reasonable(value(['shoulder','hip','knee'],()=>angle3(p.shoulder,p.hip,p.knee)),15,180),
      foot:reasonable(value(['heel','toe'],()=>footAngle(p.heel,p.toe)),0,90)};
  }
  const TRAILS={
    knee:{label:'Joelho',color:'#89dbea',maxJump:175},
    hip:{label:'Quadril',color:'#b8c9d4',maxJump:75},
    heel:{label:'Calcanhar',color:'#83e0c6',maxJump:245},
    shoulder:{label:'Ombro',color:'#b6b5cf',maxJump:75}
  };
  function pushTrail(trails,key,p,time){
    if(!Object.hasOwn(TRAILS,key)||!visible(p)||!Number.isFinite(time))return false;
    const list=trails[key],x=p.x*W,y=p.y*H;
    const previous=list[list.length-1];
    if(previous&&(time-previous.t>1350||
      Math.hypot(x-previous.x,y-previous.y)>TRAILS[key].maxJump))list.length=0;
    list.push({x,y,t:time});
    while(list.length>1&&(time-list[0].t>7000||list.length>60))list.shift();
    return true;
  }
  // Núcleo puro disponível para testes automatizados, sem abrir navegador.
  globalThis.PAIVA_AERO_POSE_MATH={angle3,trunkAngle,footAngle,chooseSide,measure,
    confidence,pushTrail,stabilizeLandmarks,sampleColorMarker,followColorMarker,MARKER_GROUPS,viewByGroup};
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
    panel.id='paiva-aero-pose';panel.className='paiva-aero-pose';panel.open=false;
    panel.innerHTML=`
      <summary><span>✧ PAIVA MOTION SIGNATURE</span><span class="pose-experimental">IA EXPERIMENTAL · GUARDADA</span></summary>
      <div class="pose-interior">
        <button type="button" id="pose-to-main-2d" class="pose-to-main-2d">↗ Abrir Análise 2D principal · vídeo + régua + rastreio de pontos</button>
        <p class="pose-main-guide">O teste manual agora está integrado à Análise Angular 2D principal, com a régua do vídeo à vista. As ferramentas experimentais deste painel permanecem aqui para consultas futuras.</p>
        <p class="pose-intro">Assinatura visual da pedalada: linhas finas registram trajetórias observadas de joelho, quadril, calcanhar e ombro. A leitura vem do vídeo, não de uma simulação de vento.</p>
        <div class="pose-mode-tabs" role="group" aria-label="Escolha a análise independente">
          <button type="button" id="pose-mode-2d" aria-pressed="true">◎ 2D manual anterior · teste</button>
          <button type="button" id="pose-mode-ai" aria-pressed="false">✧ IA CORPORAL · experimental</button>
        </div>
        <p class="pose-mode-hint" id="pose-mode-hint">2D MANUAL: use as ferramentas laterais para marcar pontos na foto ou no vídeo pausado. Para acompanhar pontos em vídeo, clique em Seguir meus pontos. Nenhuma detecção corporal automática será iniciada.</p>
        <div class="pose-actions">
          <button type="button" id="pose-toggle" hidden>▶ Iniciar leitura IA</button>
          <button type="button" id="pose-manual-toggle" aria-pressed="false">✥ Corrigir pontos</button>
          <label class="pose-trail-toggle" for="pose-stability">Estabilidade
            <select id="pose-stability" aria-label="Intensidade da estabilização dos pontos">
              <option value="stable" selected>Firme</option>
              <option value="balanced">Equilibrada</option>
              <option value="responsive">Movimento rápido</option>
            </select>
          </label>
          <label class="pose-trail-toggle" for="pose-side">Lado rastreado
            <select id="pose-side" aria-label="Selecionar a lateral do corpo rastreada">
              <option value="auto" selected>Auto · fixar por vídeo</option>
              <option value="left">Esquerdo</option><option value="right">Direito</option>
            </select>
          </label>
          <label class="pose-trail-toggle" for="pose-speed">Velocidade do vídeo
            <select id="pose-speed" aria-label="Velocidade da reprodução do vídeo no Motion Flow">
              <option value="0.1">0,1×</option><option value="0.25">0,25×</option>
              <option value="0.5">0,5×</option><option value="0.75">0,75×</option>
              <option value="1" selected>1×</option>
            </select>
          </label>
          <label class="pose-trail-toggle"><input type="checkbox" id="pose-trails" checked> Mostrar trajetórias</label>
          <button type="button" id="pose-reset">↺ Reiniciar rastros</button>
          <button type="button" id="pose-export">↓ Salvar análise</button>
        </div>
        <div class="pose-manual-controls" id="pose-manual-controls" hidden>
          <label for="pose-manual-joint">Articulação
            <select id="pose-manual-joint">
              <option value="knee">Joelho</option><option value="hip">Quadril</option>
              <option value="ankle">Tornozelo</option><option value="shoulder">Ombro</option>
              <option value="elbow">Cotovelo</option><option value="wrist">Punho</option>
              <option value="heel">Calcanhar</option><option value="toe">Metatarso / frente do pé</option>
            </select>
          </label>
              <button type="button" id="pose-manual-clear">↺ Restaurar pontos deste quadro</button>
          <label class="pose-trail-toggle"><input type="checkbox" id="pose-manual-labels" checked> Nome externo com linha-guia</label>
          <small>Vídeo pausado: arraste uma bolinha ou selecione a articulação e clique na posição correta. O nome fica afastado da marcação e pode ser ocultado acima. É possível marcar os oito pontos mesmo sem detecção da IA. O ajuste vale só para este quadro.</small>
        </div>
        <details class="pose-marker-mode" id="pose-marker-mode" open>
          <summary>◎ Rastrear marcadores físicos e ponto livre · 2D experimental</summary>
          <div class="pose-marker-content">
            <p>Marque até <strong>8 pontos anatômicos</strong> e acompanhe todos ou apenas um grupo. Pause o vídeo, use <strong>Corrigir pontos</strong> para colocar as marcações no atleta, conclua e selecione o grupo abaixo. Para acompanhar <strong>qualquer ponto independente</strong>, use o botão Ponto livre, clique na imagem e selecione Somente ponto livre.</p>
            <div class="pose-marker-actions">
              <label for="pose-marker-group">Analisar
                <select id="pose-marker-group">
                  <option value="all" selected>Todos · 8 pontos</option>
                  <option value="upper">Tronco + braço · 4</option>
                  <option value="leg">Fêmur + tíbia · 3</option>
                  <option value="foot">Pé e calcanhar · 3</option>
                  <option value="free">Somente ponto livre</option>
                </select>
              </label>
              <button type="button" id="pose-marker-start">▶ Seguir meus pontos</button>
              <button type="button" id="pose-marker-stop" disabled>■ Parar rastreio</button>
              <button type="button" id="pose-marker-free" aria-pressed="false">⊕ Posicionar ponto livre</button>
              <label for="pose-marker-kind">Referência
                <select id="pose-marker-kind"><option value="color">Marcador colorido · contraste</option><option value="texture" selected>Textura / contraste · 2D</option><option value="reflective">Ponto claro / refletivo</option></select>
              </label>
              <label for="pose-marker-size">Tamanho da bolinha
                <input id="pose-marker-size" type="range" min="4" max="34" value="16" step="1" aria-label="Diâmetro visível do ponto de rastreio" />
                <output id="pose-marker-size-value">16 px</output>
              </label>
            </div>
            <p id="pose-marker-status" role="status" aria-live="polite">Use 8 adesivos coloridos foscos sobre roupa ajustada. Para o ponto livre, pause o vídeo e clique em Posicionar ponto livre.</p>
            <small>O tamanho da bolinha altera a apresentação, não a região física identificada pelo rastreador. Marcador perdido fica vermelho e deixa de produzir medidas. Pause, corrija e reinicie. Refletivo é apenas reconhecimento de brilho na webcam comum: não é infravermelho profissional nem medição 3D.</small>
          </div>
        </details>
        <p class="pose-status" id="pose-status" role="status" aria-live="polite">2D manual pronto. Abra uma foto ou vídeo e clique em Corrigir pontos. Sem download de IA.</p>
        <div class="pose-canvas-wrap"><canvas id="pose-view" width="960" height="540" aria-label="Trajetórias biomecânicas 2D e ângulos aproximados identificados por IA"></canvas></div>
        <p class="pose-legend"><span><i style="background:#89dbea"></i>Joelho</span><span><i style="background:#b8c9d4"></i>Quadril</span><span><i style="background:#83e0c6"></i>Calcanhar</span><span><i style="background:#b6b5cf"></i>Ombro</span></p>
        <div class="pose-stats" aria-live="polite">
          <div><span>Joelho · atual</span><strong id="pose-knee">—</strong></div>
          <div><span>Tronco · horizontal</span><strong id="pose-trunk">—</strong></div>
          <div><span>Cotovelo</span><strong id="pose-elbow">—</strong></div>
          <div><span>Quadril · 2D</span><strong id="pose-hip">—</strong></div>
          <div class="pose-extreme"><span>Extensão observada · maior ângulo de joelho</span><strong id="pose-extension">—</strong></div>
          <div class="pose-extreme"><span>Flexão observada · menor ângulo de joelho</span><strong id="pose-flexion">—</strong></div>
          <div class="pose-extreme"><span>Variação do tronco · nesta pedalada</span><strong id="pose-trunk-delta">—</strong></div>
          <div class="pose-foot"><span>Inclinação do pé · calcanhar ao antepé / solo</span><strong id="pose-foot">—</strong></div>
        </div>
        <details class="pose-compare" id="pose-signature-compare">
          <summary>▥ Comparar assinaturas de movimento · ANTES × DEPOIS</summary>
          <div class="pose-compare-content">
            <p>Para uma comparação útil, grave os dois vídeos de perfil com a mesma posição de câmera, distância, escala e cadência semelhante. Esta sobreposição é visual, não indica automaticamente melhora.</p>
            <div class="pose-compare-actions">
              <button type="button" id="pose-signature-before">① Guardar ANTES</button>
              <button type="button" id="pose-signature-after">② Guardar DEPOIS</button>
              <label>Articulação <select id="pose-signature-joint"><option value="knee">Joelho</option><option value="hip">Quadril</option><option value="heel">Calcanhar</option></select></label>
              <button type="button" id="pose-signature-export" disabled>↓ Salvar comparação</button>
            </div>
            <p class="pose-compare-status" id="pose-signature-status" role="status" aria-live="polite">Reproduza alguns segundos do primeiro vídeo, guarde ANTES; depois carregue o segundo vídeo e guarde DEPOIS.</p>
            <div class="pose-canvas-wrap"><canvas id="pose-signature-view" width="960" height="540" aria-label="Sobreposição 2D das trajetórias antes e depois"></canvas></div>
            <p class="pose-compare-legend"><span><i style="background:#92d9ea"></i>ANTES</span><span><i style="background:#69dfc9"></i>DEPOIS</span><span>Trajetórias em coordenadas da imagem; sem calibração 3D.</span></p>
          </div>
        </details>
        <p class="pose-hint" id="pose-hint">2D: pause o vídeo, coloque os pontos manualmente e escolha Textura, Marcador colorido ou Refletivo para o rastreio experimental. A IA corporal continua disponível como modo separado.</p>
        <p class="pose-disclaimer">⚠️ Teste exploratório em 2D: o filtro reduz tremores e descarta saltos improváveis, mas não prende fisicamente os pontos ao atleta. A estabilização pode suavizar ângulos extremos. A inclinação do pé é a linha calcanhar–frente do pé com a horizontal da imagem, não uma medida direta do tornozelo. Não são reconstrução 3D, medidas de aerodinâmica nem diagnóstico. Fotos e quadros são processados no dispositivo; o modelo de IA precisa ser baixado na primeira utilização.</p>
      </div>`;
    aero.querySelector('.aero-measure')?.before(panel);
    if(!panel.isConnected)aero.append(panel);
    const el=id=>panel.querySelector('#'+id);
    el('pose-to-main-2d').addEventListener('click',()=>{
      const main2d=document.getElementById('paiva-athlete-2d');
      if(main2d){panel.open=false;main2d.scrollIntoView({behavior:'smooth',block:'start'});
        main2d.querySelector('#paiva-2d-video-file')?.focus({preventScroll:true});}
      else panel.querySelector('.pose-main-guide').textContent='A Análise 2D principal ainda não foi carregada. Atualize a página.';
    });
    // Ferramentas junto das laterais da imagem: esquerda = rastreio/grupo;
    // direita = IA, correção e seleção anatômica. Um botão amplia o quadro
    // sem exigir que o usuário gire o celular para acertar os pontos.
    const workbench=document.createElement('div');
    workbench.className='pose-workbench';
    workbench.innerHTML=`
      <aside class="pose-rail pose-rail-left" aria-label="Ferramentas de rastreamento à esquerda">
        <strong class="pose-rail-heading">RASTREAR</strong>
        <div class="pose-group-buttons" role="group" aria-label="Trocar imediatamente o conjunto visível">
          <button type="button" data-pose-group="all" aria-pressed="true">8 pontos</button>
          <button type="button" data-pose-group="upper" aria-pressed="false">Tronco + braço</button>
          <button type="button" data-pose-group="leg" aria-pressed="false">Fêmur + tíbia</button>
          <button type="button" data-pose-group="foot" aria-pressed="false">Pé + calcanhar</button>
          <button type="button" data-pose-group="free" aria-pressed="false">Ponto livre</button>
        </div>
      </aside>
      <div class="pose-workbench-center">
        <button type="button" id="pose-expand-view" class="pose-expand-view" aria-pressed="false">⤢ Ampliar vídeo</button>
      </div>
      <aside class="pose-rail pose-rail-right" aria-label="Ferramentas de correção à direita">
        <strong class="pose-rail-heading">CORRIGIR</strong>
        <button type="button" id="pose-delete-selected" title="Excluir ponto marcado nesta análise">✕ Excluir ponto</button>
        <div class="pose-joint-buttons" role="group" aria-label="Selecionar ponto anatômico para corrigir">
          <button type="button" data-pose-joint="shoulder">1 Ombro</button>
          <button type="button" data-pose-joint="elbow">2 Cotovelo</button>
          <button type="button" data-pose-joint="wrist">3 Punho</button>
          <button type="button" data-pose-joint="hip">4 Quadril</button>
          <button type="button" data-pose-joint="knee">5 Joelho</button>
          <button type="button" data-pose-joint="ankle">6 Tornozelo</button>
          <button type="button" data-pose-joint="heel">7 Calcanhar</button>
          <button type="button" data-pose-joint="toe">8 Metatarso</button>
        </div>
      </aside>`;
    const leftRail=workbench.querySelector('.pose-rail-left');
    const rightRail=workbench.querySelector('.pose-rail-right');
    const center=workbench.querySelector('.pose-workbench-center');
    const deleteMenu=document.createElement('div');
    deleteMenu.id='pose-delete-menu';deleteMenu.className='pose-delete-menu';
    deleteMenu.hidden=true;deleteMenu.setAttribute('role','menu');
    deleteMenu.innerHTML='<span id="pose-delete-label">Ponto selecionado</span>'+
      '<button type="button" id="pose-delete-one">✕ Excluir este ponto</button>'+
      '<button type="button" id="pose-delete-all">✕ Excluir todas as marcações manuais</button>'+
      '<button type="button" id="pose-delete-cancel">Cancelar</button>';
    panel.append(deleteMenu);
    const originalView=el('pose-view').parentElement;
    originalView.before(workbench);
    workbench.after(el('pose-marker-mode'));
    center.append(el('pose-status'),originalView, panel.querySelector('.pose-legend'));
    leftRail.append(panel.querySelector('.pose-marker-actions'),el('pose-marker-status'));
    rightRail.append(panel.querySelector('.pose-actions'),el('pose-manual-controls'));
    el('pose-marker-mode').open=false; // instruções detalhadas sob o vídeo
    for(const button of leftRail.querySelectorAll('[data-pose-group]'))
      button.addEventListener('click',()=>{
        el('pose-marker-group').value=button.dataset.poseGroup;
        el('pose-marker-group').dispatchEvent(new Event('change',{bubbles:true}));
      });
    for(const button of rightRail.querySelectorAll('[data-pose-joint]'))
      button.addEventListener('click',()=>{
        if(!editing)el('pose-manual-toggle').click();
        if(!editing)return;
        el('pose-manual-joint').value=button.dataset.poseJoint;
        el('pose-manual-joint').dispatchEvent(new Event('change',{bubbles:true}));
      });
    el('pose-expand-view').addEventListener('click',()=>{
      const expanded=workbench.classList.toggle('pose-workbench-expanded');
      el('pose-expand-view').setAttribute('aria-pressed',String(expanded));
      el('pose-expand-view').textContent=expanded?'↤ Mostrar ferramentas laterais':'⤢ Ampliar vídeo';
    });
    const canvas=el('pose-view'),ctx=canvas.getContext('2d');
    const raw=document.createElement('canvas');raw.width=W;raw.height=H;
    const rawCtx=raw.getContext('2d');
    if(!ctx||!rawCtx){el('pose-status').textContent='Canvas indisponível neste navegador.';return true;}
    let active=false,busy=false,lastSample=0,stopped=false,editing=false;
    let sampleIntervalMs=220;
    let currentEpoch=null,lastVideoTime=null,side=null,lastTrackVideoTime=null;
    let samples=0,minKnee=Infinity,maxKnee=-Infinity;
    let trunkSamples=0,minTrunk=Infinity,maxTrunk=-Infinity;
    const trails={knee:[],hip:[],heel:[],shoulder:[]};
    const compareCanvas=el('pose-signature-view'),compareCtx=compareCanvas.getContext('2d');
    const savedSignatures={before:null,after:null};
    let results=null,lastSource=null;
    let originalLandmarks=null,frameSlot=null;
    const correctedFrames=new Map();
    const hiddenJoints=new Set();
    const trackHistory={},ghosts={};
    // Modo experimental separado da estimativa corporal da MediaPipe.
    // Reutiliza o motor de pontos do 2D clássico, sem alterar seus arquivos.
    const markerCanvas=document.createElement('canvas');markerCanvas.width=640;markerCanvas.height=360;
    const markerCtx=markerCanvas.getContext('2d',{willReadFrequently:true});
    const markerPoints=new Map(),lostMarkers=new Set(),markerColors=new Map();
    let analysisMode='manual';
    let markerActive=false,markerEpoch=null,markerPrevGray=null;
    let markerLastTime=null,markerPreviousRate=null;
    let freeMarker=null,freeMarkerEpoch=null,placingFreeMarker=false;
    const JOINT_NAMES={shoulder:'Ombro',elbow:'Cotovelo',wrist:'Punho',hip:'Quadril',knee:'Joelho',ankle:'Tornozelo',heel:'Calcanhar',toe:'Metatarso',free:'Ponto livre'};
    function slotFor(source){
      return source?.mode==='photo'?'foto':
        Number.isFinite(source?.videoTime)?'video:'+Math.round(source.videoTime*30):null;
    }
    function correctedMeasurement(landmarks,poseSide,slot){
      if(!landmarks||!poseSide)return null;
      const fixes=slot?correctedFrames.get(slot):null;
      if((!fixes||!Object.keys(fixes).length)&&!hiddenJoints.size)return measure(landmarks,poseSide);
      const adjusted=landmarks.slice();
      for(const [joint,coords] of Object.entries(fixes||{})){
        const index=ANATOMY[poseSide]?.[joint];
        if(index===undefined)continue;
        adjusted[index]={...landmarks[index],x:coords.x,y:coords.y,visibility:1,presence:1};
      }
      for(const joint of hiddenJoints){
        const index=ANATOMY[poseSide]?.[joint];
        if(index!==undefined)adjusted[index]={x:0,y:0,visibility:0,presence:0};
      }
      return measure(adjusted,poseSide);
    }
    function refreshManualPoints(){
      if(!originalLandmarks||!side)return;
      results=correctedMeasurement(originalLandmarks,side,frameSlot);
      publish(results,lastSource,false);
      draw();
    }
    function exitEditing(){
      editing=false;
      el('pose-manual-controls').hidden=true;
      el('pose-manual-toggle').textContent='✥ Corrigir pontos';
      el('pose-manual-toggle').setAttribute('aria-pressed','false');
      canvas.classList.remove('pose-editing');
    }
    const fmt=x=>x===null||!Number.isFinite(x)?'—':x.toFixed(1).replace('.',',')+'°';
    const setText=(id,v)=>{el(id).textContent=v;};
    const status=message=>setText('pose-status',message);
    function selectAnalysisMode(mode){
      if(mode===analysisMode)return;
      if(active){active=false;el('pose-toggle').textContent='▶ Iniciar leitura IA';}
      if(markerActive)stopMarker('Rastreio pausado ao trocar de modo. Os pontos foram preservados.');
      if(editing)exitEditing();
      analysisMode=mode;
      el('pose-toggle').hidden=mode!=='ai';
      el('pose-mode-2d').setAttribute('aria-pressed',String(mode==='manual'));
      el('pose-mode-ai').setAttribute('aria-pressed',String(mode==='ai'));
      el('pose-mode-hint').textContent=mode==='manual'?
        '2D MANUAL: corrija os pontos na foto ou no vídeo pausado. Para acompanhá-los, use Seguir meus pontos. Nenhuma detecção automática do corpo será iniciada.':
        'IA CORPORAL · experimental: o reconhecimento automático continua disponível, sem alterações. Seus pontos manuais não são excluídos ao trocar de modo.';
      status(mode==='manual'?'2D manual ativado. Abra a imagem e clique em Corrigir pontos.':
        'Modo IA experimental ativado. Clique em Iniciar leitura IA quando desejar.');
      draw();
    }
    el('pose-mode-2d').addEventListener('click',()=>selectAnalysisMode('manual'));
    el('pose-mode-ai').addEventListener('click',()=>selectAnalysisMode('ai'));
    function renderComparison(){
      if(!compareCtx)return;
      const c=compareCtx;
      c.clearRect(0,0,W,H);c.fillStyle='#0b141c';c.fillRect(0,0,W,H);
      c.save();c.strokeStyle='rgba(165,190,203,.1)';c.lineWidth=1;
      for(let x=120;x<W;x+=120){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
      for(let y=90;y<H;y+=90){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
      c.restore();
      const selected=el('pose-signature-joint').value;
      for(const [key,color,tag] of [['before','#92d9ea','ANTES'],['after','#69dfc9','DEPOIS']]){
        const path=savedSignatures[key]?.paths[selected];
        if(!path||path.length<2)continue;
        c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.65;
        c.lineJoin='round';c.lineCap='round';c.beginPath();
        path.forEach((p,i)=>{if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);});
        c.stroke();
        const p=path[path.length-1];c.beginPath();c.arc(p.x,p.y,3,0,Math.PI*2);c.fill();
        c.font='700 12px system-ui';c.fillText(tag,clamp(p.x+9,8,W-68),clamp(p.y-8,24,H-13));
        c.restore();
      }
      c.fillStyle='rgba(9,17,24,.82)';c.fillRect(12,12,440,29);
      c.fillStyle='#d9e6ec';c.font='600 13px system-ui';
      const joint=TRAILS[selected]?.label||'Articulação';
      c.fillText('MOTION SIGNATURE · '+joint.toUpperCase()+' · 2D',22,31);
      c.fillStyle='rgba(9,17,24,.8)';c.fillRect(12,H-31,W-24,23);
      c.fillStyle='#b2c7d1';c.font='12px system-ui';
      c.fillText('A/B: MESMO ENQUADRAMENTO E ESCALA · SEM CORREÇÃO AUTOMÁTICA DE CÂMERA',21,H-15);
    }
    function storeSignature(which){
      const relevant=['knee','hip','heel'];
      const paths=Object.fromEntries(relevant.map(key=>[key,trails[key].map(p=>({...p}))]));
      const useful=relevant.filter(key=>paths[key].length>=5);
      if(!lastSource||lastSource.mode==='photo'||useful.length<1){
        setText('pose-signature-status','Abra um vídeo e deixe a IA registrar alguns segundos de trajetórias; depois guarde '+(which==='before'?'ANTES':'DEPOIS')+'.');
        return;
      }
      savedSignatures[which]={paths,epoch:lastSource.epoch};
      renderComparison();
      el('pose-signature-export').disabled=!savedSignatures.before||!savedSignatures.after;
      const both=!!savedSignatures.before&&!!savedSignatures.after;
      setText('pose-signature-status',both?
        (savedSignatures.before.epoch===savedSignatures.after.epoch?
          'A e B guardados do mesmo vídeo. Para comparar posições antes/depois, carregue duas gravações diferentes.':
          'ANTES e DEPOIS guardados. Escolha Joelho, Quadril ou Calcanhar para sobrepor trajetórias em 2D.'):
        (which==='before'?'ANTES guardado. Agora abra a gravação DEPOIS e faça a leitura.':
          'DEPOIS guardado. Agora abra a gravação ANTES e faça a leitura.'));
    }
    el('pose-signature-before').addEventListener('click',()=>storeSignature('before'));
    el('pose-signature-after').addEventListener('click',()=>storeSignature('after'));
    el('pose-signature-joint').addEventListener('change',renderComparison);
    el('pose-signature-export').addEventListener('click',()=>{
      if(!savedSignatures.before||!savedSignatures.after)return;
      renderComparison();compareCanvas.toBlob(blob=>{
        if(!blob)return;
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='PAIVA_Motion_Signature_Comparacao_AB.png';
        document.body.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        setText('pose-signature-status','Comparação visual 2D salva. Confira o alinhamento das duas gravações antes de interpretar.');
      },'image/png');
    });
    renderComparison();
    function reset(){
      samples=0;minKnee=Infinity;maxKnee=-Infinity;
      trunkSamples=0;minTrunk=Infinity;maxTrunk=-Infinity;
      Object.values(trails).forEach(list=>{list.length=0;});
      for(const key of Object.keys(trackHistory))delete trackHistory[key];
      for(const key of Object.keys(ghosts))delete ghosts[key];
      results=null;lastVideoTime=null;lastTrackVideoTime=null;side=null;
      ['knee','trunk','elbow','hip','foot','extension','flexion','trunk-delta'].forEach(k=>setText('pose-'+k,'—'));
    }
    function drawTrails(){
      if(editing||!el('pose-trails').checked)return;
      const allowed=new Set(MARKER_GROUPS[el('pose-marker-group').value]||MARKER_GROUPS.all);
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
      for(const [key,opts] of Object.entries(TRAILS)){
        if(!allowed.has(key))continue;
        const points=trails[key];
        if(points.length<2)continue;
        ctx.strokeStyle=opts.color;
        ctx.shadowBlur=0;ctx.lineWidth=1.35;
        for(let i=1;i<points.length;i++){
          const previous=points[i-1],current=points[i];
          ctx.globalAlpha=.16+.76*(i/points.length);
          ctx.beginPath();
          ctx.moveTo(previous.x,previous.y);ctx.lineTo(current.x,current.y);
          ctx.stroke();
        }
        const newest=points[points.length-1];
        ctx.globalAlpha=1;ctx.fillStyle=opts.color;
        ctx.beginPath();ctx.arc(newest.x,newest.y,2.9,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    function drawPointCallout(x,y,name,color){
      if(!name)return;
      ctx.save();ctx.font='700 15px "Segoe UI",system-ui,sans-serif';
      const width=ctx.measureText(name).width+23;
      // Não encobrir o ponto anatômico: etiqueta afastada e conectada por
      // haste fina. Quando o atleta está à direita, a haste sai à esquerda.
      const toRight=x<W*.55,offset=toRight?1:-1;
      const left=clamp(x+(toRight?132:-132-width),14,W-width-14);
      const top=clamp(y-76,45,H-49);
      const attachX=toRight?left:left+width;
      ctx.strokeStyle=color;ctx.lineWidth=1.25;ctx.globalAlpha=.87;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+offset*36,y-28);
      ctx.lineTo(attachX,top+15);ctx.stroke();
      ctx.globalAlpha=1;ctx.fillStyle='rgba(7,15,21,.94)';
      ctx.fillRect(left,top,width,30);
      ctx.strokeStyle=color;ctx.strokeRect(left+.5,top+.5,width-1,29);
      ctx.fillStyle=color;ctx.fillText(name,left+11,top+20);
      ctx.restore();
    }
    function drawGhosts(){
      if(editing)return;
      ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#93d0e4';
      ctx.setLineDash([3,4]);
      for(const p of Object.values(ghosts)){
        ctx.beginPath();ctx.arc(p.x*W,p.y*H,7,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }
    const coords=p=>[p.x*W,p.y*H];
    function drawSkeleton(data){
      if(!data)return;
      const p=data.points;
      const visibleGroup=new Set(MARKER_GROUPS[el('pose-marker-group').value]||MARKER_GROUPS.all);
      const lines=[['shoulder','elbow'],['elbow','wrist'],['shoulder','hip'],['hip','knee'],['knee','ankle'],['ankle','heel'],['heel','toe']];
      ctx.save();ctx.lineCap='round';
      for(const [a,b] of lines){
        if(!visible(p[a])||!visible(p[b]))continue;
        ctx.globalAlpha=editing&&(!visibleGroup.has(a)||!visibleGroup.has(b)) ? .23 : 1;
        const [x1,y1]=coords(p[a]),[x2,y2]=coords(p[b]);
        ctx.strokeStyle='rgba(0,0,0,.87)';ctx.lineWidth=7;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.strokeStyle='#ffd85d';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      }
      for(const key of Object.keys(p)){
        if(!visible(p[key]))continue;
        ctx.globalAlpha=editing&&!visibleGroup.has(key) ? .3 : 1;
        const [x,y]=coords(p[key]);
        ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);
        const corrected=!!correctedFrames.get(frameSlot)?.[key];
        ctx.fillStyle=corrected?'#69f0df':'#fff';ctx.fill();ctx.lineWidth=corrected?3:2;
        ctx.strokeStyle=corrected?'#107b73':'#f2b722';ctx.stroke();
        if(editing&&el('pose-manual-joint').value===key){
          ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);
          ctx.strokeStyle='#69f0df';ctx.lineWidth=2;ctx.stroke();
          if(el('pose-manual-labels').checked)
            drawPointCallout(x,y,JOINT_NAMES[key],'#69f0df');
        }
      }
      ctx.globalAlpha=1;
      // Graus são exibidos nos cartões abaixo do vídeo, deixando as
      // articulações desobstruídas durante a correção manual.
      ctx.restore();
    }
    function draw(){
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#0b131b';ctx.fillRect(0,0,W,H);
      if(lastSource||currentEpoch!==null)ctx.drawImage(raw,0,0);
      else{
        ctx.textAlign='center';ctx.fillStyle='#aebac5';ctx.font='18px system-ui';
        ctx.fillText('Abra uma foto ou vídeo no Motion Studio para iniciar',W/2,H/2);
        ctx.textAlign='left';
      }
      drawTrails();
      // Em modo de correção, todos os pontos voltam a aparecer para permitir
      // selecionar qualquer articulação pela barra direita.
      if(results)drawSkeleton(editing?results:viewByGroup(results,el('pose-marker-group').value));
      if(markerPoints.size||freeMarker)drawMarkerPoints();
      drawGhosts();
      ctx.fillStyle='rgba(9,16,23,.8)';ctx.fillRect(12,12,390,31);
      ctx.fillStyle='#ffe476';ctx.font='600 14px system-ui';
      const groupName=el('pose-marker-group').selectedOptions[0].textContent.trim();
      ctx.fillText('PAIVA · '+groupName.toUpperCase()+' · 2D',22,33);
      ctx.fillStyle='rgba(10,18,26,.8)';ctx.fillRect(12,H-32,W-24,24);
      ctx.fillStyle='#c8d3dc';ctx.font='12px system-ui';
      ctx.fillText(editing?'CORREÇÃO MANUAL · QUADRO PAUSADO · PONTOS EM VERDE = CORRIGIDOS':
        analysisMode==='manual'?'2D MANUAL · SEM DETECÇÃO CORPORAL · RASTREIO EXPERIMENTAL':
        'TRAJETÓRIAS DE ARTICULAÇÕES DETECTADAS · IA EXPERIMENTAL',20,H-15);
    }
    function publish(data,source,record=true){
      data=viewByGroup(data,el('pose-marker-group').value);
      const groupKeys=new Set(MARKER_GROUPS[el('pose-marker-group').value]||MARKER_GROUPS.all);
      const showKnee=['hip','knee','ankle'].every(key=>groupKeys.has(key));
      const showTrunk=['hip','shoulder'].every(key=>groupKeys.has(key));
      ['knee','trunk','elbow','hip','foot'].forEach(k=>setText('pose-'+k,fmt(data?.[k]??null)));
      if(source?.mode==='photo'){
        setText('pose-extension','—');setText('pose-flexion','—');setText('pose-trunk-delta','—');
        el('pose-hint').textContent='Foto: somente os ângulos visíveis neste instante. Para extensão e flexão observadas, abra um vídeo lateral da pedalada.';
      }else{
        if(record&&data?.knee!==null&&data?.knee!==undefined){
          minKnee=Math.min(minKnee,data.knee);maxKnee=Math.max(maxKnee,data.knee);
          samples++;
        }
        setText('pose-extension',showKnee&&samples>=5?fmt(maxKnee):'—');
        setText('pose-flexion',showKnee&&samples>=5?fmt(minKnee):'—');
        if(record&&data?.trunk!==null&&data?.trunk!==undefined){
          minTrunk=Math.min(minTrunk,data.trunk);maxTrunk=Math.max(maxTrunk,data.trunk);
          trunkSamples++;
        }
        setText('pose-trunk-delta',showTrunk&&trunkSamples>=5?fmt(maxTrunk-minTrunk):'—');
        el('pose-hint').textContent=samples<5?
          'Aguarde cinco quadros válidos. Rastros e extremos exigem pedalada em vídeo, com câmera fixa.':
          'Ângulos e rastros observados ('+samples+' quadros válidos). Oscilações podem incluir imprecisão do rastreador; não são metas de ajuste.';
      }
    }
    function drawMarkerPoints(){
      ctx.save();ctx.lineWidth=2.5;
      const diameter=Number(el('pose-marker-size').value)||16;
      const allowed=new Set(MARKER_GROUPS[el('pose-marker-group').value]||MARKER_GROUPS.all);
      for(const [joint,p] of markerPoints){
        if(!allowed.has(joint))continue;
        const x=p.x*W,y=p.y*H,lost=lostMarkers.has(joint);
        ctx.strokeStyle=lost?'#f77979':'#5cf2df';
        ctx.setLineDash(lost?[4,3]:[]);
        ctx.beginPath();ctx.arc(x,y,diameter/2,0,Math.PI*2);ctx.stroke();
        if(!lost){ctx.fillStyle='#dffff9';ctx.beginPath();ctx.arc(x,y,2.3,0,Math.PI*2);ctx.fill();}
      }
      if(freeMarker&&!markerPoints.has('free')&&
          (placingFreeMarker||el('pose-marker-group').value==='free')){
        ctx.setLineDash([]);ctx.strokeStyle='#f5f27c';
        ctx.beginPath();ctx.arc(freeMarker.x*W,freeMarker.y*H,diameter/2,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#f5f27c';ctx.beginPath();ctx.arc(freeMarker.x*W,freeMarker.y*H,2.4,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    function markerImage(){
      if(!markerCtx)return null;
      markerCtx.drawImage(raw,0,0,markerCanvas.width,markerCanvas.height);
      return markerCtx.getImageData(0,0,markerCanvas.width,markerCanvas.height);
    }
    function markerGray(image){
      const tracker=globalThis.PAIVA_MOTION_TRACKER;
      if(!tracker?.grayscale)return null;
      return tracker.grayscale(image||markerImage());
    }
    function stopMarker(message,pause=true){
      markerActive=false;
      el('pose-marker-stop').disabled=true;
      const v=document.getElementById('aero-source-video');
      if(v){
        if(pause&&!v.paused)v.pause();
        if(markerPreviousRate!==null){v.defaultPlaybackRate=markerPreviousRate;v.playbackRate=markerPreviousRate;}
      }
      if(pause){const player=document.getElementById('aero-play');
        if(player)player.textContent='▶ Reproduzir vídeo';}
      markerPreviousRate=null;
      if(message)setText('pose-marker-status',message);
    }
    function markerEditsNear(source){
      if(currentEpoch!==source.epoch)return {};
      const slot=slotFor(source),exact=correctedFrames.get(slot);
      if(exact&&Object.keys(exact).length)return exact;
      if(!Number.isFinite(source.videoTime))return {};
      const target=Math.round(source.videoTime*30);
      let best=null,smallest=Infinity;
      for(const [key,edits] of correctedFrames){
        if(!key.startsWith('video:')||!Object.keys(edits).length)continue;
        const delta=Math.abs(Number(key.slice(6))-target);
        if(delta<smallest){smallest=delta;best=edits;}
      }
      // No máximo 1/4 de segundo: acima disso o atleta pode estar em outra
      // fase da pedalada e não é seguro reutilizar o ponto anterior.
      return smallest<=7?best:{};
    }
    function updateMarkerMeasurements(source){
      const invisible=()=>({x:0,y:0,visibility:0,presence:0});
      const points=Array.from({length:33},invisible);
      const edits={};
      for(const [joint,p] of markerPoints){
        if(lostMarkers.has(joint))continue;
        const index=ANATOMY[side]?.[joint];if(index===undefined)continue;
        points[index]={x:p.x,y:p.y,visibility:1,presence:1};
        edits[joint]={x:p.x,y:p.y};
        if(source.playing&&Object.hasOwn(TRAILS,joint))
          pushTrail(trails,joint,points[index],source.videoTime*1000);
      }
      originalLandmarks=points;
      frameSlot=slotFor(source);
      if(Object.keys(edits).length){
        correctedFrames.set(frameSlot,edits);
        if(correctedFrames.size>300)correctedFrames.delete(correctedFrames.keys().next().value);
      }
      results=measure(points,side);
      lastSource=source;lastVideoTime=source.videoTime;
      publish(results,source,source.playing);
      draw();
    }
    function markerTick(){
      if(!markerActive||busy||document.hidden||!panel.open)return;
      const source=globalThis.PAIVA_WIND_SIMPLE?.getAnalysisFrame?.(rawCtx);
      if(!source||source.mode!=='video'||source.epoch!==markerEpoch){
        stopMarker('O vídeo mudou. Pause e marque novamente os pontos antes de reiniciar.',false);
        return;
      }
      if(source.videoTime===markerLastTime)return;
      const step=source.videoTime-markerLastTime;
      if(step<-.03||step>.48){
        stopMarker('O vídeo pulou muitos quadros para seguir com confiança. Pause, corrija os pontos e reinicie.');
        return;
      }
      const image=markerImage(),gray=markerGray(image);
      const tracker=globalThis.PAIVA_MOTION_TRACKER;
      if(!image||!gray||!tracker?.trackRobustPoint){stopMarker('Rastreador do 2D indisponível.');return;}
      const kind=el('pose-marker-kind').value;
      for(const [joint,p] of markerPoints){
        if(lostMarkers.has(joint))continue;
        const scaled={x:p.x*markerCanvas.width,y:p.y*markerCanvas.height};
        let found=null;
        if(kind==='color'){
          found=followColorMarker(image,markerCanvas.width,markerCanvas.height,
            scaled,markerColors.get(joint),25);
        }else if(kind==='reflective'&&tracker.trackFineShapes){
          const match=tracker.trackFineShapes(markerPrevGray,gray,
            markerCanvas.width,markerCanvas.height,
            [{kind:'full8',reflectorMode:true,trackEnabled:true,points:[scaled]}],
            markerCanvas.width,markerCanvas.height,{patch:5,search:24});
          if(!match.lost.length)found=match.shapes[0].points[0];
        }
        if(!found&&kind!=='color')found=tracker.trackRobustPoint(markerPrevGray,gray,
          markerCanvas.width,markerCanvas.height,scaled,{patch:5,search:24});
        if(!found){lostMarkers.add(joint);continue;}
        markerPoints.set(joint,{x:found.x/markerCanvas.width,y:found.y/markerCanvas.height});
      }
      markerPrevGray=gray;markerLastTime=source.videoTime;
      updateMarkerMeasurements(source);
      const names=[...markerPoints.keys()];
      const lost=names.filter(key=>lostMarkers.has(key));
      setText('pose-marker-status',lost.length?
        'Referência perdida: '+lost.map(key=>JOINT_NAMES[key]).join(', ')+
        '. Círculo vermelho = último local conhecido. Pause, corrija e reinicie.':
        '● '+names.length+' ponto(s) acompanhados · '+(kind==='color'?'cor do marcador':'contraste')+
        ' · sem IA corporal. Confira o alinhamento durante a reprodução.');
      if(lost.length===names.length)stopMarker('Todos os pontos perderam a referência. Corrija-os no quadro atual e reinicie.');
    }
    el('pose-marker-start').addEventListener('click',async()=>{
      if(editing){setText('pose-marker-status','Primeiro conclua a correção manual dos pontos.');return;}
      if(markerActive)stopMarker('Preparando novo rastreio.');
      const tracker=globalThis.PAIVA_MOTION_TRACKER;
      if(!tracker?.grayscale||!tracker?.trackRobustPoint||!markerCtx){
        setText('pose-marker-status','O motor do rastreador 2D ainda não carregou. Atualize a página.');return;
      }
      const source=globalThis.PAIVA_WIND_SIMPLE?.getAnalysisFrame?.(rawCtx);
      if(!source||source.mode!=='video'){
        setText('pose-marker-status','Abra um VÍDEO gravado no Motion Studio e pause no quadro em que marcou os pontos.');return;
      }
      frameSlot=slotFor(source);
      const edits=markerEditsNear(source);
      const group=el('pose-marker-group').value;
      // O motor prepara TODOS os marcadores definidos. O seletor alterna
      // apenas a visualização, sem perder os outros pontos nem parar o vídeo.
      const chosen=group==='free'?
        (freeMarker&&freeMarkerEpoch===source.epoch?['free']:[]):
        MARKER_GROUPS.all.filter(joint=>edits[joint]);
      if(!chosen.length){
        setText('pose-marker-status',group==='free'?
          'Clique em Posicionar ponto livre e marque uma referência no vídeo pausado.':
          'Pause o vídeo, corrija as articulações do grupo escolhido e conclua a correção.');return;
      }
      markerPoints.clear();lostMarkers.clear();markerColors.clear();
      for(const joint of chosen)markerPoints.set(joint,
        {...(joint==='free'?freeMarker:edits[joint])});
      if(!side)side=el('pose-side').value==='right'?'right':'left';
      active=false;el('pose-toggle').textContent='▶ Iniciar leitura IA';
      samples=0;minKnee=Infinity;maxKnee=-Infinity;
      trunkSamples=0;minTrunk=Infinity;maxTrunk=-Infinity;
      Object.values(trails).forEach(path=>{path.length=0;});
      markerEpoch=source.epoch;markerLastTime=source.videoTime;
      const image=markerImage();
      markerPrevGray=markerGray(image);
      if(!markerPrevGray){setText('pose-marker-status','Não foi possível preparar a imagem do vídeo.');return;}
      const kind=el('pose-marker-kind').value;
      const weak=[];
      for(const [joint,p] of markerPoints){
        const at={x:p.x*markerCanvas.width,y:p.y*markerCanvas.height};
        if(kind==='color'){
          const sample=sampleColorMarker(image,markerCanvas.width,markerCanvas.height,at);
          if(sample)markerColors.set(joint,sample);
          else weak.push(joint);
        }else if(!tracker.trackRobustPoint(markerPrevGray,markerPrevGray,
          markerCanvas.width,markerCanvas.height,at,{patch:5,search:8}))weak.push(joint);
      }
      if(weak.length){
        setText('pose-marker-status',kind==='color'?'Sem cor viva suficiente no ponto inicial: '+
          weak.map(key=>JOINT_NAMES[key]).join(', ')+
          '. Use bolinha fluorescente fosca; ou escolha Textura / contraste.':
          'Sem contraste suficiente no quadro inicial: '+
          weak.map(key=>JOINT_NAMES[key]).join(', ')+
          '. Use fita ou marcador de maior contraste, corrija a posição e tente novamente.');
        return;
      }
      markerActive=true;el('pose-marker-stop').disabled=false;
      sampleIntervalMs=90;
      const video=document.getElementById('aero-source-video');
      markerPreviousRate=video?.playbackRate??null;
      if(video){video.defaultPlaybackRate=Math.min(video.playbackRate,.25);
        video.playbackRate=Math.min(video.playbackRate,.25);
        try{await video.play();const player=document.getElementById('aero-play');
          if(player)player.textContent='⏸ Pausar vídeo';
        }catch(_){/* o usuário pode iniciar no player */}}
      lastSample=0;
      setText('pose-marker-status','Rastreando '+chosen.map(key=>JOINT_NAMES[key]).join(', ')+
        ' em reprodução lenta. Se perder um ponto, pause e corrija manualmente.');
    });
    el('pose-marker-stop').addEventListener('click',()=>stopMarker('Rastreio pausado. Você pode corrigir os pontos no quadro atual.'));
    el('pose-marker-group').addEventListener('change',()=>{
      const group=el('pose-marker-group').value;
      for(const button of panel.querySelectorAll('[data-pose-group]'))
        button.setAttribute('aria-pressed',String(button.dataset.poseGroup===group));
      if(lastSource)publish(results,lastSource,false);
      draw();
      const keys=MARKER_GROUPS[group]||MARKER_GROUPS.all;
      const tracked=keys.filter(joint=>markerPoints.has(joint)&&!lostMarkers.has(joint));
      setText('pose-marker-status',tracked.length?
        'Exibindo '+el('pose-marker-group').selectedOptions[0].textContent.trim()+
        ' · '+tracked.length+' ponto(s) deste grupo. O rastreio continua, sem reiniciar.':
        'Visualização: '+el('pose-marker-group').selectedOptions[0].textContent.trim()+
        '. Se aparecer vazio, pause e marque os pontos deste grupo antes de rastrear.');
    });
    el('pose-marker-kind').addEventListener('change',()=>{
      if(markerActive)stopMarker('Referência alterada. Inicie novamente para capturar a nova cor ou textura.');
      markerColors.clear();
      draw();
    });
    async function sample(now){
      if(markerActive){markerTick();return;}
      if(busy||!active||editing||!panel.open||document.hidden)return;
      const aeroSource=globalThis.PAIVA_WIND_SIMPLE;
      if(!aeroSource?.getAnalysisFrame)return;
      const source=aeroSource.getAnalysisFrame(rawCtx);
      if(!source){
        if(!lastSource)status('Abra uma foto ou vídeo no Motion Studio para iniciar a leitura.');
        return;
      }
      if(currentEpoch!==source.epoch){
        currentEpoch=source.epoch;reset();correctedFrames.clear();hiddenJoints.clear();originalLandmarks=null;
        freeMarker=null;freeMarkerEpoch=null;
      }
      // Pular vários segundos ou voltar o vídeo invalida a estimativa de
      // velocidade e as trajetórias anteriores; retomar num quadro novo.
      if(Number.isFinite(source.videoTime)&&lastTrackVideoTime!==null&&
         (source.videoTime<lastTrackVideoTime-.05||
          source.videoTime-lastTrackVideoTime>1.5))reset();
      if(Number.isFinite(source.videoTime))lastTrackVideoTime=source.videoTime;
      if(source.mode==='photo'&&lastSource?.mode==='photo'&&lastSource.epoch===source.epoch)return;
      if(source.mode!=='photo'&&source.videoTime===lastVideoTime)return;
      lastSource=source;lastVideoTime=source.videoTime;
      frameSlot=slotFor(source);
      busy=true;
      const started=performance.now();
      try{
        const model=await getModel();
        if(!active||editing)return;
        // detectForVideo é síncrono: a frequência baixa limita o custo no PC.
        const detection=model.detectForVideo(raw,Math.max(now,performance.now()));
        const landmarks=detection.landmarks?.[0];
        if(landmarks?.length>=33){
          const selectedSide=el('pose-side').value;
          side=selectedSide==='auto'?(side||chooseSide(landmarks,null)):selectedSide;
          const trackingTime=Number.isFinite(source.videoTime)?source.videoTime*1000:now;
          const stableLandmarks=stabilizeLandmarks(landmarks,side,trackingTime,
            el('pose-stability').value,trackHistory,ghosts);
          originalLandmarks=stableLandmarks;
          results=correctedMeasurement(stableLandmarks,side,frameSlot);
          if(source.mode!=='photo'&&source.playing){
            for(const key of Object.keys(TRAILS)){
              if(trackHistory[key]?.reacquired){trails[key].length=0;
                delete trackHistory[key].reacquired;}
              pushTrail(trails,key,results.points[key],trackingTime);
            }
          }
          publish(results,source);
          const valid=['knee','trunk','elbow','hip','foot'].filter(k=>results[k]!==null);
          status(valid.length?'● '+valid.length+' leituras visíveis · lado '+(side==='left'?'esquerdo':'direito')+
            (Object.keys(ghosts).length?' · círculo vazado = referência anterior, sem medida':'')+
            ' · modo '+el('pose-stability').selectedOptions[0].textContent+'.':
            'Articulações ocultas ou instáveis: sem estimativa confiável.');
        }else{
          for(const key of Object.keys(ghosts))delete ghosts[key];
          originalLandmarks=null;results=null;publish(null,source);
          status('Não identifiquei uma pessoa com pontos suficientemente visíveis neste quadro.');
        }
        draw();
      }catch(error){
        active=false;
        el('pose-toggle').textContent='↻ Tentar novamente';
        status('IA indisponível: '+(error?.message||String(error))+'. Confira sua internet e tente outra vez.');
      }finally{
        // Ajusta a cadência de análise ao desempenho do dispositivo:
        // coleta mais quadros em um PC rápido, reduz carga em PCs modestos.
        const elapsed=performance.now()-started;
        sampleIntervalMs=clamp(elapsed*1.65,165,520);
        busy=false;
      }
    }
    function schedule(now){
      if(stopped)return;
      if((active||markerActive)&&now-lastSample>=sampleIntervalMs){lastSample=now;void sample(now);}
      requestAnimationFrame(schedule);
    }
    el('pose-toggle').addEventListener('click',async()=>{
      if(analysisMode!=='ai'){
        status('2D manual não inicia reconhecimento corporal. Selecione a aba IA CORPORAL para usar a IA.');
        return;
      }
      if(editing){exitEditing();status('Correção deste quadro concluída. Clique novamente em Continuar leitura para acompanhar o vídeo.');return;}
      if(markerActive)stopMarker('Modo de marcadores pausado. A IA corporal pode ser iniciada separadamente.');
      markerPoints.clear();lostMarkers.clear();
      if(active){active=false;el('pose-toggle').textContent='▶ Continuar leitura';status('Leitura pausada.');return;}
      if(!globalThis.PAIVA_WIND_SIMPLE?.getAnalysisFrame){status('Aguarde o Motion Studio terminar de carregar.');return;}
      const playingVideo=document.getElementById('aero-source-video');
      if(['video','camera'].includes(lastSource?.mode)&&playingVideo?.paused){
        try{await playingVideo.play();
          const play=document.getElementById('aero-play');if(play)play.textContent='⏸ Pausar vídeo';
        }catch(_){/* reprodução pode exigir clique no player do Aero */}
      }
      active=true;
      el('pose-toggle').textContent='⏸ Pausar leitura';
      status('⏳ Carregando modelo de articulações neste dispositivo…');
      try{await getModel();if(active){status('Modelo pronto. Buscando articulações no Motion Studio…');lastSample=0;}}
      catch(error){active=false;el('pose-toggle').textContent='↻ Tentar novamente';status('Modelo de articulações não carregou: '+(error?.message||error));}
    });
    for(const settingId of ['pose-stability','pose-side']){
      el(settingId).addEventListener('change',()=>{
        if(markerActive)stopMarker('Rastreio de marcadores parado para alterar o ajuste.');
        markerPoints.clear();lostMarkers.clear();
        reset();lastSource=null;originalLandmarks=null;correctedFrames.clear();
        status(settingId==='pose-side'?'Lado corporal alterado. A leitura começa uma nova trajetória.':
          'Filtro de estabilidade alterado. Iniciando uma nova trajetória.');
        draw();
      });
    }
    el('pose-manual-toggle').addEventListener('click',()=>{
      if(editing){exitEditing();status('Correção manual concluída. A imagem corrigida pode ser salva. Continue a leitura para outros quadros.');draw();return;}
      if(markerActive)stopMarker('Rastreio pausado para você corrigir um marcador.');
      if(placingFreeMarker){placingFreeMarker=false;canvas.classList.remove('pose-placing-free');
        el('pose-marker-free').setAttribute('aria-pressed','false');}
      markerPoints.clear();lostMarkers.clear();
      // Se a IA não reconhecer o atleta, o profissional ainda pode colocar
      // os seis marcos manualmente sobre a imagem importada no Aero.
      const source=globalThis.PAIVA_WIND_SIMPLE?.getAnalysisFrame?.(rawCtx);
      if(!source){status('Primeiro abra uma foto ou vídeo no Motion Studio para marcar os pontos.');return;}
      if(!results||!originalLandmarks||currentEpoch!==source.epoch||
          (source.mode==='video'&&lastSource?.mode==='video'&&
            Math.abs(source.videoTime-lastSource.videoTime)>.25)){
        if(currentEpoch!==source.epoch){correctedFrames.clear();hiddenJoints.clear();currentEpoch=source.epoch;reset();}
        lastSource=source;lastVideoTime=source.videoTime;frameSlot=slotFor(source);
        side=el('pose-side').value==='right'?'right':'left';
        originalLandmarks=Array.from({length:33},()=>({x:0,y:0,visibility:0,presence:0}));
        results=measure(originalLandmarks,side);
      }else{
        const prior=markerEditsNear(source);
        lastSource=source;lastVideoTime=source.videoTime;frameSlot=slotFor(source);
        if(Object.keys(prior).length&&!correctedFrames.has(frameSlot))
          correctedFrames.set(frameSlot,{...prior});
        refreshManualPoints();
      }
      active=false;el('pose-toggle').textContent='▶ Continuar leitura';
      const sourceVideo=document.getElementById('aero-source-video');
      if(['video','camera'].includes(lastSource?.mode)&&sourceVideo&&!sourceVideo.paused){
        sourceVideo.pause();
        const play=document.getElementById('aero-play');if(play)play.textContent='▶ Reproduzir vídeo';
      }
      editing=true;
      // Extremos de uma coleta ainda não revisada não são resultados
      // validados por corrigir apenas um dos quadros.
      samples=0;minKnee=Infinity;maxKnee=-Infinity;
      trunkSamples=0;minTrunk=Infinity;maxTrunk=-Infinity;
      el('pose-manual-controls').hidden=false;
      el('pose-manual-toggle').textContent='✓ Concluir correção';
      el('pose-manual-toggle').setAttribute('aria-pressed','true');
      canvas.classList.add('pose-editing');publish(results,lastSource,false);draw();
      status('Correção ativa: arraste um ponto ou selecione a articulação e clique onde ela realmente está.');
    });
    el('pose-marker-size').addEventListener('input',()=>{
      el('pose-marker-size-value').textContent=el('pose-marker-size').value+' px';
      draw();
    });
    el('pose-marker-free').addEventListener('click',()=>{
      if(markerActive)stopMarker('Rastreio parado para posicionar o ponto livre.');
      if(editing)exitEditing();
      const source=globalThis.PAIVA_WIND_SIMPLE?.getAnalysisFrame?.(rawCtx);
      if(source?.mode!=='video'){
        setText('pose-marker-status','Abra primeiro um vídeo para posicionar o ponto livre.');return;
      }
      placingFreeMarker=!placingFreeMarker;
      if(placingFreeMarker){
        document.getElementById('aero-source-video')?.pause();
        el('pose-marker-group').value='free';
      }
      canvas.classList.toggle('pose-placing-free',placingFreeMarker);
      el('pose-marker-free').setAttribute('aria-pressed',String(placingFreeMarker));
      setText('pose-marker-status',placingFreeMarker?
        'Clique no ponto exato da imagem. Esta bolinha é independente de linhas e ângulos.':
        'Ponto livre pronto. Selecione Somente ponto livre e clique em Seguir meus pontos.');
    });
    canvas.addEventListener('pointerdown',event=>{
      if(!placingFreeMarker||event.button!==0)return;
      event.preventDefault();event.stopImmediatePropagation();
      const source=globalThis.PAIVA_WIND_SIMPLE?.getAnalysisFrame?.(rawCtx);
      if(!source||source.mode!=='video')return;
      freeMarker={x:clamp((event.clientX-canvas.getBoundingClientRect().left)/canvas.getBoundingClientRect().width,0,1),
        y:clamp((event.clientY-canvas.getBoundingClientRect().top)/canvas.getBoundingClientRect().height,0,1)};
      freeMarkerEpoch=source.epoch;
      markerPoints.clear();lostMarkers.clear();markerColors.clear();
      currentEpoch=source.epoch;lastSource=source;lastVideoTime=source.videoTime;
      placingFreeMarker=false;canvas.classList.remove('pose-placing-free');
      el('pose-marker-free').setAttribute('aria-pressed','false');
      setText('pose-marker-status','Ponto livre colocado. Ajuste seu tamanho e clique em Seguir meus pontos.');
      draw();
    });
    let draggingJoint=null,explicitSelected=false;
    function coordinateFromPointer(event){
      const rect=canvas.getBoundingClientRect();
      return {x:clamp((event.clientX-rect.left)/rect.width,0,1),
        y:clamp((event.clientY-rect.top)/rect.height,0,1)};
    }
    function nearestJoint(p){
      if(!results?.points)return null;
      let nearest=null,distance=Infinity;
      for(const [joint,item] of Object.entries(results.points)){
        if(!visible(item))continue;
        const distanceHere=Math.hypot((p.x-item.x)*W,(p.y-item.y)*H);
        if(distanceHere<distance){distance=distanceHere;nearest=joint;}
      }
      return distance<=24?nearest:null;
    }
    function moveJoint(joint,p){
      if(!originalLandmarks||!frameSlot||!ANATOMY[side]?.[joint])return;
      hiddenJoints.delete(joint);
      const edits={...(correctedFrames.get(frameSlot)||{})};
      edits[joint]={x:p.x,y:p.y};
      correctedFrames.set(frameSlot,edits);
      if(correctedFrames.size>300)correctedFrames.delete(correctedFrames.keys().next().value);
      refreshManualPoints();
    }
    let pendingDeleteJoint=null;
    function manuallyMarked(joint){
      if(joint==='free')return !!freeMarker||markerPoints.has('free');
      return markerPoints.has(joint)||!!correctedFrames.get(frameSlot)?.[joint]||
        (visible(results?.points?.[joint])&&!hiddenJoints.has(joint));
    }
    function jointAt(p){
      let closest=null,distance=Infinity;
      const candidates=new Map();
      for(const [joint,item] of Object.entries(results?.points||{}))
        if(visible(item)&&!hiddenJoints.has(joint))candidates.set(joint,item);
      for(const [joint,item] of Object.entries(correctedFrames.get(frameSlot)||{}))candidates.set(joint,item);
      for(const [joint,item] of markerPoints)candidates.set(joint,item);
      if(freeMarker)candidates.set('free',freeMarker);
      for(const [joint,item] of candidates){
        const d=Math.hypot((p.x-item.x)*W,(p.y-item.y)*H);
        if(d<distance){closest=joint;distance=d;}
      }
      return distance<=42?closest:null;
    }
    function closePoseDelete(){deleteMenu.hidden=true;pendingDeleteJoint=null;}
    function showPoseDelete(joint,x,y){
      if(!joint||!manuallyMarked(joint)){
        status('Marque um ponto no 2D e clique com o botão direito sobre ele para excluir.');return;
      }
      pendingDeleteJoint=joint;
      el('pose-delete-label').textContent='Excluir '+(JOINT_NAMES[joint]||joint)+'?';
      deleteMenu.style.left=Math.max(4,Math.min(x,innerWidth-265))+'px';
      deleteMenu.style.top=Math.max(4,Math.min(y,innerHeight-145))+'px';
      deleteMenu.hidden=false;
    }
    function deletePoseJoint(joint){
      if(!joint)return;
      if(markerActive)stopMarker('Rastreio pausado: ponto excluído.');
      if(joint==='free'){
        freeMarker=null;freeMarkerEpoch=null;placingFreeMarker=false;
        canvas.classList.remove('pose-placing-free');
        el('pose-marker-free').setAttribute('aria-pressed','false');
      }else hiddenJoints.add(joint);
      markerPoints.delete(joint);lostMarkers.delete(joint);markerColors.delete(joint);
      for(const [slot,edits] of correctedFrames){
        if(!edits[joint])continue;
        const copy={...edits};delete copy[joint];
        if(Object.keys(copy).length)correctedFrames.set(slot,copy);
        else correctedFrames.delete(slot);
      }
      if(originalLandmarks&&side){
        results=correctedMeasurement(originalLandmarks,side,frameSlot);
        publish(results,lastSource,false);
      }
      draw();closePoseDelete();
      status((JOINT_NAMES[joint]||joint)+' excluído da análise visual. Vídeo e IA preservados.');
    }
    function deleteAllManual(){
      if(markerActive)stopMarker('Rastreio pausado: pontos manuais removidos.');
      const deleted=new Set([...markerPoints.keys(),
        ...[...correctedFrames.values()].flatMap(edits=>Object.keys(edits))]);
      if(freeMarker)deleted.add('free');
      for(const joint of deleted)if(joint!=='free')hiddenJoints.add(joint);
      markerPoints.clear();lostMarkers.clear();markerColors.clear();correctedFrames.clear();
      freeMarker=null;freeMarkerEpoch=null;placingFreeMarker=false;
      canvas.classList.remove('pose-placing-free');
      el('pose-marker-free').setAttribute('aria-pressed','false');
      if(originalLandmarks&&side){
        results=correctedMeasurement(originalLandmarks,side,frameSlot);
        publish(results,lastSource,false);
      }
      draw();closePoseDelete();
      status('Marcações manuais excluídas. O vídeo, a foto e a IA permanecem intactos.');
    }
    canvas.addEventListener('contextmenu',event=>{
      event.preventDefault();event.stopPropagation();
      showPoseDelete(jointAt(coordinateFromPointer(event)),event.clientX,event.clientY);
    });
    el('pose-delete-selected').addEventListener('click',event=>{
      const chosen=el('pose-manual-joint').value;
      const joint=manuallyMarked(chosen)?chosen:
        (freeMarker?'free':null);
      const rect=event.currentTarget.getBoundingClientRect();
      showPoseDelete(joint,rect.left,rect.bottom+5);
    });
    el('pose-delete-one').addEventListener('click',()=>deletePoseJoint(pendingDeleteJoint));
    el('pose-delete-all').addEventListener('click',deleteAllManual);
    el('pose-delete-cancel').addEventListener('click',closePoseDelete);
    document.addEventListener('pointerdown',event=>{
      if(!deleteMenu.hidden&&!deleteMenu.contains(event.target))closePoseDelete();
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!deleteMenu.hidden){event.preventDefault();closePoseDelete();}
    });
    canvas.addEventListener('pointerdown',event=>{
      if(!editing||event.button!==0)return;
      event.preventDefault();
      const p=coordinateFromPointer(event);
      // Quem escolheu uma articulação no menu deve poder marcar exatamente
      // aquela, mesmo que outra bolinha esteja a menos de 24 pixels.
      draggingJoint=(explicitSelected?el('pose-manual-joint').value:null)||
        nearestJoint(p)||el('pose-manual-joint').value;
      el('pose-manual-joint').value=draggingJoint;
      for(const button of panel.querySelectorAll('[data-pose-joint]'))
        button.setAttribute('aria-pressed',String(button.dataset.poseJoint===draggingJoint));
      try{canvas.setPointerCapture(event.pointerId);}catch(_){}
      moveJoint(draggingJoint,p);
    });
    canvas.addEventListener('pointermove',event=>{
      if(!editing||!draggingJoint)return;
      event.preventDefault();moveJoint(draggingJoint,coordinateFromPointer(event));
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])
      canvas.addEventListener(name,()=>{draggingJoint=null;explicitSelected=false;});
    el('pose-manual-joint').addEventListener('change',()=>{
      explicitSelected=true;
      for(const button of panel.querySelectorAll('[data-pose-joint]'))
        button.setAttribute('aria-pressed',String(button.dataset.poseJoint===el('pose-manual-joint').value));
      if(editing)draw();
    });
    el('pose-manual-labels').addEventListener('change',()=>{if(editing)draw();});
    el('pose-manual-clear').addEventListener('click',()=>{
      if(!frameSlot)return;
      correctedFrames.delete(frameSlot);
      hiddenJoints.clear();
      refreshManualPoints();status(analysisMode==='manual'?
        'Correções removidas deste quadro. Marque novamente os pontos desejados.':
        'Pontos originais da IA restaurados neste quadro.');
    });
    const aeroVideo=document.getElementById('aero-source-video');
    function applySpeed(){
      if(!aeroVideo)return;
      const speed=Number(el('pose-speed').value)||1;
      aeroVideo.defaultPlaybackRate=speed;
      aeroVideo.playbackRate=speed;
    }
    el('pose-speed').addEventListener('change',()=>{
      applySpeed();
      if(markerActive&&aeroVideo.playbackRate>.25)aeroVideo.playbackRate=.25;
      status('Reprodução em '+aeroVideo.playbackRate+'×. A velocidade não modifica os ângulos.');
    });
    aeroVideo?.addEventListener('loadedmetadata',applySpeed);
    el('pose-reset').addEventListener('click',()=>{
      if(markerActive)stopMarker('Rastreio manual parado para reiniciar os traçados.');
      markerPoints.clear();lostMarkers.clear();markerColors.clear();
      reset();draw();status('Rastros e ângulos extremos reiniciados. Correções manuais deste quadro preservadas.');
    });
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
        '   Pé/solo '+el('pose-foot').textContent+'   Variação tronco '+el('pose-trunk-delta').textContent,20,H+63);
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
      if(!panel.open){
        if(active){active=false;el('pose-toggle').textContent='▶ Continuar leitura';}
        if(markerActive)stopMarker('Rastreio manual pausado porque o painel foi fechado.');
        if(editing)exitEditing();
        if(placingFreeMarker){placingFreeMarker=false;canvas.classList.remove('pose-placing-free');
          el('pose-marker-free').setAttribute('aria-pressed','false');}
      }
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
