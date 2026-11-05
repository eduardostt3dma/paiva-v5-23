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
    for(let start=0;start<source.length;start++){
      if(!source[start]||visited[start])continue;
      let head=0,tail=1;
      queue[0]=start;visited[start]=1;
      while(head<tail){
        const index=queue[head++],x=index%w,y=Math.floor(index/w);
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
      if(tail>=minCount)for(let i=0;i<tail;i++)kept[queue[i]]=1;
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
    for(let x=0;x<w;x++){
      let t=h,b=-1;
      for(let nx=Math.max(left,x-6);nx<=Math.min(right,x+6);nx++){
        if(nx<0||nx>=w||Number.isNaN(top[nx]))continue;
        if(top[nx]<t)t=top[nx];
        if(bottom[nx]>b)b=bottom[nx];
      }
      smoothTop[x]=t<h?t:highest;
      smoothBottom[x]=b>=0?b:lowest;
    }
    return {mask:kept,width:w,height:h,pixels,top:smoothTop,bottom:smoothBottom,
      bounds:{left,right,top:highest,bottom:lowest}};
  }
  function automaticWaveY(x,y,contour,phase=0,intensity=3,direction=1,
    canvasW=960,canvasH=540){
    if(!contour)return y;
    const {width:w,height:h,bounds:b}=contour;
    const imageX=clamp(Math.round(x*w/canvasW),0,w-1);
    const localTop=contour.top[imageX]*canvasH/h;
    const localBottom=contour.bottom[imageX]*canvasH/h;
    const leading=(direction===1?b.left:b.right)*canvasW/w;
    const trailing=(direction===1?b.right:b.left)*canvasW/w;
    const progress=(x-leading)*(direction===1?1:-1);
    const span=Math.abs(trailing-leading);
    const approach=145;
    const approachUnit=clamp((progress+approach)/approach,0,1);
    // Desvio contínuo: o ar começa a contornar ANTES de chegar ao ciclista,
    // permanece fora do envelope detectado e volta depois da passagem.
    const entrance=approachUnit*approachUnit*(3-2*approachUnit);
    const after=progress-span;
    const exit=after>0?Math.exp(-after/(165+intensity*12)):1;
    const influence=entrance*exit;
    const padding=10+intensity*2;
    const globalTop=b.top*canvasH/h,globalBottom=b.bottom*canvasH/h;
    const globalCenter=(globalTop+globalBottom)/2;
    const side=y<globalCenter?-1:1;
    let displacement=0;
    if(y>globalTop-padding&&y<globalBottom+padding){
      // O contorno local dá uma curva sutil; a borda global evita que
      // linhas e partículas atravessem partes desconexas da bicicleta.
      const topEdge=globalTop*.72+localTop*.28-padding;
      const bottomEdge=globalBottom*.72+localBottom*.28+padding;
      const spread=Math.abs(y-globalCenter)*.10;
      const target=side<0?topEdge-spread:bottomEdge+spread;
      displacement=(target-y)*influence;
    }
    const wake=after>0?
      Math.sin(after*.041-phase*.08)*12*intensity/3*
        Math.exp(-after/260)*clamp(1-Math.abs(y-globalCenter)/(canvasH*.55),0,1):0;
    return y+displacement+wake;
  }
  globalThis.PAIVA_AERO_CONTOUR={contourFromSegmentation,automaticWaveY};
})();
