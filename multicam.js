/* PAIVA · Um ou dois visores; até seis fontes selecionáveis e captação simultânea.
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
  const KEYS=['a','b'];
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
        <div><span>ESTAÇÃO DE CAPTAÇÃO</span><h2>VÍDEO 2D · 1 OU 2 VISORES</h2></div>
        <button type="button" id="paiva-multi-help" aria-expanded="false" aria-label="Entender as câmeras">?</button>
      </div>
      <div id="paiva-multi-explain" hidden>
        <p>Você pode ligar até seis webcams USB ao Windows e escolher uma para cada visor. Escolha <strong>1 ou 2 câmeras</strong>. Cada visor tem webcam e gravação independentes. A abertura de quatro câmeras simultâneas depende das portas USB, drivers e capacidade do computador. Os dois arquivos são separados e começam com pequena diferença de tempo; não há sincronização profissional quadro a quadro.</p>
        <p>O reconhecimento das webcams depende da permissão do navegador, das portas USB, da capacidade do computador e dos drivers. Uma câmera não cobre todo o entorno; as cinco vistas são captações independentes, não uma imagem esférica 360°.</p>
        <p>Escolha resolução, taxa de quadros e qualidade de gravação por câmera. Os valores são solicitações: a webcam pode negociar valores menores. Ajuste resolução e FPS com a imagem ao vivo. Para reduzir borrão de movimento, use exposição mais curta e boa iluminação. Cada gravação termina automaticamente em até 3 minutos, sem áudio. Salve ambos os arquivos antes de sair. Vídeos antigos também podem ser abertos do pendrive; alguns codecs AVI/MOV não são reproduzidos no navegador. Sobre cada visor de vídeo gravado, a rodinha do mouse avança ou recua o quadro; o botão direito alterna reprodução/pausa. Teclado: Espaço alterna, K pausa, L reproduz e ← / → movem os quadros, atuando sobre o último visor apontado pelo mouse.</p>
      </div>
      <div class="paiva-multi-mode">
        <label>Modo de captação
          <select id="paiva-multi-mode"><option value="1">1 câmera · visor ampliado</option><option value="2" selected>2 câmeras · lado a lado</option></select>
        </label>
        <button type="button" id="paiva-multi-pair-start" disabled>● Gravar visores ativos</button>
        <button type="button" id="paiva-multi-pair-stop" disabled>■ Parar gravações</button>
      </div>
      <div class="paiva-multi-discovery">
        <button type="button" id="paiva-multi-detect">Detectar webcams</button>
        <span id="paiva-multi-discovery-status" role="status">Conecte as webcams e clique para detectar. Vídeos antigos funcionam sem câmera.</span>
      </div>
      <div class="paiva-multi-grid">
        ${KEYS.map(key=>`
          <article class="paiva-multi-pane" id="paiva-multi-pane-${key}">
            <div class="paiva-multi-pane-heading"><strong>${labels[key]}</strong><span class="paiva-multi-rec" id="paiva-multi-rec-${key}" hidden>● REC</span><span id="paiva-multi-state-${key}">Disponível</span></div>
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
                <select id="paiva-multi-bitrate-${key}"><option value="1500000">Leve · 1,5 Mb/s</option><option value="3000000" selected>Alta · 3 Mb/s</option><option value="6000000">Máxima · 6 Mb/s</option><option value="10000000">Detalhes/refletores · 10 Mb/s</option></select>
              </label>
            </div>
            <details class="paiva-multi-camera-settings" id="paiva-multi-settings-${key}">
              <summary>⚙ Ajustes da webcam ao vivo</summary>
              <div class="paiva-multi-exposure-row">
                <label>Exposição
                  <select id="paiva-multi-exposure-mode-${key}"><option value="continuous">Automática</option><option value="manual">Manual (se suportado)</option></select>
                </label>
                <label>Valor da exposição
                  <input type="range" id="paiva-multi-exposure-${key}" disabled />
                  <output id="paiva-multi-exposure-value-${key}">—</output>
                </label>
                <label>Ganho
                  <input type="range" id="paiva-multi-gain-${key}" disabled />
                  <output id="paiva-multi-gain-value-${key}">—</output>
                </label>
              </div>
              <small id="paiva-multi-capability-${key}">Ligue a câmera para verificar os controles disponíveis. Resolução e FPS ficam logo acima.</small>
            </details>
            <video id="paiva-multi-video-${key}" playsinline muted preload="auto"></video>
            <div class="paiva-multi-playback">
              <button type="button" id="paiva-multi-play-${key}" disabled>▶ Reproduzir vídeo</button>
              <button type="button" id="paiva-multi-pause-${key}" disabled>⏸ Pausar</button>
            </div>
            <small class="paiva-multi-wheel-hint">🖱 Rodinha: quadros · Direito: play/pause · Espaço: play/pause</small>
            <label class="paiva-multi-loop"><input type="checkbox" id="paiva-multi-loop-${key}" checked /> ↻ Repetir vídeo continuamente</label>
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
              <button type="button" id="paiva-multi-analyze-${key}" disabled>Analisar no 2D</button><button type="button" id="paiva-multi-delete-${key}" disabled>Excluir vídeo</button>
              <a id="paiva-multi-download-${key}" hidden>Baixar gravação</a>
            </div>
            <p id="paiva-multi-message-${key}" role="status" aria-live="polite">Aguardando câmera ou vídeo local.</p>
          </article>`).join('')}
      </div>
      <p class="paiva-multi-disclaimer">Medições de ângulo e rastreio permanecem experimentais e precisam de conferência. Para capturar webcams, abra o aplicativo por HTTPS e autorize a câmera no Chrome/Edge.</p>`;
    analysis.before(section);

    const byId=(kind,key)=>document.getElementById(`paiva-multi-${kind}${key?'-'+key:''}`);
    const states=Object.fromEntries(KEYS.map(key=>[key,{
      key,stream:null,recorder:null,chunks:[],timer:null,source:null,url:null,filename:'',recording:false,pending:false,loadTimer:null,sessionId:''
    }]));
    const message=(key,text)=>byId('message',key).textContent=text;
    const status=text=>byId('discovery-status').textContent=text;
    let cameras=[];
    let detecting=false;

    function activeKeys(){return KEYS.slice(0,Number(byId('mode').value)||2);}
    function isActive(key){return activeKeys().includes(key);}

    function update(key) {
      const state=states[key];
      const live=!!state.stream,recording=state.recording;
      byId('start',key).disabled = !isActive(key) || live || state.pending || !byId('device',key).value;
      byId('stop',key).disabled = !live || state.pending;
      byId('record',key).disabled = !live || recording || state.pending ||
        typeof MediaRecorder==='undefined';
      byId('end',key).disabled = !recording;
      byId('delete',key).disabled = !state.source || recording || state.pending;
      byId('rec',key).hidden=!recording;
      byId('analyze',key).disabled = !state.source || live || recording || state.pending;
      byId('play',key).disabled = !state.source || live || recording || state.pending;
      byId('pause',key).disabled = !state.source || live || recording || state.pending;
      byId('loop',key).disabled = !state.source || live || recording || state.pending;
      for(const setting of ['resolution','fps'])byId(setting,key).disabled=state.pending || recording;
      byId('bitrate',key).disabled=recording || state.pending;
      for(const field of ['exposure-mode','exposure','gain'])if(recording)byId(field,key).disabled=true;
      byId('state',key).textContent=recording?'GRAVANDO':live?'AO VIVO':state.source?'VÍDEO CARREGADO':'DISPONÍVEL';
      byId('pane',key).dataset.state=recording?'recording':live?'live':'idle';
    }
    const updateAll=()=>{
      KEYS.forEach(update);
      const ready=activeKeys().every(key=>states[key].stream && !states[key].recording && !states[key].pending);
      byId('pair-start').disabled=!ready || typeof MediaRecorder==='undefined';
      byId('pair-stop').disabled=!KEYS.some(key=>states[key].recording);
      byId('mode').disabled=KEYS.some(key=>states[key].recording || states[key].pending);
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
      player.loop=byId('loop',state.key).checked;
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
      if(player.ended)player.currentTime=0;
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
    function pauseVideo(key){
      const state=states[key],player=byId('video',key);
      player.pause();
      if(state.source)message(key,'Vídeo pausado. Use a rodinha ou as setas para escolher o quadro.');
    }
    function toggleVideo(key){
      const state=states[key],player=byId('video',key);
      if(!state.source || state.stream || state.recording)return;
      if(!player.paused)pauseVideo(key);
      else playVideo(key);
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
        for(const key of KEYS) {
          const select=byId('device',key),previous=select.value;
          select.replaceChildren();
          if(!cameras.length) select.add(new Option('Nenhuma câmera detectada',''));
          cameras.forEach((cam,index)=>select.add(new Option(cam.label||`Webcam ${index+1}`,cam.deviceId)));
          if (cameras.some(cam=>cam.deviceId===previous)) select.value=previous;
          else if(cameras.length) select.value=cameras[Math.min(KEYS.indexOf(key),cameras.length-1)].deviceId;
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

    function configureExposure(key) {
      const track=states[key].stream?.getVideoTracks()[0];
      const caps=track?.getCapabilities?.()||{};
      const settings=track?.getSettings?.()||{};
      const mode=byId('exposure-mode',key),exposure=byId('exposure',key),gain=byId('gain',key);
      const hasExposure=!!caps.exposureTime && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('manual');
      mode.disabled=!hasExposure;
      if(hasExposure){
        mode.value=settings.exposureMode==='manual'?'manual':'continuous';
        exposure.min=caps.exposureTime.min;exposure.max=caps.exposureTime.max;
        exposure.step=caps.exposureTime.step||'any';
        exposure.value=settings.exposureTime??caps.exposureTime.min;
      }
      exposure.disabled=!hasExposure || mode.value!=='manual';
      if(caps.gain){gain.min=caps.gain.min;gain.max=caps.gain.max;gain.step=caps.gain.step||'any';gain.value=settings.gain??caps.gain.min;gain.disabled=false;}
      else gain.disabled=true;
      byId('exposure-value',key).textContent=hasExposure?String(exposure.value):'Indisponível';
      byId('gain-value',key).textContent=caps.gain?String(gain.value):'Indisponível';
      byId('capability',key).textContent=hasExposure||caps.gain
        ? 'Ajustes disponíveis nesta webcam. Alterações são aplicadas sem sair da visualização.'
        : 'O navegador não disponibiliza exposição ou ganho desta webcam. Use o painel do fabricante no Windows.';
    }
    async function applyExposure(key,property,value){
      const state=states[key],track=state.stream?.getVideoTracks()[0];
      if(!track || state.recording || state.pending)return;
      try {
        await track.applyConstraints({advanced:[{[property]:value}]});
        configureExposure(key);
        message(key,'Configuração aplicada. Confira a nitidez da imagem ao vivo.');
      } catch(error){
        message(key,'Esta webcam não aceitou esse ajuste pelo navegador. Use as configurações do fabricante no Windows.');
        configureExposure(key);
      }
    }
    async function openCamera(key) {
      const state=states[key];
      if(!isActive(key)){message(key,'Ative este visor no Modo de captação.');return;}
      const selected=byId('device',key).value;
      if(!selected || state.pending)return;
      if(state.recording){message(key,'Pare a gravação antes de trocar a webcam.');return;}
      if (KEYS.some(other=>other!==key && states[other].stream && byId('device',other).value===selected)) {
        message(key,'Essa webcam já está em uso no outro visor. Escolha uma câmera diferente.');return;
      }
      if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        message(key,'Abra o app por HTTPS no Chrome ou Edge e permita a câmera.');return;
      }
      state.pending=true;updateAll();
      try {
        const [width,height]=byId('resolution',key).value.split('x').map(Number);
        const frameRate=Number(byId('fps',key).value);
        // Liberar o dispositivo anterior para permitir a troca ao vivo.
        if(state.stream){stopStream(state);byId('video',key).srcObject=null;}
        const stream=await navigator.mediaDevices.getUserMedia({
          video:{deviceId:{exact:selected},width:{ideal:width},height:{ideal:height},frameRate:{ideal:frameRate}},audio:false
        });
        stopStream(state);
        state.stream=stream;
        const video=byId('video',key);
        video.pause();video.removeAttribute('src');video.srcObject=stream;
        video.muted=true;video.controls=false;video.autoplay=true;
        await video.play().catch(()=>{});
        configureExposure(key);
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
          globalThis.PAIVA_RECORDS?.save({kind:'video',name:filename,
            description:`Webcam ${key.toUpperCase()} · ${view} · gravação individual`,blob:movie})
            .catch(error=>message(key,`Vídeo pronto para baixar, mas o salvamento local falhou: ${error.message}`));
          message(key,`Gravação concluída (${(movie.size/1048576).toFixed(1).replace('.',',')} MB), registrada no navegador. Baixe para guardar permanentemente.`);
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
      if(!activeKeys().every(key=>states[key].stream && !states[key].recording && !states[key].pending))return;
      const session=String(Date.now());
      const started=activeKeys().map(key=>[key,startRecording(key,session)]);
      if(started.some(([,ok])=>!ok)) {
        started.forEach(([key,ok])=>{if(ok)finishRecording(key);});
        status('Não foi possível iniciar todas as webcams juntas. Gravação cancelada; confira as permissões e o desempenho do computador.');
      } else
        status('Gravações iniciadas. Cada visor gera um arquivo independente, sem sincronização quadro a quadro.');
      updateAll();
    }
    function stopBoth() {
      for(const key of KEYS)finishRecording(key);
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
      for(const key of KEYS)if(!isActive(key) && states[key].stream)stopCamera(key);
      section.dataset.mode=byId('mode').value==='1'?'single':'double';
      status(`Modo de ${activeKeys().length} câmera(s). Escolha webcams diferentes e clique em Ligar câmera em cada visor.`);
      updateAll();
    });
    byId('pair-start').addEventListener('click',startBoth);
    byId('pair-stop').addEventListener('click',stopBoth);
    byId('detect').addEventListener('click',()=>refreshCameras(true));
    navigator.mediaDevices?.addEventListener?.('devicechange',()=>refreshCameras(false));
    for(const key of KEYS) {
      byId('view',key).value=({a:'right',b:'left',c:'front',d:'back'})[key];
      byId('exposure-mode',key).addEventListener('change',()=>applyExposure(key,'exposureMode',byId('exposure-mode',key).value));
      byId('exposure',key).addEventListener('change',()=>applyExposure(key,'exposureTime',Number(byId('exposure',key).value)));
      byId('gain',key).addEventListener('change',()=>applyExposure(key,'gain',Number(byId('gain',key).value)));
      byId('start',key).addEventListener('click',()=>openCamera(key));
      byId('stop',key).addEventListener('click',()=>stopCamera(key));
      byId('record',key).addEventListener('click',()=>startRecording(key));
      byId('end',key).addEventListener('click',()=>finishRecording(key));
      byId('play',key).addEventListener('click',()=>playVideo(key));
      const player=byId('video',key);
      player.tabIndex=0;
      player.setAttribute('aria-label',`Visor ${key.toUpperCase()}: botão direito pausa/reproduz; Espaço alterna; setas avançam quadros.`);
      player.addEventListener('pointerenter',()=>{globalThis.PAIVA_ACTIVE_VIDEO_PANEL=`multi-${key}`;});
      player.addEventListener('pointerdown',()=>player.focus({preventScroll:true}));
      player.addEventListener('contextmenu',event=>{
        const state=states[key];
        if(!state.source || state.stream)return;
        event.preventDefault();
        globalThis.PAIVA_ACTIVE_VIDEO_PANEL=`multi-${key}`;
        toggleVideo(key);
      });
      document.addEventListener('keydown',event=>{
        if(globalThis.PAIVA_ACTIVE_VIDEO_PANEL!==`multi-${key}`||event.repeat)return;
        if(event.ctrlKey||event.altKey||event.metaKey)return;
        if(event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]'))return;
        const state=states[key],video=byId('video',key);
        if(!state.source||state.stream||state.recording)return;
        const shortcut=event.code||event.key;
        if(shortcut==='Space'||shortcut===' '){event.preventDefault();toggleVideo(key);}
        else if(shortcut==='KeyK'||shortcut==='k'||shortcut==='K'){event.preventDefault();pauseVideo(key);}
        else if(shortcut==='KeyL'||shortcut==='l'||shortcut==='L'){event.preventDefault();playVideo(key);}
        else if(shortcut==='ArrowLeft'||shortcut==='ArrowRight'){
          if(!Number.isFinite(video.duration)||video.duration<=0)return;
          event.preventDefault();video.pause();
          const fps=Number(byId('fps',key).value)||30;
          const step=shortcut==='ArrowRight'?1:-1;
          video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+step/fps));
          message(key,`Quadro ${step>0?'seguinte':'anterior'} · 1/${fps} s (aproximado).`);
        }
      });
      let wheelAccumulator=0;
      byId('video',key).addEventListener('wheel',event=>{
        const state=states[key],player=byId('video',key);
        if(!state.source || state.stream || state.recording || !Number.isFinite(player.duration) || player.duration<=0)return;
        event.preventDefault();
        wheelAccumulator+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?100:1);
        if(Math.abs(wheelAccumulator)<30)return;
        const direction=Math.sign(wheelAccumulator);wheelAccumulator=0;
        player.pause();
        const fps=Number(byId('fps',key).value)||30;
        player.currentTime=Math.max(0,Math.min(player.duration,player.currentTime+direction/fps));
        message(key,`Quadro ${direction>0?'seguinte':'anterior'} · 1/${fps} s (aproximado). Gire a rodinha sobre a imagem para continuar.`);
      },{passive:false});
      byId('speed',key).addEventListener('change',()=>{
        const player=byId('video',key);
        player.playbackRate=Number(byId('speed',key).value)||1;
        if(states[key].source && !states[key].stream)message(key,`Velocidade do vídeo: ${byId('speed',key).selectedOptions[0].textContent}.`);
      });
      byId('pause',key).addEventListener('click',()=>{
        pauseVideo(key);
      });
      byId('loop',key).addEventListener('change',()=>{
        const player=byId('video',key);
        player.loop=byId('loop',key).checked;
        if(states[key].source)message(key,player.loop?'Repetição contínua ativada: volta ao início e segue para a frente.':'Repetição desativada: para ao terminar.');
      });
      byId('device',key).addEventListener('change',()=>{
        if(states[key].stream && !states[key].recording)openCamera(key);
        else updateAll();
      });
      for(const setting of ['resolution','fps'])byId(setting,key).addEventListener('change',()=>{
        if(states[key].stream && !states[key].recording)openCamera(key);
      });
      byId('delete',key).addEventListener('click',()=>{
        const state=states[key];
        if(!state.source || state.recording || state.pending)return;
        if(!confirm('Excluir este vídeo deste visor? Um arquivo já baixado no computador não será apagado.'))return;
        if(state.loadTimer){clearTimeout(state.loadTimer);state.loadTimer=null;}
        detachVideo(state);
        if(state.url)URL.revokeObjectURL(state.url);
        state.url=null;state.source=null;state.filename='';state.chunks=[];
        const link=byId('download',key);link.hidden=true;link.removeAttribute('href');
        message(key,'Vídeo retirado do visor. Pronto para nova gravação.');
        updateAll();
      });
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
      byId('video',key).addEventListener('ended',()=>{
        const player=byId('video',key);
        if(states[key].source&&!states[key].stream&&player.loop){player.currentTime=0;playVideo(key);}
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
    globalThis.PAIVA_MULTICAM={maxCameras:MAX_CAMERAS,maxActive:2,maxRecordingMs:RECORD_LIMIT_MS};
  }
  // A bancada angular é montada por outro arquivo deferido. Em computadores
  // mais lentos ela pode não existir no primeiro DOMContentLoaded.
  // Repetir a inicialização não duplica a estação (guarda no início de initialize).
  function bootMultiCamera(){
    if(document.getElementById('paiva-multi-camera'))return;
    try{initialize();}catch(err){console.error('PAIVA: erro ao iniciar câmeras',err);}
    if(document.getElementById('paiva-multi-camera'))return;
    let tries=0;
    const retry=setInterval(()=>{
      if(document.getElementById('paiva-multi-camera')||++tries>100){clearInterval(retry);return;}
      try{initialize();}catch(err){console.error('PAIVA: falha na estação',err);clearInterval(retry);}
      if(document.getElementById('paiva-multi-camera'))clearInterval(retry);
    },200);
  }
  window.PAIVA_BOOT_CAMERAS=bootMultiCamera;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootMultiCamera,{once:true});
  else bootMultiCamera();
})();
