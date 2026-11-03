/* PAIVA · Dois visores, até seis fontes de webcam selecionáveis (máximo de duas
   ativas, uma gravação de cada vez). Arquivos permanecem apenas no aparelho. */
(() => {
  'use strict';
  const MAX_CAMERAS=6;
  const RECORD_LIMIT_MS=180000;
  const VIEWS=[
    ['right','Lateral direita'],['left','Lateral esquerda'],
    ['front','Frontal'],['back','Posterior'],
    ['top','Superior'],['detail','Detalhe adicional']
  ];
  const labels={a:'VISOR A',b:'VISOR B'};
  function supportedVideo(file) {
    return !!file && (String(file.type||'').startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|avi)$/i.test(file.name||''));
  }
  function formatTime(ms) {
    const secs=Math.round(ms/1000);
    return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
  }
  function initialize() {
    if (document.getElementById('paiva-multi-camera')) return;
    const analysis=document.getElementById('paiva-athlete-2d');
    if (!analysis) return;
    const section=document.createElement('section');
    section.id='paiva-multi-camera';
    section.className='card paiva-multi-camera';
    section.innerHTML=`
      <div class="paiva-multi-heading">
        <div><span>ESTAÇÃO DE CAPTAÇÃO</span><h2>VÍDEO 2D · DOIS VISORES</h2></div>
        <button type="button" id="paiva-multi-help" aria-expanded="false" aria-label="Entender as câmeras">?</button>
      </div>
      <div id="paiva-multi-explain" hidden>
        <p>Você pode ligar até seis webcams USB ao Windows e escolher uma para cada visor. O aplicativo utiliza, no máximo, <strong>duas webcams abertas</strong> e grava <strong>um visor por vez</strong>. As vistas desejadas são: lateral direita, lateral esquerda, frente, trás e superior; a sexta é opcional para detalhes de pedal ou pé.</p>
        <p>O reconhecimento das webcams depende da permissão do navegador, das portas USB, da capacidade do computador e dos drivers. Uma câmera não cobre todo o entorno; as cinco vistas são captações independentes, não uma imagem esférica 360°.</p>
        <p>Cada gravação termina automaticamente em até 3 minutos, sem áudio. Salve os vídeos antes de sair. Você também pode abrir um vídeo antigo do computador ou pendrive em qualquer visor e enviá-lo à ferramenta de Análise Angular 2D. Os arquivos não são enviados ao GitHub.</p>
      </div>
      <div class="paiva-multi-discovery">
        <button type="button" id="paiva-multi-detect">Detectar webcams</button>
        <span id="paiva-multi-discovery-status" role="status">Conecte as webcams e clique para detectar. Vídeos antigos funcionam sem câmera.</span>
      </div>
      <div class="paiva-multi-grid">
        ${['a','b'].map(key=>`
          <article class="paiva-multi-pane" id="paiva-multi-pane-${key}">
            <div class="paiva-multi-pane-heading"><strong>${labels[key]}</strong><span id="paiva-multi-state-${key}">Disponível</span></div>
            <label>Posição da câmera
              <select id="paiva-multi-view-${key}">${VIEWS.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select>
            </label>
            <label>Webcam conectada
              <select id="paiva-multi-device-${key}" aria-label="Escolher webcam para o visor ${key.toUpperCase()}">
                <option value="">Detecte as webcams primeiro</option>
              </select>
            </label>
            <video id="paiva-multi-video-${key}" playsinline muted preload="metadata"></video>
            <div class="paiva-multi-controls">
              <button type="button" id="paiva-multi-start-${key}" disabled>Ligar câmera</button>
              <button type="button" id="paiva-multi-stop-${key}" disabled>Desligar</button>
              <button type="button" id="paiva-multi-record-${key}" disabled>Gravar · até 3 min</button>
              <button type="button" id="paiva-multi-end-${key}" disabled>Parar gravação</button>
            </div>
            <label class="paiva-multi-file">Abrir vídeo do computador/pendrive
              <input type="file" id="paiva-multi-file-${key}" accept="video/*,.mp4,.mov,.webm,.m4v,.avi" />
            </label>
            <div class="paiva-multi-finish">
              <button type="button" id="paiva-multi-analyze-${key}" disabled>Analisar no 2D</button>
              <a id="paiva-multi-download-${key}" hidden>Baixar gravação</a>
            </div>
            <p id="paiva-multi-message-${key}" role="status" aria-live="polite">Aguardando câmera ou vídeo local.</p>
          </article>`).join('')}
      </div>
      <p class="paiva-multi-disclaimer">Medições de ângulo e rastreio permanecem experimentais e precisam de conferência. Para capturar webcams, abra o aplicativo por HTTPS e autorize a câmera no Chrome/Edge.</p>`;
    analysis.before(section);

    const byId=(kind,key)=>document.getElementById(`paiva-multi-${kind}${key?'-'+key:''}`);
    const states=Object.fromEntries(['a','b'].map(key=>[key,{
      key,stream:null,recorder:null,chunks:[],timer:null,source:null,url:null,filename:'',recording:false,pending:false
    }]));
    const message=(key,text)=>byId('message',key).textContent=text;
    const status=text=>byId('discovery-status').textContent=text;
    let cameras=[];
    let detecting=false;

    function update(key) {
      const state=states[key];
      const live=!!state.stream,recording=state.recording;
      byId('start',key).disabled = live || state.pending || !byId('device',key).value;
      byId('stop',key).disabled = !live || state.pending;
      byId('record',key).disabled = !live || recording || state.pending ||
        typeof MediaRecorder==='undefined' || Object.values(states).some(s=>s!==state&&s.recording);
      byId('end',key).disabled = !recording;
      byId('analyze',key).disabled = !state.source || live || recording || state.pending;
      byId('state',key).textContent=recording?'GRAVANDO':live?'AO VIVO':state.source?'VÍDEO CARREGADO':'DISPONÍVEL';
      byId('pane',key).dataset.state=recording?'recording':live?'live':'idle';
    }
    const updateAll=()=>{update('a');update('b');};

    function stopStream(state) {
      if (state.stream) {
        state.stream.getTracks().forEach(track=>track.stop());
        state.stream=null;
      }
    }
    function detachVideo(state) {
      const video=byId('video',state.key);
      video.pause();video.srcObject=null;video.removeAttribute('src');
      video.controls=false;
    }
    function setPlayback(state,blob,filename,download) {
      if (state.url) URL.revokeObjectURL(state.url);
      state.source=blob;state.filename=filename;
      state.url=URL.createObjectURL(blob);
      const player=byId('video',state.key);
      player.pause();player.srcObject=null;player.src=state.url;
      player.controls=true;player.muted=true;player.autoplay=false;player.load();
      const link=byId('download',state.key);
      link.hidden=!download;
      if(download) {link.href=state.url;link.download=filename;}
      else link.removeAttribute('href');
      updateAll();
    }

    async function refreshCameras(requestPermission=false) {
      if (detecting)return;
      if (!window.isSecureContext || !navigator.mediaDevices?.enumerateDevices) {
        status('Webcam exige HTTPS e navegador compatível. A importação de vídeos continua disponível.');return;
      }
      detecting=true;byId('detect').disabled=true;
      let temp=null;
      try {
        if (requestPermission && !Object.values(states).some(s=>s.stream)) {
          temp=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
        }
        const found=await navigator.mediaDevices.enumerateDevices();
        cameras=found.filter(d=>d.kind==='videoinput' && d.deviceId).slice(0,MAX_CAMERAS);
        for(const key of ['a','b']) {
          const select=byId('device',key),previous=select.value;
          select.replaceChildren();
          if(!cameras.length) select.add(new Option('Nenhuma câmera detectada',''));
          cameras.forEach((cam,index)=>select.add(new Option(cam.label||`Webcam ${index+1}`,cam.deviceId)));
          if (cameras.some(cam=>cam.deviceId===previous)) select.value=previous;
          else if(cameras.length) select.value=cameras[key==='b'&&cameras.length>1?1:0].deviceId;
        }
        status(`${cameras.length} webcam(s) reconhecida(s), até ${MAX_CAMERAS} selecionáveis. As vistas são escolhidas manualmente.`);
      } catch (error) {
        status(error?.name==='NotAllowedError'
          ? 'Permissão de câmera negada. Autorize no navegador. Os vídeos do pendrive continuam funcionando.'
          : 'Não foi possível enumerar webcams. Verifique USB, drivers e permissões do Windows.');
      } finally {
        temp?.getTracks().forEach(track=>track.stop());
        detecting=false;byId('detect').disabled=false;updateAll();
      }
    }

    async function openCamera(key) {
      const state=states[key];
      const selected=byId('device',key).value;
      if(!selected || state.stream || state.pending)return;
      const other=states[key==='a'?'b':'a'];
      if (other.stream && byId('device',other.key).value===selected) {
        message(key,'Essa webcam já está em uso no outro visor. Escolha uma câmera diferente.');return;
      }
      if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        message(key,'Abra o app por HTTPS no Chrome ou Edge e permita a câmera.');return;
      }
      state.pending=true;updateAll();
      try {
        const stream=await navigator.mediaDevices.getUserMedia({
          video:{deviceId:{exact:selected},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false
        });
        stopStream(state);
        state.stream=stream;
        const video=byId('video',key);
        video.pause();video.removeAttribute('src');video.srcObject=stream;
        video.muted=true;video.controls=false;video.autoplay=true;
        await video.play().catch(()=>{});
        message(key,'Webcam ao vivo. Você pode gravar até 3 minutos ou desligá-la.');
      } catch (error) {
        message(key,error?.name==='NotAllowedError'
          ? 'Câmera bloqueada. Autorize nas permissões do navegador.'
          : 'Não foi possível abrir esta webcam. Confira se está conectada e não está sendo usada por outro programa.');
      } finally {state.pending=false;updateAll();}
    }

    function stopCamera(key) {
      const state=states[key];
      if (state.recording) {finishRecording(key);return;}
      stopStream(state);
      const player=byId('video',key);
      player.pause();player.srcObject=null;
      if (state.url) {player.src=state.url;player.controls=true;player.load();}
      else detachVideo(state);
      message(key,'Webcam desligada. O vídeo salvo, se houver, continua disponível.');
      updateAll();
    }

    function startRecording(key) {
      const state=states[key];
      if(!state.stream || state.recording || Object.values(states).some(s=>s!==state&&s.recording))return;
      if(typeof MediaRecorder==='undefined') {message(key,'Gravação indisponível neste navegador.');return;}
      const mime=['video/webm;codecs=vp8','video/webm','video/mp4']
        .find(type=>MediaRecorder.isTypeSupported?.(type));
      try {state.recorder=new MediaRecorder(state.stream,mime
        ? {mimeType:mime,videoBitsPerSecond:1500000}:{videoBitsPerSecond:1500000});}
      catch(_) {message(key,'Não foi possível iniciar o gravador dessa webcam.');return;}
      const recorder=state.recorder;
      state.chunks=[];
      recorder.ondataavailable=event=>{if(event.data?.size)state.chunks.push(event.data);};
      recorder.onerror=()=>message(key,'Ocorreu uma falha na gravação. Salve o que estiver disponível.');
      recorder.onstop=()=>{
        if(state.timer){clearTimeout(state.timer);state.timer=null;}
        state.recording=false;
        const mimeType=recorder.mimeType||'video/webm';
        const movie=new Blob(state.chunks,{type:mimeType});
        state.chunks=[];
        stopStream(state);
        if(movie.size) {
          const view=VIEWS.find(([id])=>id===byId('view',key).value)?.[1] || 'Visor';
          const filename=`PAIVA_${view.replaceAll(' ','_')}_${Date.now()}.${mimeType.includes('mp4')?'mp4':'webm'}`;
          setPlayback(state,movie,filename,true);
          message(key,`Gravação concluída (${(movie.size/1048576).toFixed(1).replace('.',',')} MB). Baixe o vídeo ou clique em “Analisar no 2D”.`);
        } else {
          detachVideo(state);
          message(key,'A gravação terminou sem dados. Tente novamente com um trecho menor.');
        }
        updateAll();
      };
      try{recorder.start(250);}catch(_){state.recorder=null;message(key,'Não foi possível iniciar a gravação.');return;}
      state.recording=true;
      state.timer=setTimeout(()=>{
        if(recorder.state==='recording') {
          recorder.stop();message(key,'Limite de 3 minutos atingido. Finalizando arquivo...');
        }
      },RECORD_LIMIT_MS);
      message(key,`Gravando sem áudio · máximo ${formatTime(RECORD_LIMIT_MS)}. Clique em “Parar gravação” quando terminar.`);
      updateAll();
    }
    function finishRecording(key) {
      const state=states[key];
      if(state.recorder?.state==='recording') {
        byId('end',key).disabled=true;
        state.recorder.stop();message(key,'Finalizando vídeo, aguarde...');
      }
    }

    function importFile(key,file) {
      const state=states[key];
      if(state.recording){message(key,'Pare a gravação antes de abrir outro arquivo.');return;}
      if(!supportedVideo(file)) {message(key,'Selecione um arquivo de vídeo.');return;}
      stopStream(state);
      setPlayback(state,file,file.name||'Vídeo local',false);
      message(key,`Vídeo local carregado: ${file.name||'arquivo'}. Pause na imagem desejada ou clique em “Analisar no 2D”.`);
    }
    function analyze(key) {
      const state=states[key];
      if(!state.source)return;
      const app=globalThis.PAIVA_ATHLETE_2D;
      if(!app?.openVideo) {message(key,'Análise 2D indisponível. Atualize os arquivos do aplicativo.');return;}
      const opened=app.openVideo(state.source,state.filename);
      if(opened)message(key,'Vídeo enviado à Análise Angular 2D. Use “Capturar quadro” para desenhar.');
    }

    byId('help').addEventListener('click',()=>{
      const panel=byId('explain');panel.hidden=!panel.hidden;
      byId('help').setAttribute('aria-expanded',String(!panel.hidden));
    });
    byId('detect').addEventListener('click',()=>refreshCameras(true));
    navigator.mediaDevices?.addEventListener?.('devicechange',()=>refreshCameras(false));
    for(const key of ['a','b']) {
      byId('view',key).value=key==='a'?'right':'left';
      byId('start',key).addEventListener('click',()=>openCamera(key));
      byId('stop',key).addEventListener('click',()=>stopCamera(key));
      byId('record',key).addEventListener('click',()=>startRecording(key));
      byId('end',key).addEventListener('click',()=>finishRecording(key));
      byId('device',key).addEventListener('change',updateAll);
      byId('file',key).addEventListener('change',event=>{
        const selected=event.target.files?.[0];
        if(selected)importFile(key,selected);
        event.target.value='';
      });
      byId('analyze',key).addEventListener('click',()=>analyze(key));
      byId('video',key).addEventListener('error',()=>{
        if(states[key].source)message(key,'Este arquivo não pôde ser reproduzido. Prefira MP4 (H.264) ou WebM; alguns AVI/MOV não são compatíveis com o navegador.');
      });
    }
    window.addEventListener('pagehide',()=>{
      for(const state of Object.values(states)){
        if(state.recorder?.state==='recording')state.recorder.stop();
        if(state.timer)clearTimeout(state.timer);
        stopStream(state);
        if(state.url)URL.revokeObjectURL(state.url);
      }
    });
    updateAll();refreshCameras(false);
    globalThis.PAIVA_MULTICAM={maxCameras:MAX_CAMERAS,maxRecordingMs:RECORD_LIMIT_MS};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
