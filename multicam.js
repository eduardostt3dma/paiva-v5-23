/* PAIVA · Um ou dois visores; até seis fontes selecionáveis e captação dupla.
   Gravações de cada câmera são locais e iniciadas juntas quando solicitado. */
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
        <div><span>ESTAÇÃO DE CAPTAÇÃO</span><h2>VÍDEO 2D · UM OU DOIS VISORES</h2></div>
        <button type="button" id="paiva-multi-help" aria-expanded="false" aria-label="Entender as câmeras">?</button>
      </div>
      <div id="paiva-multi-explain" hidden>
        <p>Você pode ligar até seis webcams USB ao Windows e escolher uma para cada visor. Selecione <strong>1 câmera</strong> para ampliar o visor ou <strong>2 câmeras</strong> para captar dois ângulos lado a lado, inclusive com gravação dupla. Os dois arquivos são separados e começam com pequena diferença de tempo; não há sincronização profissional quadro a quadro.</p>
        <p>O reconhecimento das webcams depende da permissão do navegador, das portas USB, da capacidade do computador e dos drivers. Uma câmera não cobre todo o entorno; as cinco vistas são captações independentes, não uma imagem esférica 360°.</p>
        <p>Escolha resolução, taxa de quadros e qualidade de gravação por câmera. Os valores são solicitações: a webcam pode negociar valores menores. Duas câmeras HD/60 fps exigem mais memória e banda USB. Cada gravação termina automaticamente em até 3 minutos, sem áudio. Salve ambos os arquivos antes de sair. Vídeos antigos também podem ser abertos do pendrive; alguns codecs AVI/MOV não são reproduzidos no navegador.</p>
      </div>
      <div class="paiva-multi-mode">
        <label>Modo de captação
          <select id="paiva-multi-mode"><option value="1">1 câmera · visor ampliado</option><option value="2" selected>2 câmeras · lado a lado</option></select>
        </label>
        <button type="button" id="paiva-multi-pair-start" disabled>● Gravar as duas</button>
        <button type="button" id="paiva-multi-pair-stop" disabled>■ Parar as duas</button>
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
            <div class="paiva-multi-quality">
              <label>Resolução
                <select id="paiva-multi-resolution-${key}"><option value="640x480">640 × 480</option><option value="1280x720" selected>HD · 1280 × 720</option><option value="1920x1080">Full HD · 1920 × 1080</option></select>
              </label>
              <label>Quadros/s
                <select id="paiva-multi-fps-${key}"><option value="15">15 fps</option><option value="30" selected>30 fps</option><option value="60">60 fps</option></select>
              </label>
              <label>Qualidade do arquivo
                <select id="paiva-multi-bitrate-${key}"><option value="1500000">Leve · 1,5 Mb/s</option><option value="3000000" selected>Alta · 3 Mb/s</option><option value="6000000">Máxima · 6 Mb/s</option></select>
              </label>
            </div>
            <video id="paiva-multi-video-${key}" playsinline muted preload="auto"></video>
            <div class="paiva-multi-playback">
              <button type="button" id="paiva-multi-play-${key}" disabled>▶ Reproduzir vídeo</button>
              <button type="button" id="paiva-multi-pause-${key}" disabled>⏸ Pausar</button>
            </div>
            <label class="paiva-multi-speed">Velocidade de reprodução
              <select id="paiva-multi-speed-${key}"><option value="0.1">0,1×</option><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option></select>
            </label>
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
      key,stream:null,recorder:null,chunks:[],timer:null,source:null,url:null,filename:'',recording:false,pending:false,loadTimer:null,sessionId:''
    }]));
    const message=(key,text)=>byId('message',key).textContent=text;
    const status=text=>byId('discovery-status').textContent=text;
    let cameras=[];
    let detecting=false;

    function dualMode(){return byId('mode').value==='2';}

    function update(key) {
      const state=states[key];
      const live=!!state.stream,recording=state.recording;
      byId('start',key).disabled = (key==='b'&&!dualMode()) || live || state.pending || !byId('device',key).value;
      byId('stop',key).disabled = !live || state.pending;
      byId('record',key).disabled = !live || recording || state.pending ||
        typeof MediaRecorder==='undefined';
      byId('end',key).disabled = !recording;
      byId('analyze',key).disabled = !state.source || live || recording || state.pending;
      byId('play',key).disabled = !state.source || live || recording || state.pending;
      byId('pause',key).disabled = !state.source || live || recording || state.pending;
      for(const setting of ['resolution','fps','bitrate'])byId(setting,key).disabled=live || state.pending || recording;
      byId('state',key).textContent=recording?'GRAVANDO':live?'AO VIVO':state.source?'VÍDEO CARREGADO':'DISPONÍVEL';
      byId('pane',key).dataset.state=recording?'recording':live?'live':'idle';
    }
    const updateAll=()=>{
      update('a');update('b');
      const ready=['a','b'].every(key=>states[key].stream && !states[key].recording && !states[key].pending);
      byId('pair-start').disabled=!dualMode() || !ready || typeof MediaRecorder==='undefined';
      byId('pair-stop').disabled=!['a','b'].some(key=>states[key].recording);
      byId('mode').disabled=states.b.recording || states.b.pending;
    };

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
      if(state.loadTimer) {clearTimeout(state.loadTimer);state.loadTimer=null;}
      if (state.url) URL.revokeObjectURL(state.url);
      state.source=blob;state.filename=filename;
      state.url=URL.createObjectURL(blob);
      const player=byId('video',state.key);
      player.pause();player.srcObject=null;player.src=state.url;
      player.controls=true;player.muted=true;player.autoplay=false;player.load();
      player.playbackRate=Number(byId('speed',state.key).value)||1;
      const expectedUrl=state.url;
      state.loadTimer=setTimeout(()=>{
        state.loadTimer=null;
        if(state.url===expectedUrl && !player.error && player.readyState<1)
          message(state.key,'O vídeo ainda está sem duração e não começou a carregar. Pode estar em um formato antigo não reconhecido pelo navegador. Tente MP4 (H.264) ou WebM.');
      },8000);
      const link=byId('download',state.key);
      link.hidden=!download;
      if(download) {link.href=state.url;link.download=filename;}
      else link.removeAttribute('href');
      updateAll();
    }

    function playVideo(key) {
      const state=states[key],player=byId('video',key);
      if(!state.source || state.stream || state.recording)return;
      message(key,'Tentando reproduzir o arquivo…');
      let attempt;
      try {attempt=player.play();}
      catch (error) {message(key,`Não foi possível iniciar o vídeo: ${error?.message||'erro de reprodução'}.`);return;}
      Promise.resolve(attempt).then(()=>{
        if(!player.paused)message(key,'Vídeo em reprodução. Pause no instante desejado e clique em “Analisar no 2D”.');
      }).catch(error=>{
        if(state.stream)return;
        message(key,error?.name==='NotAllowedError'
          ? 'O navegador bloqueou a reprodução automática. Clique novamente em “▶ Reproduzir vídeo”.'
          : 'O navegador não conseguiu iniciar o vídeo. Se for AVI, MOV ou outro formato antigo, converta para MP4 com vídeo H.264 (ou WebM).');
      });
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
      if(key==='b' && !dualMode()){message(key,'Selecione 2 câmeras para abrir o Visor B.');return;}
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
        const [width,height]=byId('resolution',key).value.split('x').map(Number);
        const frameRate=Number(byId('fps',key).value);
        const stream=await navigator.mediaDevices.getUserMedia({
          video:{deviceId:{exact:selected},width:{ideal:width},height:{ideal:height},frameRate:{ideal:frameRate}},audio:false
        });
        stopStream(state);
        state.stream=stream;
        const video=byId('video',key);
        video.pause();video.removeAttribute('src');video.srcObject=stream;
        video.muted=true;video.controls=false;video.autoplay=true;
        await video.play().catch(()=>{});
        const actual=stream.getVideoTracks()[0]?.getSettings?.()||{};
        message(key,`Webcam ao vivo: ${actual.width||'?'} × ${actual.height||'?'} · ${actual.frameRate?Math.round(actual.frameRate)+' fps':'fps não informado'}. A qualidade real depende da câmera. Gravação até 3 min.`);
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

    function startRecording(key,sessionId='') {
      const state=states[key];
      if(!state.stream || state.recording)return false;
      if(typeof MediaRecorder==='undefined') {message(key,'Gravação indisponível neste navegador.');return false;}
      const mime=['video/webm;codecs=vp8','video/webm','video/mp4']
        .find(type=>MediaRecorder.isTypeSupported?.(type));
      const bitrate=Number(byId('bitrate',key).value)||3000000;
      try {state.recorder=new MediaRecorder(state.stream,mime
        ? {mimeType:mime,videoBitsPerSecond:bitrate}:{videoBitsPerSecond:bitrate});}
      catch(_) {message(key,'Não foi possível iniciar o gravador dessa webcam.');return false;}
      const recorder=state.recorder;
      state.sessionId=sessionId||String(Date.now());
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
          const filename=`PAIVA_${state.sessionId}_${key.toUpperCase()}_${view.replaceAll(' ','_')}.${mimeType.includes('mp4')?'mp4':'webm'}`;
          setPlayback(state,movie,filename,true);
          message(key,`Gravação concluída (${(movie.size/1048576).toFixed(1).replace('.',',')} MB). Baixe o vídeo ou clique em “Analisar no 2D”.`);
        } else {
          detachVideo(state);
          message(key,'A gravação terminou sem dados. Tente novamente com um trecho menor.');
        }
        updateAll();
      };
      try{recorder.start(250);}catch(_){state.recorder=null;message(key,'Não foi possível iniciar a gravação.');return false;}
      state.recording=true;
      state.timer=setTimeout(()=>{
        if(recorder.state==='recording') {
          recorder.stop();message(key,'Limite de 3 minutos atingido. Finalizando arquivo...');
        }
      },RECORD_LIMIT_MS);
      message(key,`Gravando sem áudio · máximo ${formatTime(RECORD_LIMIT_MS)}. Clique em “Parar gravação” quando terminar.`);
      updateAll();
      return true;
    }
    function finishRecording(key) {
      const state=states[key];
      if(state.recorder?.state==='recording') {
        byId('end',key).disabled=true;
        state.recorder.stop();message(key,'Finalizando vídeo, aguarde...');
      }
    }

    function startBoth() {
      if(!dualMode() || !['a','b'].every(key=>states[key].stream && !states[key].recording && !states[key].pending))return;
      const session=String(Date.now());
      const startedA=startRecording('a',session);
      const startedB=startRecording('b',session);
      if(!startedA || !startedB) {
        if(startedA)finishRecording('a');
        if(startedB)finishRecording('b');
        status('Não foi possível iniciar as duas webcams juntas. Gravação dupla cancelada; confira as permissões e o desempenho do computador.');
      } else
        status('Gravação dupla iniciada. Os arquivos A e B terão o mesmo identificador de sessão, com pequena diferença inicial de tempo. Salve os dois ao terminar.');
      updateAll();
    }
    function stopBoth() {
      for(const key of ['a','b'])finishRecording(key);
      status('Finalizando as gravações. Aguarde os links de download em cada visor.');
    }

    function importFile(key,file) {
      const state=states[key];
      if(state.recording){message(key,'Pare a gravação antes de abrir outro arquivo.');return;}
      if(!supportedVideo(file)) {message(key,'Selecione um arquivo de vídeo.');return;}
      stopStream(state);
      setPlayback(state,file,file.name||'Vídeo local',false);
      message(key,`Abrindo ${file.name||'vídeo local'} (${(file.size/1048576).toFixed(1).replace('.',',')} MB)…`);
      playVideo(key);
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
    byId('mode').addEventListener('change',()=>{
      if(!dualMode() && states.b.stream)stopCamera('b');
      section.dataset.mode=dualMode()?'double':'single';
      status(dualMode()?'Modo de duas câmeras: selecione fontes diferentes e use “Gravar as duas”.':'Modo de uma câmera: o Visor A foi ampliado.');
      updateAll();
    });
    byId('pair-start').addEventListener('click',startBoth);
    byId('pair-stop').addEventListener('click',stopBoth);
    byId('detect').addEventListener('click',()=>refreshCameras(true));
    navigator.mediaDevices?.addEventListener?.('devicechange',()=>refreshCameras(false));
    for(const key of ['a','b']) {
      byId('view',key).value=key==='a'?'right':'left';
      byId('start',key).addEventListener('click',()=>openCamera(key));
      byId('stop',key).addEventListener('click',()=>stopCamera(key));
      byId('record',key).addEventListener('click',()=>startRecording(key));
      byId('end',key).addEventListener('click',()=>finishRecording(key));
      byId('play',key).addEventListener('click',()=>playVideo(key));
      byId('speed',key).addEventListener('change',()=>{
        const player=byId('video',key);
        player.playbackRate=Number(byId('speed',key).value)||1;
        if(states[key].source && !states[key].stream)message(key,`Velocidade do vídeo: ${byId('speed',key).selectedOptions[0].textContent}.`);
      });
      byId('pause',key).addEventListener('click',()=>{
        const player=byId('video',key);player.pause();
        if(states[key].source)message(key,'Vídeo pausado. Clique em “Analisar no 2D” para medir ângulos e linhas.');
      });
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
      byId('video',key).addEventListener('loadedmetadata',()=>{
        const state=states[key],player=byId('video',key);
        if(!state.source || state.stream)return;
        if(state.loadTimer){clearTimeout(state.loadTimer);state.loadTimer=null;}
        if(player.paused)message(key,`Vídeo reconhecido (${Number.isFinite(player.duration)?formatTime(player.duration*1000):'duração indefinida'}). Clique em “▶ Reproduzir vídeo”.`);
      });
    }
    window.addEventListener('pagehide',()=>{
      for(const state of Object.values(states)){
        if(state.recorder?.state==='recording')state.recorder.stop();
        if(state.timer)clearTimeout(state.timer);
        if(state.loadTimer)clearTimeout(state.loadTimer);
        stopStream(state);
        if(state.url)URL.revokeObjectURL(state.url);
      }
    });
    section.dataset.mode='double';
    updateAll();refreshCameras(false);
    globalThis.PAIVA_MULTICAM={maxCameras:MAX_CAMERAS,maxRecordingMs:RECORD_LIMIT_MS};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
