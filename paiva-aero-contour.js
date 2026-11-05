/* PAIVA AERO — contorno obtido de pixels, independente do motor 2D.
   O desvio é GRÁFICO. Não resolve Navier–Stokes nem estima CdA. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function contourFromSegmentation(result){
    const w=result?.width|0,h=result?.height|0,source=result?.mask;
    if(w<3||h<3||!source||source.length<w*h)return null;
    const visited=new Uint8Array(w*h),kept=new Uint8Array(w*h);
    const queue=new Int32Array(w*h);
    const minCount=Math.max(18,Math.ceil(w*h*.0008));
    const centralCandidates=[];
    for(let start=0;start<source.length;start++){
      if(!source[start]||visited[start])continue;
      let head=0,tail=1;
      let sumX=0,sumY=0;
      queue[0]=start;visited[start]=1;
      while(head<tail){
        const index=queue[head++],x=index%w,y=Math.floor(index/w);
        sumX+=x;sumY+=y;
        const left=index-1,right=index+1,up=index-w,down=index+w;
        if(x>0&&source[left]&&!visited[left]){
          visited[left]=1;queue[tail++]=left;
        }
        if(x<w-1&&source[right]&&!visited[right]){
          visited[right]=1;queue[tail++]=right;
        }
        if(y>0&&source[up]&&!visited[up]){
          visited[up]=1;queue[tail++]=up;
        }
        if(y<h-1&&source[down]&&!visited[down]){
          visited[down]=1;queue[tail++]=down;
        }
      }
      if(tail>=minCount){
        if(result.mode==='auto'){
          centralCandidates.push({indices:queue.slice(0,tail),size:tail,
            x:sumX/tail,y:sumY/tail});
        }else for(let i=0;i<tail;i++)kept[queue[i]]=1;
      }
    }
    if(result.mode==='auto'&&centralCandidates.length){
      // Em fotos comuns, luminosos, logos e objetos periféricos podem ter
      // mais contraste que o ciclista. Priorizar agrupamentos centrais sem
      // declarar que essa seleção equivale a reconhecimento anatômico.
      const score=item=>item.size*Math.exp(-Math.pow((item.x-w*.5)/(w*.19),2));
      const anchor=centralCandidates.reduce((best,item)=>
        !best||score(item)>score(best)?item:best,null);
      for(const item of centralCandidates){
        if(Math.abs(item.x-anchor.x)>w*.17)continue;
        for(const index of item.indices)kept[index]=1;
      }
    }
    const top=new Float32Array(w),bottom=new Float32Array(w);
    top.fill(NaN);bottom.fill(NaN);
    let left=w,right=-1,highest=h,lowest=-1,pixels=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(!kept[y*w+x])continue;
      pixels++;
      if(x<left)left=x;if(x>right)right=x;
      if(y<highest)highest=y;if(y>lowest)lowest=y;
      if(Number.isNaN(top[x])||y<top[x])top[x]=y;
      if(Number.isNaN(bottom[x])||y>bottom[x])bottom[x]=y;
    }
    if(pixels<minCount*2||right<=left)return null;
    // Janela de colunas vizinhas reduz serrilhado e pequenos vazios.
    const smoothTop=new Float32Array(w),smoothBottom=new Float32Array(w);
    const valid=new Uint8Array(w);
    for(let x=0;x<w;x++){
      let t=h,b=-1;
      for(let nx=Math.max(left,x-6);nx<=Math.min(right,x+6);nx++){
        if(nx<0||nx>=w||Number.isNaN(top[nx]))continue;
        if(top[nx]<t)t=top[nx];
        if(bottom[nx]>b)b=bottom[nx];
      }
      smoothTop[x]=t<h?t:highest;
      smoothBottom[x]=b>=0?b:lowest;
      valid[x]=t<h&&b>=0?1:0;
    }
    return {mask:kept,width:w,height:h,pixels,top:smoothTop,bottom:smoothBottom,
      valid,bounds:{left,right,top:highest,bottom:lowest}};
  }
  function automaticWaveY(x,y,contour,phase=0,intensity=3,direction=1,
    canvasW=960,canvasH=540,proximity=4){
    if(!contour)return y;
    const {width:w,height:h,bounds:b}=contour;
    if(!b)return y;
    const leading=(direction===1?b.left:b.right)*canvasW/w;
    const trailing=(direction===1?b.right:b.left)*canvasW/w;
    const progress=(x-leading)*(direction===1?1:-1);
    const span=Math.abs(trailing-leading);
    // Frente da bicicleta: só curvar quando a linha chega perto do
    // obstáculo. Um deslocamento longo ANTES da roda parecia vento caindo.
    const approach=16;
    if(progress< -approach)return y;
    const approachUnit=clamp((progress+approach)/approach,0,1);
    const entrance=approachUnit*approachUnit*(3-2*approachUnit);
    const after=progress-span;
    const exit=after>0?Math.exp(-after/(105+intensity*9)):1;
    const influence=entrance*exit;
    const padding=clamp(10-(clamp(proximity,1,5)-1)*2,2,10);
    let imageX=clamp(Math.round(x*w/canvasW),b.left,b.right);
    // Em intervalos vazios (ex.: entre a cabeça e o guidão), não use o
    // retângulo global como obstáculo. Procure apenas uma borda próxima.
    if(contour.valid&&!contour.valid[imageX]){
      let nearest=-1;
      for(let offset=1;offset<=8;offset++){
        if(imageX-offset>=b.left&&contour.valid[imageX-offset]){
          nearest=imageX-offset;break;
        }
        if(imageX+offset<=b.right&&contour.valid[imageX+offset]){
          nearest=imageX+offset;break;
        }
      }
      if(nearest>=0)imageX=nearest;
    }
    const localTop=contour.top[imageX]*canvasH/h;
    const localBottom=contour.bottom[imageX]*canvasH/h;
    const topEdge=localTop-padding,bottomEdge=localBottom+padding;
    let displacement=0;
    if(y>topEdge&&y<bottomEdge&&
      (!contour.valid||contour.valid[imageX])){
      const target=(y-topEdge<=bottomEdge-y)?topEdge:bottomEdge;
      // Não tentar transportar uma linha inteira até a outra extremidade
      // do corpo: a área interna fica oclusa pela máscara da IA. Borda
      // próxima + pequeno desvio = onda visual estável, quase horizontal.
      const maximal=8+clamp(intensity,1,5)*1.8;
      displacement=clamp(target-y,-maximal,maximal)*influence;
    }
    const globalCenter=(b.top+b.bottom)*.5*canvasH/h;
    const wake=after>0?
      Math.sin(after*.041-phase*.08)*3*intensity/3*
        Math.exp(-after/210)*clamp(1-Math.abs(y-globalCenter)/(canvasH*.55),0,1):0;
    return y+displacement+wake;
  }
  globalThis.PAIVA_AERO_CONTOUR={contourFromSegmentation,automaticWaveY};
})();
