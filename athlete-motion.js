/* PAIVA · Rastreamento EXPERIMENTAL de pontos 2D por correspondência de textura.
   Para vídeo gravado e câmera fixa. Não substitui rastreio cinemático validado. */
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

  function trackPoint(before,after,w,h,at,patch=PATCH,search=SEARCH) {
    const x=Math.round(at.x),y=Math.round(at.y);
    if (x-patch<0 || x+patch>=w || y-patch<0 || y+patch>=h) return null;
    // Rejeita tecidos/áreas sem textura. Prefira pequenas fitas ou marcadores contrastantes.
    let sum=0,sumSquared=0,count=0;
    for(let py=-patch;py<=patch;py++) for(let px=-patch;px<=patch;px++) {
      const value=before[(y+py)*w+x+px];
      sum+=value;sumSquared+=value*value;count++;
    }
    const variance=sumSquared/count-(sum/count)**2;
    if (variance<110) return null;
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
    if (averageError>24) return null;
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

  function create({video,annotations,sourceWidth,sourceHeight,isReversePlaying,isPingPongEnabled,onPoints,onLost,onDone}) {
    if (!video || !video.videoWidth || !video.videoHeight || !annotations?.length)
      return {start:async()=>false,stop:()=>{}};
    const w=WIDTH,h=Math.max(1,Math.round(WIDTH*video.videoHeight/video.videoWidth));
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) return {start:async()=>false,stop:()=>{}};
    const scaled=annotations.map(item=>({kind:item.kind,color:item.color,supplementary:!!item.supplementary,points:item.points.map(p=>({
      x:p.x/sourceWidth*w,y:p.y/sourceHeight*h}))}));
    let running=false,previous=null,frameId=null,lastVideoTime=-1,lastSampleTime=-1;
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
        if(isPingPongEnabled?.()) {schedule();return;}
        stop();onDone?.();return;
      }
      const time=video.currentTime;
      if ((video.paused&&!isReversePlaying?.()) || time===lastVideoTime ||
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
      for(const item of scaled) {
        const pts=[];
        for(const point of item.points) {
          const found=trackSafePoint(previous,next,w,h,point);
          if(!found) {
            stop();video.pause();onLost?.('Um marcador ficou ambíguo ou se afastou. O rastreio foi interrompido por segurança; capture outro quadro e reposicione os pontos.');return;
          }
          pts.push({x:found.x,y:found.y});
        }
        nextShapes.push({kind:item.kind,color:item.color,supplementary:item.supplementary,points:pts});
      }
      scaled.splice(0,scaled.length,...nextShapes);
      previous=next;
      onPoints?.(nextShapes,w,h,time);
      schedule();
    }
    async function start() {
      if(running || video.ended || video.readyState<2)return false;
      try {previous=sample();}catch(_){onLost?.('Não foi possível ler o vídeo local.');return false;}
      for(const item of scaled)for(const p of item.points)
        if(!trackPoint(previous,previous,w,h,p,5,0)) {
          onLost?.('Algum ponto tem pouco contraste. Coloque os marcadores sobre referências visíveis e tente novamente.');
          return false;
        }
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
    const sourceShapes=annotations.map(item=>({kind:item.kind,color:item.color,supplementary:!!item.supplementary,
      points:item.points.map(p=>({x:p.x/sourceWidth*w,y:p.y/sourceHeight*h}))}));
    const cloneShapes=shapes=>shapes.map(item=>({kind:item.kind,color:item.color,supplementary:item.supplementary,
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
  globalThis.PAIVA_MOTION_TRACKER={trackPoint,trackSafePoint,grayscale,create,scanWindow};
})();
