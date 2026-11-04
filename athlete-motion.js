/* PAIVA · rastreamento semiautomático 2D independente, por correspondência de textura.
   Para vídeo gravado, câmera fixa e referências visíveis. Confirmação manual obrigatória. */
(() => {
  'use strict';
  const WIDTH=640;
  const PATCH=5;
  const SEARCH=20;

  function grayscale(data) {
    const pixels=data.data;
    const gray=new Uint8Array(data.width*data.height);
    for (let i=0,j=0;i<pixels.length;i+=4,j++)
      gray[j]=Math.round(.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2]);
    return gray;
  }

  function trackPoint(before,after,w,h,at,patch=PATCH,search=SEARCH,minVariance=110,maxError=24) {
    const x=Math.round(at.x),y=Math.round(at.y);
    if (x-patch<0 || x+patch>=w || y-patch<0 || y+patch>=h) return null;
    // Rejeita tecidos/áreas sem textura. Prefira pequenas fitas ou marcadores contrastantes.
    let sum=0,sumSquared=0,count=0;
    for(let py=-patch;py<=patch;py++) for(let px=-patch;px<=patch;px++) {
      const value=before[(y+py)*w+x+px];
      sum+=value;sumSquared+=value*value;count++;
    }
    const variance=sumSquared/count-(sum/count)**2;
    if (variance<minVariance) return null;
    let best=Infinity,bestX=x,bestY=y;
    const minX=Math.max(patch,x-search),maxX=Math.min(w-patch-1,x+search);
    const minY=Math.max(patch,y-search),maxY=Math.min(h-patch-1,y+search);
    for(let cy=minY;cy<=maxY;cy++) for(let cx=minX;cx<=maxX;cx++) {
      let cost=0;
      for(let py=-patch;py<=patch;py++) {
        const prev=(y+py)*w+x-patch,now=(cy+py)*w+cx-patch;
        for(let px=0;px<2*patch+1;px++) {
          cost+=Math.abs(before[prev+px]-after[now+px]);
        }
        if(cost>=best) break;
      }
      if (cost<best) {best=cost;bestX=cx;bestY=cy;}
    }
    const averageError=best/count;
    if (averageError>maxError) return null;
    return {x:bestX,y:bestY,error:averageError};
  }

  // Verificação ida/volta: se a textura encontrada não retornar ao ponto de
  // origem, há ambiguidade ou o marcador se perdeu. Melhor interromper do
  // que desenhar um ângulo aparentemente preciso fora da articulação.
  function trackSafePoint(before,after,w,h,at) {
    const forward=trackPoint(before,after,w,h,at);
    if(!forward || forward.error>18)return null;
    const backward=trackPoint(after,before,w,h,forward);
    if(!backward || backward.error>18 || Math.hypot(backward.x-at.x,backward.y-at.y)>2)return null;
    return forward;
  }

  // O deslocamento de um calcanhar pode ser maior que o de um quadril por quadro.
  // Faz tentativas com janelas distintas e confirma ida/volta antes de aceitar.
  // Evita herdar um ponto errado indefinidamente; em caso de dúvida, pede correção.
  function trackCyclePoint(before,after,w,h,at) {
    let winner=null,score=Infinity;
    for(const [patch,search] of [[5,20],[7,28],[4,14]]){
      const forward=trackPoint(before,after,w,h,at,patch,search,38,30);
      if(!forward)continue;
      const backward=trackPoint(after,before,w,h,forward,patch,search,38,30);
      if(!backward)continue;
      const roundTrip=Math.hypot(backward.x-at.x,backward.y-at.y);
      if(roundTrip>4)continue;
      const candidateScore=forward.error+backward.error*.3+roundTrip*1.5;
      if(candidateScore<score){winner=forward;score=candidateScore;}
      // Uma correspondência quase perfeita e reversível dispensa outras janelas.
      if(candidateScore<=2)break;
    }
    return winner?{x:winner.x,y:winner.y,error:score}:null;
  }

  // Rastreio fino INDEPENDENTE do Kinovea: compara uma pequena janela de
  // textura com regiões próximas do quadro seguinte, usando correlação
  // normalizada. O usuário pode corrigir cada ponto e reiniciar pelo quadro
  // atual. Nenhum cálculo pressupõe uma volta completa da pedalada.
  function correlatePatch(before,after,w,h,at,patch,search) {
    const x=Math.round(at.x),y=Math.round(at.y);
    if(x-patch<0||x+patch>=w||y-patch<0||y+patch>=h)return null;
    const offsets=[],template=[];
    let mean=0,square=0;
    for(let dy=-patch;dy<=patch;dy++)for(let dx=-patch;dx<=patch;dx++){
      const value=before[(y+dy)*w+x+dx];
      offsets.push(dy*w+dx);template.push(value);mean+=value;square+=value*value;
    }
    const count=template.length,variance=square/count-(mean/count)**2;
    if(variance<22)return null; // textura insuficiente para distinguir a posição
    const minX=Math.max(patch,x-search),maxX=Math.min(w-patch-1,x+search);
    const minY=Math.max(patch,y-search),maxY=Math.min(h-patch-1,y+search);
    const templateVariance=Math.max(1,square-mean*mean/count);
    let candidate=null,best=Infinity;
    for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
      let sum=0,sumSq=0,cross=0;
      const base=cy*w+cx;
      for(let i=0;i<count;i++){
        const value=after[base+offsets[i]];
        sum+=value;sumSq+=value*value;cross+=template[i]*value;
      }
      const otherVariance=sumSq-sum*sum/count;
      if(otherVariance<1)continue;
      const correlation=(cross-mean*sum/count)/Math.sqrt(templateVariance*otherVariance);
      const distanceSq=(cx-x)**2+(cy-y)**2;
      // Penalização leve contra saltos para padrões semelhantes na roupa/bike.
      const cost=(1-correlation)+distanceSq*.00030;
      if(cost<best){best=cost;candidate={x:cx,y:cy,confidence:correlation,cost};}
    }
    return candidate;
  }

  function trackFinePoint(before,after,w,h,at,options={}) {
    const patch=Math.max(3,Math.min(10,Math.round(options.patch||6)));
    const search=Math.max(6,Math.min(42,Math.round(options.search||22)));
    let best=null,bestScore=Infinity;
    for(const size of [...new Set([patch,Math.min(12,patch+3),Math.max(3,patch-2)])]){
      const forward=correlatePatch(before,after,w,h,at,size,search);
      if(!forward||forward.confidence<.57)continue;
      const backward=correlatePatch(after,before,w,h,forward,size,search);
      if(!backward||backward.confidence<.53)continue;
      const returnError=Math.hypot(backward.x-at.x,backward.y-at.y);
      if(returnError>3.5)continue;
      const score=forward.cost+backward.cost*.3+returnError*.06;
      if(score<bestScore){bestScore=score;best={x:forward.x,y:forward.y,confidence:forward.confidence,returnError};}
      if(score<.04)break;
    }
    return best;
  }

  // Um ponto isolado nem sempre contém a mesma textura rica dos três marcos
  // do ângulo. Primeiro usamos correlação normalizada; quando ela falha,
  // tentamos a correspondência de brilho com ida/volta que já funciona no
  // rastreio curto de pedalada. Sem correspondência confiável, paramos.
  function trackRobustPoint(before,after,w,h,at,options={}){
    const fine=trackFinePoint(before,after,w,h,at,options);
    if(fine)return fine;
    const fallback=trackCyclePoint(before,after,w,h,at);
    if(!fallback||fallback.error>26)return null;
    return {x:fallback.x,y:fallback.y,method:'brightness',confidence:null};
  }

  // Rastreador opcional para plugs retrorefletivos: localiza um núcleo claro
  // isolado e verifica se ele volta ao mesmo ponto no quadro anterior.
  // É ativado apenas após o profissional escolher "Encaixar refletores".
  function brightMarker(gray,w,h,around,radius){
    const ring=11;
    const minX=Math.max(ring,Math.round(around.x-radius));
    const maxX=Math.min(w-ring-1,Math.round(around.x+radius));
    const minY=Math.max(ring,Math.round(around.y-radius));
    const maxY=Math.min(h-ring-1,Math.round(around.y+radius));
    let best=null,bestScore=-Infinity;
    for(let y=minY;y<=maxY;y+=2)for(let x=minX;x<=maxX;x+=2){
      const dist=Math.hypot(x-around.x,y-around.y);
      if(dist>radius)continue;
      const center=gray[y*w+x];
      if(center<195)continue;
      const background=(gray[y*w+x-ring]+gray[y*w+x+ring]+gray[(y-ring)*w+x]+gray[(y+ring)*w+x])/4;
      const contrast=center-background;
      if(contrast<48)continue;
      const score=contrast-dist*.35;
      if(score>bestScore){bestScore=score;best={x,y,contrast};}
    }
    if(!best)return null;
    let sumX=0,sumY=0,weight=0;
    for(let y=Math.max(0,best.y-3);y<=Math.min(h-1,best.y+3);y++)
      for(let x=Math.max(0,best.x-3);x<=Math.min(w-1,best.x+3);x++){
        const brightness=gray[y*w+x];
        if(brightness<185)continue;
        const v=brightness-175;
        sumX+=x*v;sumY+=y*v;weight+=v;
      }
    return weight?{x:sumX/weight,y:sumY/weight,contrast:best.contrast}:best;
  }
  function trackReflector(before,after,w,h,at,options={}){
    const source=brightMarker(before,w,h,at,7);
    if(!source||Math.hypot(source.x-at.x,source.y-at.y)>6)return null;
    const search=Math.max(12,Math.min(42,Number(options.search)||22));
    const found=brightMarker(after,w,h,source,search);
    if(!found)return null;
    const reverse=brightMarker(before,w,h,found,search);
    const error=reverse?Math.hypot(reverse.x-source.x,reverse.y-source.y):Infinity;
    if(error>3.5)return null;
    return {x:found.x,y:found.y,confidence:Math.min(1,found.contrast/110),
      returnError:error,method:'reflector'};
  }

  function trackFineShapes(before,after,w,h,annotations,sourceWidth,sourceHeight,options={}) {
    if(!before||!after||before.length!==w*h||after.length!==w*h)
      throw new Error('Os dois quadros devem possuir as mesmas dimensões.');
    const lost=[],moved=[];
    const shapes=annotations.map((item,i)=>({
      ...item,points:item.points.map((point,j)=>{
        if(item.trackEnabled===false||!['point','angle','line','full8'].includes(item.kind))return {...point};
        const scaled={x:point.x/sourceWidth*w,y:point.y/sourceHeight*h};
        let found=item.kind==='full8'&&item.reflectorMode?
          trackReflector(before,after,w,h,scaled,options):null;
        if(!found)found=item.kind==='point'?
          trackRobustPoint(before,after,w,h,scaled,options):
          trackFinePoint(before,after,w,h,scaled,options);
        if(!found){
          // Segunda tentativa apenas quando o alvo falhou: um pequeno
          // deslocamento maior entre quadros pode ultrapassar a busca padrão.
          // Exigimos confiança mais alta para não inventar o movimento.
          const patch=Math.max(4,Math.min(8,Number(options.patch)||6));
          const search=Math.min(42,Math.max(32,(Number(options.search)||22)+14));
          const rescue=item.kind==='point'?
            trackRobustPoint(before,after,w,h,scaled,{patch,search}):
            trackFinePoint(before,after,w,h,scaled,{patch,search});
          if(rescue?.confidence>=.68&&rescue.returnError<=3)found=rescue;
        }
        if(!found){lost.push({item:i,point:j});return {...point};}
        moved.push({item:i,point:j,confidence:found.confidence});
        return {x:found.x/w*sourceWidth,y:found.y/h*sourceHeight};
      })
    }));
    return {shapes,lost,moved};
  }

  function createFrameSampler(video,preferredWidth=1280){
    if(!video?.videoWidth||!video.videoHeight)throw new Error('Aguarde o vídeo carregar.');
    const width=Math.min(preferredWidth,Math.max(1,video.videoWidth));
    const height=Math.max(1,Math.round(width*video.videoHeight/video.videoWidth));
    const surface=document.createElement('canvas');surface.width=width;surface.height=height;
    const context=surface.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Não foi possível preparar a leitura do quadro.');
    return {width,height,sample(){
      context.drawImage(video,0,0,width,height);
      return grayscale(context.getImageData(0,0,width,height));
    }};
  }

  // Trajetória de UM marcador: não depende de ângulos nem assume uma volta da
  // pedalada. Nunca inventa a posição quando a textura deixa de corresponder.
  async function scanSinglePoint({video,point,sourceWidth,sourceHeight,startTime,
    duration=1,fps=30,patch=6,search=22,shouldCancel=()=>false,onProgress=()=>{}}){
    if(!video?.videoWidth||!video.videoHeight||!Number.isFinite(video.duration)||video.duration<=0)
      throw new Error('Abra um vídeo válido e aguarde o carregamento.');
    if(!point||!(sourceWidth>0&&sourceHeight>0))throw new Error('Marque um ponto sobre o atleta.');
    // Mais detalhe na amostra: até 1280 px, sem ampliar artificialmente vídeo
    // de resolução inferior. A foto capturada permanece em resolução maior.
    const sampler=createFrameSampler(video,1280);
    const {width,height}=sampler;
    const seek=target=>new Promise((resolve,reject)=>{
      const time=Math.max(0,Math.min(video.duration-.001,target));
      if(Math.abs(video.currentTime-time)<.0005&&video.readyState>=2){resolve();return;}
      let timer;
      const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail);};
      const done=()=>{cleanup();resolve();};
      const fail=()=>{cleanup();reject(new Error('O vídeo demorou a localizar um quadro. Confira o FPS.'));};
      video.addEventListener('seeked',done);video.addEventListener('error',fail);
      timer=setTimeout(fail,7000);
      try{video.currentTime=time;}catch(_){fail();}
    });
    const start=Math.max(0,Math.min(video.duration-.001,Number(startTime)||0));
    const end=Math.min(video.duration-.001,start+Math.max(.25,Math.min(3,Number(duration)||1)));
    const rate=Math.max(10,Math.min(60,Number(fps)||30));
    video.pause();await seek(start);
    let previous=sampler.sample();
    let current={x:point.x/sourceWidth*width,y:point.y/sourceHeight*height};
    const settings={patch,search};
    if(!trackRobustPoint(previous,previous,width,height,current,settings))
      throw new Error('Este ponto não tem contraste suficiente. Marque uma textura ou referência mais visível.');
    const path=[{x:point.x,y:point.y,time:start}];
    let partial=false,lostTime=null;
    const steps=Math.ceil((end-start)*rate);
    for(let n=1;n<=steps;n++){
      if(shouldCancel()){partial=true;break;}
      const time=Math.min(end,start+n/rate);
      if(time<=path[path.length-1].time+.0005)continue;
      await seek(time);
      if(shouldCancel()){partial=true;break;}
      const next=sampler.sample();
      const found=trackRobustPoint(previous,next,width,height,current,settings);
      if(!found){partial=true;lostTime=time;break;}
      current={x:found.x,y:found.y};previous=next;
      path.push({x:current.x/width*sourceWidth,y:current.y/height*sourceHeight,time});
      if(n%3===0||n===steps)onProgress({path:path.slice(),tested:path.length-1,total:steps});
    }
    if(path.length<2)throw new Error('O ponto se perdeu logo no começo. Ajuste o marcador e tente novamente.');
    if(shouldCancel())partial=true;
    await seek(path[path.length-1].time);
    return {path,partial,lostTime,width:sourceWidth,height:sourceHeight,
      startTime:start,endTime:path[path.length-1].time};
  }

  function create({video,annotations,sourceWidth,sourceHeight,isLoopEnabled,onPoints,onLost,onDone}) {
    if (!video || !video.videoWidth || !video.videoHeight || !annotations?.length)
      return {start:async()=>false,stop:()=>{}};
    const w=WIDTH,h=Math.max(1,Math.round(WIDTH*video.videoHeight/video.videoWidth));
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) return {start:async()=>false,stop:()=>{}};
    const scaled=annotations.map(item=>({kind:item.kind,color:item.color,role:item.role||'',supplementary:!!item.supplementary,reflectorMode:!!item.reflectorMode,points:item.points.map(p=>({
      x:p.x/sourceWidth*w,y:p.y/sourceHeight*h}))}));
    let running=false,previous=null,frameId=null,lastVideoTime=-1,lastSampleTime=-1;
    // Um ponto perdido não pode apagar os outros sete, nem a medida já vista.
    // Não o reencontramos automaticamente em quadros posteriores: ele exige
    // correção manual no quadro congelado, sem inventar ângulos novos.
    const uncertain=new Set();
    const uncertainPoints=()=>[...uncertain].map(token=>{
      const [item,point]=token.split(':').map(Number);return {item,point};
    });
    const sample=()=> {
      ctx.drawImage(video,0,0,w,h);
      return grayscale(ctx.getImageData(0,0,w,h));
    };
    function stop() {
      running=false;
      if(frameId!==null)cancelAnimationFrame(frameId);
      frameId=null;
    }
    function schedule() {
      if(!running)return;
      frameId=requestAnimationFrame(tick);
    }
    function tick() {
      if(!running)return;
      if(video.ended) {
        stop();onDone?.();return;
      }
      const time=video.currentTime;
      // O vídeo pode voltar diretamente ao início em modo replay. Os pontos
      // do último quadro não devem ser rastreados como se fossem do primeiro.
      // Encerra apenas o rastreio; o vídeo permanece reproduzindo em loop.
      if(isLoopEnabled?.() && lastVideoTime>=0 && time<lastVideoTime-0.05){
        stop();onDone?.();return;
      }
      if (video.paused || time===lastVideoTime ||
          (lastSampleTime>=0 && Math.abs(time-lastSampleTime)<.018)) {
        schedule();return;
      }
      if(lastVideoTime>=0 && Math.abs(time-lastVideoTime)>.22) {
        stop();video.pause();onLost?.('Houve salto de quadros. Reduza a velocidade de reprodução e marque os pontos novamente.');return;
      }
      lastVideoTime=time;lastSampleTime=time;
      let next;
      try{next=sample();}catch(_){stop();video.pause();onLost?.('Quadro não pôde ser analisado.');return;}
      const nextShapes=[];
      for(let i=0;i<scaled.length;i++) {
        const item=scaled[i];
        const pts=[];
        for(let j=0;j<item.points.length;j++) {
          const point=item.points[j],token=`${i}:${j}`;
          if(uncertain.has(token)){pts.push({...point});continue;}
          const found=(item.reflectorMode?trackReflector(previous,next,w,h,point,{search:22}):null)
            ||trackSafePoint(previous,next,w,h,point);
          if(!found) {
            uncertain.add(token);
            pts.push({...point});
            continue;
          }
          pts.push({x:found.x,y:found.y});
        }
        nextShapes.push({...item,points:pts});
      }
      scaled.splice(0,scaled.length,...nextShapes);
      previous=next;
      onPoints?.(nextShapes,w,h,time,uncertainPoints());
      schedule();
    }
    async function start() {
      if(running || video.ended || video.readyState<2)return false;
      try {previous=sample();}catch(_){onLost?.('Não foi possível ler o vídeo local.');return false;}
      uncertain.clear();
      for(let i=0;i<scaled.length;i++)for(let j=0;j<scaled[i].points.length;j++){
        const item=scaled[i],p=item.points[j];
        const initial=(item.reflectorMode?trackReflector(previous,previous,w,h,p,{search:14}):null);
        if(initial){item.points[j]={x:initial.x,y:initial.y};continue;}
        if(!trackPoint(previous,previous,w,h,p,5,0)) {
          uncertain.add(`${i}:${j}`);
        }
      }
      // Pintar SEMPRE o primeiro quadro, mesmo sem textura suficiente ou
      // quando o navegador ainda não iniciou a reprodução do vídeo.
      onPoints?.(scaled,w,h,video.currentTime,uncertainPoints());
      running=true;lastVideoTime=video.currentTime;lastSampleTime=-1;
      try{await video.play();}catch(_){stop();onLost?.('O navegador bloqueou a reprodução. Dê play e tente novamente.');return false;}
      schedule();return true;
    }
    return {start,stop};
  }

  // Busca curta EM TORNO de um quadro de referência manualmente marcado.
  // Cada direção inicia do mesmo ponto e utiliza verificações ida/volta por quadro.
  // Não detecta articulações; os resultados são apenas hipóteses para conferência.
  async function scanWindow({video,annotations,sourceWidth,sourceHeight,
    centerTime,radius=0.5,fps=30,shouldCancel=()=>false,onProgress=()=>{}}){
    if(!video?.videoWidth || !video.videoHeight || !annotations?.some(item=>item.kind==='angle'))
      throw new Error('Marque pelo menos um ângulo no quadro capturado.');
    if(!Number.isFinite(video.duration)||video.duration<=0)
      throw new Error('O vídeo ainda não informou sua duração.');
    const w=WIDTH,h=Math.max(1,Math.round(w*video.videoHeight/video.videoWidth));
    const surface=document.createElement('canvas');surface.width=w;surface.height=h;
    const ctx=surface.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Não foi possível preparar a análise local.');
    const sourceShapes=annotations.map(item=>({kind:item.kind,color:item.color,role:item.role||'',supplementary:!!item.supplementary,
      points:item.points.map(p=>({x:p.x/sourceWidth*w,y:p.y/sourceHeight*h}))}));
    const cloneShapes=shapes=>shapes.map(item=>({kind:item.kind,color:item.color,role:item.role,supplementary:item.supplementary,
      points:item.points.map(p=>({...p}))}));
    const angleValue=shapes=>{
      const first=shapes.find(item=>item.kind==='angle'&&item.points.length===3);
      if(!first)return null;
      const [a,b,c]=first.points;
      const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
      const ul=Math.hypot(ux,uy),vl=Math.hypot(vx,vy);
      if(ul<4||vl<4)return null;
      const degrees=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(ul*vl))))*180/Math.PI;
      return first.supplementary?180-degrees:degrees;
    };
    const sample=()=>{ctx.drawImage(video,0,0,w,h);return grayscale(ctx.getImageData(0,0,w,h));};
    const seek=target=>new Promise((resolve,reject)=>{
      if(shouldCancel()){reject(new Error('Busca interrompida.'));return;}
      const next=Math.max(0,Math.min(video.duration,target));
      if(Math.abs(video.currentTime-next)<0.0005 && video.readyState>=2){resolve();return;}
      let timer;
      const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail);};
      const done=()=>{cleanup();resolve();};
      const fail=()=>{cleanup();reject(new Error('Não foi possível buscar o quadro no arquivo.'));};
      video.addEventListener('seeked',done);video.addEventListener('error',fail);
      timer=setTimeout(()=>{cleanup();reject(new Error('O vídeo demorou para localizar o quadro. Tente outro arquivo ou FPS.'));},7000);
      try{video.currentTime=next;}catch(_){fail();}
    });
    video.pause();
    const center=Math.max(0,Math.min(video.duration,Number(centerTime)||0));
    await seek(center);
    const centralFrame=sample();
    for(const item of sourceShapes)for(const p of item.points)
      if(!trackPoint(centralFrame,centralFrame,w,h,p,PATCH,0))
        throw new Error('Um marcador está sem textura/contraste suficiente. Use uma referência visível e tente novamente.');
    const firstAngle=angleValue(sourceShapes);
    if(firstAngle===null)throw new Error('Confira os três pontos do ângulo antes de buscar a extensão.');
    let best={time:center,angle:firstAngle,shapes:cloneShapes(sourceShapes)};
    let tested=0,partial=false;
    const sampleRate=Math.max(10,Math.min(60,Number(fps)||30));
    const steps=Math.max(1,Math.ceil(Math.max(.1,Math.min(1,Number(radius)||.5))*sampleRate));
    for(const direction of [-1,1]){
      let previous=centralFrame;
      let currentShapes=cloneShapes(sourceShapes);
      let previousTime=center;
      for(let n=1;n<=steps;n++){
        if(shouldCancel())throw new Error('Busca interrompida.');
        const time=Math.max(0,Math.min(video.duration,center+direction*n/sampleRate));
        if(Math.abs(time-previousTime)<.0005)break;
        await seek(time);
        if(shouldCancel())throw new Error('Busca interrompida.');
        let pixels;
        try{pixels=sample();}catch(_){throw new Error('Não foi possível ler um quadro do vídeo.');}
        let lost=false;
        const updated=[];
        for(const item of currentShapes){
          const points=[];
          for(const p of item.points){
            const match=trackSafePoint(previous,pixels,w,h,p);
            if(!match){lost=true;break;}
            points.push({x:match.x,y:match.y});
          }
          if(lost)break;
          updated.push({...item,points});
        }
        if(lost){partial=true;break;}
        currentShapes=updated;previous=pixels;previousTime=time;tested++;
        const measured=angleValue(updated);
        if(measured!==null && measured>best.angle)
          best={time,angle:measured,shapes:cloneShapes(updated)};
        if(n%4===0)onProgress({tested,bestAngle:best.angle,bestTime:best.time});
      }
    }
    if(!tested)throw new Error('Nenhum quadro vizinho pôde ser rastreado com confiança. Reposicione os marcadores.');
    if(shouldCancel())throw new Error('Busca interrompida.');
    await seek(best.time);
    return {best,tested,partial,width:w,height:h,referenceTime:center};
  }

  // Rastreio finito de UM giro: começa no quadro marcado e procura a maior e
  // a menor abertura INTERNA do joelho, independentemente da exibição suplementar.
  // É semiautomático: correções feitas pelo profissional reiniciam a referência.
  async function scanCycle({video,annotations,sourceWidth,sourceHeight,startTime,
    duration=1,fps=30,shouldCancel=()=>false,onProgress=()=>{}}){
    if(!video?.videoWidth || !video.videoHeight)
      throw new Error('Carregue um vídeo antes de rastrear.');
    if(!Number.isFinite(video.duration)||video.duration<=0)
      throw new Error('Espere o vídeo terminar de carregar.');
    const chosen=annotations.find(a=>a.kind==='angle'&&a.points?.length===3);
    if(!chosen)throw new Error('Marque o ângulo com trocânter, côndilo e maléolo primeiro.');
    if(!(sourceWidth>0&&sourceHeight>0))throw new Error('Dimensões do quadro inválidas.');
    const w=WIDTH,h=Math.max(1,Math.round(w*video.videoHeight/video.videoWidth));
    const surface=document.createElement('canvas');surface.width=w;surface.height=h;
    const ctx=surface.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Não foi possível preparar o rastreamento neste navegador.');
    // Uma análise por vez: só o primeiro ângulo do joelho e os pontos de rastro.
    // Linhas auxiliares não devem provocar perda da análise.
    const tracked=[chosen,...annotations.filter(a=>a.kind==='point'&&a.points?.length===1)]
      .map(item=>({kind:item.kind,color:item.color,role:item.role||'',
        supplementary:!!item.supplementary,points:item.points.map(p=>({
          x:p.x/sourceWidth*w,y:p.y/sourceHeight*h}))}));
    const clone=items=>items.map(item=>({...item,points:item.points.map(p=>({...p}))}));
    const angleAt=items=>{
      const [a,b,c]=items[0].points;
      const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
      const l1=Math.hypot(ux,uy),l2=Math.hypot(vx,vy);
      if(l1<4||l2<4)return null;
      return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(l1*l2))))*180/Math.PI;
    };
    const sample=()=>{ctx.drawImage(video,0,0,w,h);return grayscale(ctx.getImageData(0,0,w,h));};
    const seek=target=>new Promise((resolve,reject)=>{
      if(shouldCancel())return reject(new Error('Rastreio interrompido.'));
      const time=Math.max(0,Math.min(video.duration-.001,target));
      if(Math.abs(video.currentTime-time)<.0005 && video.readyState>=2)return resolve();
      let timer;
      const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail);};
      const done=()=>{cleanup();resolve();};
      const fail=()=>{cleanup();reject(new Error('O navegador não conseguiu localizar o próximo quadro.'));};
      video.addEventListener('seeked',done);video.addEventListener('error',fail);
      timer=setTimeout(()=>{cleanup();reject(new Error('O vídeo demorou a localizar um quadro. Tente outra taxa de FPS.'));},7000);
      try{video.currentTime=time;}catch(_){fail();}
    });
    const start=Math.max(0,Math.min(video.duration-.001,Number(startTime)||0));
    const timeWindow=Math.max(.4,Math.min(2,Number(duration)||1));
    const sampleRate=Math.max(15,Math.min(60,Number(fps)||30));
    const reachesEnd=start+timeWindow>=video.duration;
    const end=Math.min(video.duration-.001,start+timeWindow);
    const steps=Math.max(1,Math.ceil((end-start)*sampleRate));
    video.pause();await seek(start);
    let previous=sample(),current=clone(tracked),tested=0,partial=reachesEnd;
    let lostTime=null,referenceTime=start,lastReliable=null;
    // Um marcador plano/sem textura não permite estimativa segura de deslocamento.
    for(const item of current)for(const point of item.points)
      if(!trackPoint(previous,previous,w,h,point,5,0,38,30))
        throw new Error('Um ponto não tem contraste suficiente. Ajuste no desenho ou use marcador visível.');
    const firstAngle=angleAt(current);
    if(firstAngle===null)throw new Error('Os três pontos do ângulo estão muito próximos.');
    const atFrame=(time,angle,items)=>({time,angle,shapes:clone(items)});
    let maximum=atFrame(start,firstAngle,current),minimum=atFrame(start,firstAngle,current);
    const frames=[atFrame(start,firstAngle,current)];
    for(let n=1;n<=steps;n++){
      if(shouldCancel())throw new Error('Rastreio interrompido.');
      const time=Math.min(end,start+n/sampleRate);
      if(time<=referenceTime+.0005)continue;
      await seek(time);
      if(shouldCancel())throw new Error('Rastreio interrompido.');
      let pixels;
      try{pixels=sample();}catch(_){throw new Error('Não foi possível ler o quadro do vídeo.');}
      const updated=[];
      let lost=false;
      for(const item of current){
        const points=[];
        for(const point of item.points){
          const found=trackCyclePoint(previous,pixels,w,h,point);
          if(!found){lost=true;break;}
          points.push({x:found.x,y:found.y});
        }
        if(lost)break;
        updated.push({...item,points});
      }
      if(lost){partial=true;lostTime=time;break;}
      const angle=angleAt(updated);
      if(angle===null){partial=true;lostTime=time;break;}
      current=updated;previous=pixels;referenceTime=time;tested++;
      const record=atFrame(time,angle,updated);
      frames.push(record);lastReliable=record;
      if(angle>maximum.angle)maximum=record;
      if(angle<minimum.angle)minimum=record;
      if(n%3===0||n===steps)
        onProgress({tested,step:n,total:steps,maximum:maximum.angle,minimum:minimum.angle});
    }
    if(tested<2)
      throw new Error('O rastreio perdeu a referência nos primeiros quadros. Reposicione os pontos e tente novamente.');
    const trackPath=role=>{
      const index=tracked.findIndex(item=>item.kind==='point'&&item.role===role);
      if(index<0)return [];
      return frames.map(frame=>({time:frame.time,...frame.shapes[index].points[0]}));
    };
    const hipPath=trackPath('hip');
    const heelPath=trackPath('heel');
    await seek(maximum.time);
    return {maximum,minimum,frames,tested,partial,lostTime,
      durationAnalyzed:referenceTime-start,targetDuration:timeWindow,
      lastReliable,width:w,height:h,startTime:start,
      supplementary:!!tracked[0].supplementary,hipPath,heelPath};
  }
  globalThis.PAIVA_MOTION_TRACKER={trackPoint,trackSafePoint,trackCyclePoint,trackFinePoint,trackRobustPoint,
    trackFineShapes,createFrameSampler,scanSinglePoint,grayscale,create,scanWindow,scanCycle};
})();
