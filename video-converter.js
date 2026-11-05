/* PAIVA · Conversão local opcional de vídeos antigos via FFmpeg/WebAssembly.
   O núcleo é carregado sob demanda; nenhum arquivo é enviado ao servidor. */
(() => {
  'use strict';
  const MAX_FILE_BYTES=250*1024*1024;
  const KNOWN=/\.(avi|mov|mp4|m4v|mkv|wmv|mts|m2ts|mpg|mpeg|webm)$/i;
  function initialize() {
    if(document.getElementById('paiva-video-converter'))return;
    // Mantém o conversor à vista, imediatamente antes da análise 2D,
    // mesmo quando a bancada de múltiplas câmeras também está instalada.
    const next=document.getElementById('paiva-athlete-2d') || document.getElementById('paiva-multi-camera');
    if(!next)return;
    const section=document.createElement('section');
    section.id='paiva-video-converter';section.className='card paiva-converter';
    section.innerHTML=`
      <div class="paiva-converter-heading">
        <div><span>BIBLIOTECA DE VÍDEOS</span><h2>CONVERSOR AVI / MOV / MP4 → MP4</h2></div>
        <button type="button" id="paiva-converter-help" aria-label="Como funciona a conversão" aria-expanded="false">?</button>
      </div>
      <div id="paiva-converter-explain" hidden>
        <p>MP4 compatível abre diretamente nos visores e na Análise Angular 2D. Se o vídeo antigo não reproduzir, escolha-o aqui e converta para MP4 com H.264. A conversão ocorre no próprio computador, sem upload.</p>
        <p>O motor de conversão é distribuído compactado (cerca de 10 MB) para funcionar com o envio pelo site do GitHub. Na primeira utilização com internet, ele é carregado e descompactado no próprio navegador; depois poderá funcionar offline se o cache permanecer disponível. A conversão usa processamento intenso e pode demorar. Para arquivos grandes, prefira um conversor instalado no Windows.</p>
        <p>O objetivo é preservar resolução e taxa de quadros originais. A reconversão pode produzir alguma perda de qualidade e não corrige problemas do vídeo original. Confira os pontos anatômicos e os instantes da pedalada antes de usar medidas.</p>
      </div>
      <div class="paiva-converter-body">
        <label>Vídeo do computador ou pendrive
          <input type="file" id="paiva-converter-file" accept="video/*,.avi,.mov,.mp4,.m4v,.mkv,.wmv,.mts,.m2ts,.mpg,.mpeg,.webm" />
        </label>
        <div class="paiva-converter-actions">
          <button type="button" id="paiva-converter-start" disabled>Converter para MP4 · H.264</button>
          <button type="button" id="paiva-converter-cancel" disabled>Cancelar conversão</button>
        </div>
        <p id="paiva-converter-status" aria-live="polite" role="status">Escolha um arquivo AVI, MOV ou MP4. O arquivo original será preservado.</p>
        <progress id="paiva-converter-progress" value="0" max="100" hidden></progress>
        <div class="paiva-converter-finish" id="paiva-converter-finish" hidden>
          <a id="paiva-converter-download">Baixar MP4 convertido</a>
          <button type="button" id="paiva-converter-analyze">Abrir na Análise 2D</button>
        </div>
      </div>`;
    next.before(section);
    // Atalho permanente na própria bancada: o conversor nunca deve parecer
    // ausente apenas porque ficou fora da janela de rolagem.
    const titleActions=document.querySelector('#paiva-athlete-2d .paiva-2d-title-actions');
    if(titleActions&&!document.getElementById('paiva-open-video-converter')){
      const shortcut=document.createElement('button');
      shortcut.type='button';
      shortcut.id='paiva-open-video-converter';
      shortcut.textContent='🎞 Conversor MP4';
      shortcut.title='Abrir conversor de vídeos AVI, MOV, MKV e MP4';
      shortcut.addEventListener('click',()=>{
        section.scrollIntoView({behavior:'smooth',block:'start'});
        const file=document.getElementById('paiva-converter-file');
        if(file)file.focus({preventScroll:true});
      });
      titleActions.append(shortcut);
    }
    const el=id=>document.getElementById('paiva-converter-'+id);
    const status=text=>el('status').textContent=text;
    let chosen=null,converted=null,downloadUrl=null,wasmBlobUrl=null,engine=null,busy=false,cancelled=false;
    let libraryPromise=null,lastLog='';

    async function loadLibrary() {
      if(globalThis.FFmpegWASM?.FFmpeg)return globalThis.FFmpegWASM.FFmpeg;
      if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src='./ffmpeg.js';script.async=true;
        script.onload=()=>globalThis.FFmpegWASM?.FFmpeg?resolve(globalThis.FFmpegWASM.FFmpeg):reject(new Error('Motor de conversão não disponível.'));
        script.onerror=()=>reject(new Error('O arquivo ffmpeg.js não está disponível no site. Envie também os arquivos do conversor ao GitHub e atualize a página.'));
        document.head.append(script);
      }).catch(error=>{libraryPromise=null;throw error;});
      return libraryPromise;
    }

    function refresh() {
      el('start').disabled=busy || !chosen;
      el('cancel').disabled=!busy;
      el('file').disabled=busy;
    }
    function clearOutput() {
      if(downloadUrl)URL.revokeObjectURL(downloadUrl);
      downloadUrl=null;converted=null;
      el('finish').hidden=true;el('download').removeAttribute('href');
    }
    el('help').addEventListener('click',()=>{
      const explain=el('explain');explain.hidden=!explain.hidden;
      el('help').setAttribute('aria-expanded',String(!explain.hidden));
    });
    el('file').addEventListener('change',event=>{
      chosen=event.target.files?.[0]||null;
      clearOutput();
      if(chosen && !KNOWN.test(chosen.name||'')){
        status('Selecione um arquivo AVI, MOV, MP4 ou outro formato de vídeo listado.');chosen=null;
      } else if(chosen && chosen.size>MAX_FILE_BYTES){
        status('Este arquivo ultrapassa 250 MB. Para preservar a memória do navegador, converta-o com um programa no Windows.');chosen=null;
      } else if(chosen)status(`Pronto para converter: ${chosen.name} (${(chosen.size/1048576).toFixed(1).replace('.',',')} MB).`);
      else status('Escolha um vídeo para converter.');
      refresh();
    });

    async function convert() {
      if(busy || !chosen)return;
      const original=chosen;
      cancelled=false;busy=true;lastLog='';clearOutput();refresh();
      el('progress').hidden=false;el('progress').value=0;
      try {
        status('Preparando o conversor local. Na primeira vez, aguarde o carregamento (~10 MB)…');
        const FFmpeg=await loadLibrary();
        if(cancelled)return;
        engine=new FFmpeg();
        engine.on('log',({message})=>{lastLog=message||lastLog;});
        engine.on('progress',({progress})=>{
          if(!busy||cancelled)return;
          const percent=Math.max(0,Math.min(99,Math.round(progress*100)));
          el('progress').value=percent;
          status(`Convertendo no computador · ${percent}% (estimativa). Não feche a página.`);
        });
        const base=new URL('./',document.baseURI);
        if(!('DecompressionStream' in globalThis))throw new Error('Seu navegador não suporta descompactação local. Atualize o Chrome ou Edge.');
        status('Descompactando o motor de vídeo no computador. Aguarde…');
        const compressed=await fetch(new URL('ffmpeg-core.wasm.gz',base));
        if(!compressed.ok || !compressed.body)throw new Error('Arquivo ffmpeg-core.wasm.gz não encontrado no GitHub (HTTP '+compressed.status+').');
        const wasmResponse=new Response(compressed.body.pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':'application/wasm'}});
        wasmBlobUrl=URL.createObjectURL(await wasmResponse.blob());
        await engine.load({coreURL:new URL('ffmpeg-core.js',base).href,wasmURL:wasmBlobUrl});
        URL.revokeObjectURL(wasmBlobUrl);wasmBlobUrl=null;
        if(cancelled)return;
        const extension=(original.name.match(/\.([a-z\d]+)$/i)?.[1]||'avi').toLowerCase();
        const inName=`paiva-original.${extension}`,outName='paiva-convertido.mp4';
        status('Lendo o vídeo. Os arquivos permanecem neste aparelho…');
        await engine.writeFile(inName,new Uint8Array(await original.arrayBuffer()));
        if(cancelled)return;
        status('Convertendo vídeo para H.264. Aguarde; pode levar alguns minutos…');
        const result=await engine.exec(['-i',inName,'-map','0:v:0','-an','-c:v','libx264','-preset','ultrafast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',outName]);
        if(cancelled)return;
        if(result!==0)throw new Error('O codec deste vídeo não foi convertido. '+(lastLog||'Experimente outro arquivo.'));
        const bytes=await engine.readFile(outName);
        if(!bytes?.byteLength)throw new Error('O conversor não produziu um arquivo válido.');
        const name=(original.name.replace(/\.[^.]+$/,'')||'video')+'_PAIVA.mp4';
        converted=new File([bytes],name,{type:'video/mp4'});
        downloadUrl=URL.createObjectURL(converted);
        const link=el('download');link.href=downloadUrl;link.download=name;
        el('finish').hidden=false;el('progress').value=100;
        status(`Conversão concluída: ${name}. Baixe o MP4 ou abra diretamente na Análise 2D.`);
      } catch(error) {
        if(!cancelled)status('Não foi possível converter este vídeo: '+(error?.message||'formato não reconhecido')+'. O arquivo original foi preservado.');
      } finally {
        if(engine){try{engine.terminate();}catch(_){}engine=null;}
        if(wasmBlobUrl){URL.revokeObjectURL(wasmBlobUrl);wasmBlobUrl=null;}
        busy=false;refresh();
        if(cancelled)status('Conversão cancelada. O arquivo original não foi alterado.');
      }
    }
    // Recorte temporal preciso, realizado inteiramente neste computador.
    // A reencodificação evita cortes imprecisos nos quadros-chave de MP4/AVI/MOV.
    async function trim(file,start,end,onProgress=()=>{}) {
      if(busy)throw new Error('O motor está ocupado com outra conversão. Aguarde o término.');
      if(!(file instanceof Blob)||!file.size)throw new Error('Carregue primeiro um vídeo.');
      if(file.size>MAX_FILE_BYTES)throw new Error('Limite de 250 MB por arquivo para proteger a memória do navegador.');
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)
        throw new Error('Marque início e fim diferentes (por exemplo, 00:10 até 02:00).');
      busy=true;cancelled=false;lastLog='';refresh();
      try {
        onProgress('Preparando o motor de recorte local…');
        const FFmpeg=await loadLibrary();
        engine=new FFmpeg();
        engine.on('log',({message})=>{lastLog=message||lastLog;});
        engine.on('progress',({progress})=>onProgress(`Recortando · ${Math.max(0,Math.min(99,Math.round(progress*100)))}% (estimativa). Não feche a página.`));
        if(!('DecompressionStream' in globalThis))throw new Error('Atualize o Chrome ou Edge para usar o motor de vídeo.');
        const base=new URL('./',document.baseURI);
        const compressed=await fetch(new URL('ffmpeg-core.wasm.gz',base));
        if(!compressed.ok||!compressed.body)throw new Error('Motor de vídeo não encontrado no site.');
        const decompressed=new Response(compressed.body.pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':'application/wasm'}});
        wasmBlobUrl=URL.createObjectURL(await decompressed.blob());
        await engine.load({coreURL:new URL('ffmpeg-core.js',base).href,wasmURL:wasmBlobUrl});
        URL.revokeObjectURL(wasmBlobUrl);wasmBlobUrl=null;
        const originalName=file.name||'video.mp4';
        const extension=(originalName.match(/\.([a-z\d]+)$/i)?.[1]||'mp4').toLowerCase();
        const source=`paiva-entrada.${extension}`,destination='paiva-recorte.mp4';
        await engine.writeFile(source,new Uint8Array(await file.arrayBuffer()));
        onProgress('Processando o intervalo selecionado…');
        const result=await engine.exec(['-ss',start.toFixed(3),'-i',source,
          '-t',(end-start).toFixed(3),'-map','0:v:0','-an',
          '-c:v','libx264','-preset','ultrafast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',destination]);
        if(result!==0)throw new Error('Não foi possível processar o trecho. '+(lastLog||'Verifique o codec.'));
        const bytes=await engine.readFile(destination);
        if(!bytes?.byteLength)throw new Error('Não foi produzido um recorte válido.');
        const name=(originalName.replace(/\.[^.]+$/,'')||'video')+'_PAIVA_'+Math.round(start)+'-'+Math.round(end)+'s.mp4';
        onProgress('Recorte pronto. O vídeo original permanece intacto.');
        return new File([bytes],name,{type:'video/mp4'});
      }finally {
        if(engine){try{engine.terminate();}catch(_){}engine=null;}
        if(wasmBlobUrl){URL.revokeObjectURL(wasmBlobUrl);wasmBlobUrl=null;}
        busy=false;refresh();
      }
    }
    globalThis.PAIVA_VIDEO_CONVERTER={trim};
    el('start').addEventListener('click',convert);
    el('cancel').addEventListener('click',()=>{
      cancelled=true;
      if(engine){try{engine.terminate();}catch(_){}engine=null;}
      status('Interrompendo conversão…');
    });
    el('analyze').addEventListener('click',()=>{
      if(!converted)return;
      const app=globalThis.PAIVA_ATHLETE_2D;
      if(!app?.openVideo){status('Análise 2D não encontrada. Atualize todos os arquivos do PAIVA.');return;}
      app.openVideo(converted,converted.name);
    });
    window.addEventListener('pagehide',()=>{
      cancelled=true;if(engine)try{engine.terminate();}catch(_){}
      if(wasmBlobUrl)URL.revokeObjectURL(wasmBlobUrl);
      if(downloadUrl)URL.revokeObjectURL(downloadUrl);
    });
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
