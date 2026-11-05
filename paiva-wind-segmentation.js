/* PAIVA Aero V5.34 — medição exclusiva de pixels da imagem.
   Não estima área em m², Cd, CdA, arrasto nem watts. */
(() => {
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function segmentPixels(current,background,opts={}){
    const width=current?.width|0,height=current?.height|0,data=current?.data;
    if(!width||!height||!data||data.length<width*height*4)
      throw new Error('Imagem inválida para análise da silhueta.');
    const mode=opts.mode==='wall'?'wall':'green';
    if(mode==='wall'&&(!background||background.width!==width||background.height!==height||
      !background.data||background.data.length<data.length))
      throw new Error('Capture ou importe primeiro a foto da parede VAZIA, com a câmera imóvel.');
    const threshold=clamp(Number(opts.threshold)||36,12,110);
    const roi=opts.roi||{left:0,top:0,right:1,bottom:1};
    const x0=clamp(Math.floor(roi.left*width),0,width-1);
    const x1=clamp(Math.ceil(roi.right*width),x0+1,width);
    const y0=clamp(Math.floor(roi.top*height),0,height-1);
    const y1=clamp(Math.ceil(roi.bottom*height),y0+1,height);
    const mask=new Uint8Array(width*height);
    let occupied=0,total=0,greenCount=0;
    let minX=width,minY=height,maxX=0,maxY=0;
    for(let y=y0;y<y1;y++){
      for(let x=x0;x<x1;x++){
        const i=y*width+x,p=i*4;
        const r=data[p],g=data[p+1],b=data[p+2];
        const isGreen=g>65&&g-r>threshold*.76&&g-b>threshold*.58&&
          g>r*1.16&&g>b*1.08;
        if(isGreen)greenCount++;
        let subject;
        if(mode==='green')subject=!isGreen;
        else {
          const br=background.data[p],bg=background.data[p+1],bb=background.data[p+2];
          // Distância cromática média por canal. Fundo fixo, exposição estável.
          const diff=(Math.abs(r-br)+Math.abs(g-bg)+Math.abs(b-bb))/3;
          subject=diff>threshold;
        }
        if(subject){
          occupied++;mask[i]=1;
          if(x<minX)minX=x;
          if(y<minY)minY=y;
          if(x>maxX)maxX=x;
          if(y>maxY)maxY=y;
        }
        total++;
      }
    }
    const fraction=total?occupied/total:0;
    const greenShare=total?greenCount/total:0;
    const warning=mode==='green'&&greenShare<.2?
      'Não foi detectada área verde suficiente. Use fundo verde bem iluminado ou Parede comum.':
      fraction>.82?'O recorte ocupou quase toda a área. Confira o fundo e delimite melhor a região.':'';
    return {
      mask,width,height,occupied,total,percent:fraction*100,greenShare,warning,
      bounds:occupied?{left:minX,top:minY,right:maxX,bottom:maxY}:null
    };
  }
  globalThis.PAIVA_WIND_SEGMENT={segmentPixels};
})();
