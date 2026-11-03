/* PAIVA · Rastreamento EXPERIMENTAL de pontos 2D por correspondência de textura.
   Para vídeo gravado e câmera fixa. Não substitui rastreio cinemático validado. */
(() => {
  'use strict';
  const WIDTH=480;
  const PATCH=5;
  const SEARCH=15;

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

  function create({video,annotations,sourceWidth,sourceHeight,onPoints,onLost,onDone}) {
    if (!video || !video.videoWidth || !video.videoHeight || !annotations?.length)
      return {start:async()=>false,stop:()=>{}};
    const w=WIDTH,h=Math.max(1,Math.round(WIDTH*video.videoHeight/video.videoWidth));
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) return {start:async()=>false,stop:()=>{}};
    const scaled=annotations.map(item=>({kind:item.kind,points:item.points.map(p=>({
      x:p.x/sourceWidth*w,y:p.y/sourceHeight*h}))}));
    let running=false,previous=null,frameId=null,lastVideoTime=-1,lastSampleTime=-1;
    const sample=()=> {
      ctx.drawImage(video,0,0,w,h);
      return grayscale(ctx.getImageData(0,0,w,h));
    };
    function stop() {
      running=false;
      if(frameId!==null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameId);
      frameId=null;
    }
    function schedule() {
      if(!running)return;
      if(video.requestVideoFrameCallback) frameId=video.requestVideoFrameCallback(tick);
      else frameId=requestAnimationFrame(tick);
    }
    function tick() {
      if(!running)return;
      if(video.ended) {stop();onDone?.();return;}
      const time=video.currentTime;
      if (video.paused || time===lastVideoTime || (lastSampleTime>=0 && time-lastSampleTime<.055)) {
        schedule();return;
      }
      lastVideoTime=time;lastSampleTime=time;
      let next;
      try{next=sample();}catch(_){stop();video.pause();onLost?.('Quadro não pôde ser analisado.');return;}
      const nextShapes=[];
      for(const item of scaled) {
        const pts=[];
        for(const point of item.points) {
          const found=trackPoint(previous,next,w,h,point);
          if(!found) {
            stop();video.pause();onLost?.('O rastreio perdeu um marcador. Pause, capture outro quadro e reposicione os pontos.');return;
          }
          pts.push({x:found.x,y:found.y});
        }
        nextShapes.push({kind:item.kind,points:pts});
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
  globalThis.PAIVA_MOTION_TRACKER={trackPoint,grayscale,create};
})();
