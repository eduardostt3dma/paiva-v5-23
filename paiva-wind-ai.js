/* PAIVA AERO V5.44 — recorte semântico no dispositivo.
   DeepLab V3 / MediaPipe reconhece PESSOA e BICICLETA separadamente.
   O modelo é carregado sob demanda; nenhuma foto é enviada para um servidor.
   O vento permanece uma visualização ilustrativa, nunca CFD ou CdA. */
(() => {
  'use strict';

  const MODEL='https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite';
  const PACKAGE='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs';
  const WASM='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';
  const target=/^(person|people|human|bicycle|bike)$/i;
  let pending=null,segmenter=null;

  function semanticMask(classes,labels,width,height){
    const w=Number(width)|0,h=Number(height)|0;
    if(w<4||h<4||classes?.length!==w*h||!Array.isArray(labels))
      throw Error('A IA devolveu um recorte incompleto.');
    const selected=new Set();
    let personId=-1,bicycleId=-1;
    labels.forEach((label,id)=>{
      const name=String(label).trim().toLowerCase();
      if(target.test(name))selected.add(id);
      if(name==='person')personId=id;
      if(name==='bicycle')bicycleId=id;
    });
    if(personId<0||bicycleId<0||selected.size<2)
      throw Error('Modelo incompatível: faltam as categorias pessoa e bicicleta.');

    const raw=new Uint8Array(w*h);
    const personMask=new Uint8Array(w*h);
    let person=0,bicycle=0;
    for(let i=0;i<classes.length;i++){
      const category=classes[i];
      if(category===personId){person++;personMask[i]=1;}
      if(category===bicycleId)bicycle++;
      raw[i]=selected.has(category)?1:0;
    }
    // A ausência de pessoa é um alerta: não usar postes, paredes e móveis
    // como suposta geometria de um ciclista.
    if(person<w*h*.006)
      throw Error('IA não encontrou o ciclista. Tente uma imagem mais nítida.');
    if(person+bicycle>w*h*.78)
      throw Error('IA detectou uma área grande demais. Confira o enquadramento.');

    // Preenche falhas isoladas de 1 px sem transformar o fundo em obstáculo.
    const mask=new Uint8Array(raw);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;
      if(raw[i])continue;
      const neighbors=raw[i-1]+raw[i+1]+raw[i-w]+raw[i+w];
      if(neighbors>=3)mask[i]=1;
    }
    return {width:w,height:h,mask,personMask,mode:'semantic',personPixels:person,
      bicyclePixels:bicycle,percent:(person+bicycle)/(w*h)};
  }

  async function load(){
    if(segmenter)return segmenter;
    if(!pending){
      pending=(async()=>{
        const module=await import(PACKAGE);
        if(!module?.FilesetResolver||!module?.ImageSegmenter)
          throw Error('Biblioteca de reconhecimento incompleta.');
        const files=await module.FilesetResolver.forVisionTasks(WASM);
        segmenter=await module.ImageSegmenter.createFromOptions(files,{
          baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},
          runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false
        });
        if(!segmenter.getLabels().some(s=>String(s).toLowerCase()==='bicycle'))
          throw Error('O modelo instalado não reconhece bicicletas.');
        return segmenter;
      })().catch(error=>{pending=null;segmenter=null;throw error;});
    }
    return pending;
  }

  async function segment(source){
    const model=await load();
    let result=null;
    try{
      // A API gera a máscara na resolução da imagem de entrada.
      result=model.segment(source);
      const categoryMask=result?.categoryMask;
      if(!categoryMask)throw Error('A IA não produziu um recorte.');
      const pixels=categoryMask.getAsUint8Array();
      return semanticMask(pixels,model.getLabels(),categoryMask.width,
        categoryMask.height);
    }finally{
      result?.categoryMask?.close?.();
      for(const m of result?.confidenceMasks||[])m?.close?.();
    }
  }

  globalThis.PAIVA_WIND_AI={load,segment,semanticMask};
})();
