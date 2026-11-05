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
    const top=contour.top[imageX]*canvasH/h;
    const bottom=contour.bottom[imageX]*canvasH/h;
    const leading=(direction===1?b.left:b.right)*canvasW/w;
    const trailing=(direction===1?b.right:b.left)*canvasW/w;
    const ahead=(direction===1?leading-x:x-leading);
    const after=(direction===1?x-trailing:trailing-x);
    const beforeFactor=ahead>0?clamp(1-ahead/120,0,1):1;
    const afterFactor=after>0?Math.exp(-after/145):1;
    const factor=beforeFactor*afterFactor;
    const padding=12+intensity*2;
    const globalTop=b.top*canvasH/h,globalBottom=b.bottom*canvasH/h;
    const globalCenter=(globalTop+globalBottom)/2;
    const side=y<globalCenter?-1:1;
    let displacement=0;
    if(y>=globalTop-60&&y<=globalBottom+60){
      const limit=side<0?top-padding:bottom+padding;
      if((side<0&&y>limit)||(side>0&&y<limit))
        displacement=(limit-y)*factor*.93;
    }
    const wake=after>0?
      Math.sin(after*.041-phase*.08)*12*intensity/3*
        Math.exp(-after/260)*clamp(1-Math.abs(y-globalCenter)/(canvasH*.55),0,1):0;
    return y+displacement+wake;
  }
  globalThis.PAIVA_AERO_CONTOUR={contourFromSegmentation,automaticWaveY};
})();
